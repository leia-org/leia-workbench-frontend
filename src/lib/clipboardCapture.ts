import { loader } from "@monaco-editor/react";
import { sessionEvents } from "./sessionEvents";
import type { SessionEventSource, SessionEventsTracker } from "./sessionEvents";

// Records what the student copies, cuts and pastes while a session runs.
//
// The listeners live on `document`, not on each component, so a new surface
// only has to mark itself with `data-event-source`. Copy and cut are read
// while bubbling, once the surface has had its say on the clipboard. Paste
// and drop are read while capturing: Monaco intercepts `paste` in the capture
// phase of its own container and stops it there, so nothing below `document`
// would ever see it.

export type ClipboardMethod = "keyboard" | "menu" | "button" | "drop" | "unknown";

// ---------------------------------------------------------------------------
// Where a pasted text comes from
// ---------------------------------------------------------------------------

export const COPY_RING_KEY = "leia:clipboard-copies";
export const COPY_RING_SIZE = 30;

export interface PasteMatch {
  /** The copy or cut event the pasted text was recognised as. */
  clientEventId: string;
  sessionId: string;
  source: SessionEventSource;
  /** exact: same text; trimmed: same text but for the surrounding whitespace. */
  kind: "exact" | "trimmed";
  ageMs: number;
}

export interface PasteClassification {
  /** internal: the text was copied or cut inside the workbench. */
  origin: "internal" | "external";
  match?: PasteMatch;
}

export interface CopyRing {
  remember(copy: { clientEventId: string; sessionId: string; source: SessionEventSource; text: string }): void;
  classify(text: string): PasteClassification;
}

type RingStorage = Pick<Storage, "getItem" | "setItem">;

interface RingEntry {
  id: string;
  sessionId: string;
  source: SessionEventSource;
  at: number;
  /** Key of the normalised text. */
  hash: string;
  /** Key of the normalised text without surrounding whitespace ("" if none). */
  trimmed: string;
}

/** Line endings differ between surfaces (a textarea gives \n, the clipboard
 *  of Windows \r\n) without the text being any different. */
export const normalizeClipboardText = (text: string): string => text.replace(/\r\n?/g, "\n");

// cyrb53: a fast 53-bit string hash. Not cryptographic, and it need not be:
// it only tells whether a pasted text is one of the last few copies.
function cyrb53(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** What the ring keeps of a text: its length and a hash, never the text. */
export const clipboardTextKey = (text: string): string => `${text.length.toString(36)}.${cyrb53(text).toString(36)}`;

function isRingEntry(value: unknown): value is RingEntry {
  const entry = value as RingEntry | null;
  return (
    !!entry &&
    typeof entry.id === "string" &&
    typeof entry.sessionId === "string" &&
    typeof entry.source === "string" &&
    typeof entry.at === "number" &&
    typeof entry.hash === "string" &&
    typeof entry.trimmed === "string"
  );
}

// The last copies and cuts made inside the workbench, as hashes. Kept in
// localStorage so that it outlives a stage change, the move to /edit and a
// reload; without storage it falls back to the memory of the page.
export function createCopyRing(
  options: { storage?: RingStorage | null; now?: () => number; size?: number; key?: string } = {},
): CopyRing {
  const storage = options.storage ?? null;
  const now = options.now ?? (() => Date.now());
  const size = options.size ?? COPY_RING_SIZE;
  const key = options.key ?? COPY_RING_KEY;
  let memory: RingEntry[] = [];

  function read(): RingEntry[] {
    if (!storage) return memory;
    try {
      const parsed: unknown = JSON.parse(storage.getItem(key) ?? "[]");
      return Array.isArray(parsed) ? parsed.filter(isRingEntry) : [];
    } catch {
      return memory;
    }
  }

  function write(entries: RingEntry[]) {
    memory = entries;
    if (!storage) return;
    try {
      storage.setItem(key, JSON.stringify(entries));
    } catch { /* full or blocked storage: the memory copy still serves this page */ }
  }

  return {
    remember({ clientEventId, sessionId, source, text }) {
      const normalized = normalizeClipboardText(text);
      if (!normalized || !clientEventId) return;
      const trimmed = normalized.trim();
      const entry: RingEntry = {
        id: clientEventId,
        sessionId,
        source,
        at: now(),
        hash: clipboardTextKey(normalized),
        trimmed: trimmed ? clipboardTextKey(trimmed) : "",
      };
      write([...read(), entry].slice(-size));
    },

    classify(text) {
      const normalized = normalizeClipboardText(text);
      if (!normalized) return { origin: "external" };
      const entries = read();
      const toMatch = (entry: RingEntry, kind: PasteMatch["kind"]): PasteClassification => ({
        origin: "internal",
        match: {
          clientEventId: entry.id,
          sessionId: entry.sessionId,
          source: entry.source,
          kind,
          ageMs: Math.max(0, now() - entry.at),
        },
      });

      // The most recent copy wins, and an exact match beats a trimmed one.
      const hash = clipboardTextKey(normalized);
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].hash === hash) return toMatch(entries[i], "exact");
      }
      const trimmedText = normalized.trim();
      if (trimmedText) {
        const trimmed = clipboardTextKey(trimmedText);
        for (let i = entries.length - 1; i >= 0; i--) {
          if (entries[i].trimmed === trimmed) return toMatch(entries[i], "trimmed");
        }
      }
      return { origin: "external" };
    },
  };
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

interface Disposable {
  dispose(): void;
}

interface MonacoContentChange {
  text: string;
  range?: { startLineNumber: number; startColumn: number };
}

/** The part of a Monaco code editor the capture relies on. */
export interface MonacoEditorLike {
  onDidPaste(listener: (event: { clipboardEvent?: unknown }) => void): Disposable;
  onDidChangeModelContent(listener: (event: { changes: MonacoContentChange[]; isFlush?: boolean }) => void): Disposable;
  onDidDispose?(listener: () => void): Disposable;
  getContainerDomNode?(): Element | null;
  getDomNode?(): Element | null;
}

export interface MonacoLike {
  editor?: {
    getEditors?(): readonly MonacoEditorLike[];
    onDidCreateEditor?(listener: (editor: MonacoEditorLike) => void): Disposable;
  };
}

export interface ClipboardCaptureDeps {
  tracker: Pick<SessionEventsTracker, "track" | "accepts">;
  getDocument: () => Document | null;
  ring: CopyRing;
  now: () => number;
  /** The Monaco API once it has loaded; null until then. */
  getMonaco: () => MonacoLike | null | undefined;
}

export interface ClipboardCopyInput {
  source: SessionEventSource;
  text: string;
  method?: ClipboardMethod;
  action?: "copy" | "cut";
  wholeLine?: boolean;
  clipboardTypes?: string[];
}

export interface ClipboardCapture {
  /** Listens to the clipboard of the page for a session. Returns its stop. */
  start(sessionId: string): () => void;
  /** Records a copy made by the app itself (a Copy button), so that pasting
   *  it later counts as internal. Returns the event id, or null if dropped. */
  recordCopy(sessionId: string, copy: ClipboardCopyInput): string | null;
}

// A shortcut and the clipboard event it causes are a few milliseconds apart.
const SHORTCUT_WINDOW_MS = 1000;
// Monaco applies a paste a few milliseconds after its DOM event. Kept short:
// a DOM paste Monaco ends up not applying must not hide a menu paste that
// follows it.
const DOM_PASTE_WINDOW_MS = 500;
const MAX_CLIPBOARD_TYPES = 20;
// Monaco's own clipboard metadata (see its clipboardUtils).
const MONACO_METADATA_TYPE = "vscode-editor-data";
// What a student does before pasting into an editor: see hookMonaco.
const REACH_EVENTS = ["focusin", "pointerdown", "keydown", "contextmenu"] as const;

const SURFACES: ReadonlySet<string> = new Set<SessionEventSource>([
  "chat_input",
  "code_editor",
  "solution_editor",
  "notes",
  "previous_solution",
  "other",
]);

const noop = () => undefined;

type TransferData = Pick<DataTransfer, "getData" | "types"> | null | undefined;

function readData(data: TransferData, type: string): string {
  try {
    const value = data?.getData(type);
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

function typesOf(data: TransferData): string[] {
  try {
    return Array.from(data?.types ?? [])
      .map((type) => String(type).slice(0, 100))
      .slice(0, MAX_CLIPBOARD_TYPES);
  } catch {
    return [];
  }
}

// Monaco copies the whole line when nothing is selected, and says so.
function isWholeLine(data: TransferData): boolean {
  const raw = readData(data, MONACO_METADATA_TYPE);
  if (!raw) return false;
  try {
    return (JSON.parse(raw) as { isFromEmptySelection?: unknown })?.isFromEmptySelection === true;
  } catch {
    return false;
  }
}

function elementOf(target: unknown): Element | null {
  const node = target as (Node & Partial<Element>) | null;
  if (!node || typeof node !== "object") return null;
  if (typeof node.closest === "function") return node as Element;
  return node.parentElement ?? null;
}

type TextControl = HTMLInputElement | HTMLTextAreaElement;

function textControlOf(element: Element | null): TextControl | null {
  const tag = element?.tagName;
  return tag === "TEXTAREA" || tag === "INPUT" ? (element as TextControl) : null;
}

const isPasswordField = (element: Element | null): boolean =>
  element?.tagName === "INPUT" && (element as HTMLInputElement).type === "password";

const insideMonaco = (element: Element | null): boolean => !!element?.closest(".monaco-editor");

// Whether a paste or drop on this element inserts anything. The event also
// fires on plain page content, where the clipboard never reaches the page.
function isEditable(element: Element | null): boolean {
  if (!element || isPasswordField(element)) return false;
  const control = textControlOf(element);
  if (control) return !control.disabled && !control.readOnly;
  return (element as HTMLElement).isContentEditable === true || insideMonaco(element);
}

function sourceOf(target: unknown): SessionEventSource {
  const value = elementOf(target)?.closest("[data-event-source]")?.getAttribute("data-event-source");
  return value && SURFACES.has(value) ? (value as SessionEventSource) : "other";
}

// What a copy or cut takes when the surface did not fill the clipboard
// itself: the selection of the control, or of the page.
function selectedText(element: Element | null, doc: Document): string {
  const control = textControlOf(element);
  if (control) {
    try {
      const { selectionStart, selectionEnd, value } = control;
      if (selectionStart === null || selectionEnd === null || selectionEnd <= selectionStart) return "";
      return value.slice(selectionStart, selectionEnd);
    } catch {
      // Some input types have no selection.
      return "";
    }
  }
  try {
    return doc.getSelection?.()?.toString() ?? "";
  } catch {
    return "";
  }
}

// A multi-cursor paste arrives as one change per cursor: the same text at
// each of them, or one line of the clipboard for each.
function textOfChanges(changes: MonacoContentChange[] | undefined): string {
  if (!changes || changes.length === 0) return "";
  if (changes.length === 1) return changes[0].text ?? "";
  const texts = [...changes]
    .sort(
      (a, b) =>
        (a.range?.startLineNumber ?? 0) - (b.range?.startLineNumber ?? 0) ||
        (a.range?.startColumn ?? 0) - (b.range?.startColumn ?? 0),
    )
    .map((change) => change.text ?? "");
  return texts.every((text) => text === texts[0]) ? texts[0] : texts.join("\n");
}

function defaultStorage(): RingStorage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function defaultMonaco(): MonacoLike | null {
  try {
    // Does not load Monaco: it only hands over the instance an editor of the
    // page already loaded.
    return (loader.__getMonacoInstance() as unknown as MonacoLike | null) ?? null;
  } catch {
    return null;
  }
}

export function createClipboardCapture(overrides: Partial<ClipboardCaptureDeps> = {}): ClipboardCapture {
  const now = overrides.now ?? (() => Date.now());
  const tracker = overrides.tracker ?? sessionEvents;
  const getDocument = overrides.getDocument ?? (() => (typeof document !== "undefined" ? document : null));
  const getMonaco = overrides.getMonaco ?? defaultMonaco;
  let ring = overrides.ring ?? null;
  const getRing = (): CopyRing => (ring ??= createCopyRing({ storage: defaultStorage(), now }));

  function recordCopy(sessionId: string, copy: ClipboardCopyInput): string | null {
    try {
      const type = copy.action === "cut" ? "clipboard_cut" : "clipboard_copy";
      if (!copy.text || !tracker.accepts(sessionId, type)) return null;
      const id = tracker.track(sessionId, {
        type,
        source: copy.source,
        payload: {
          method: copy.method ?? "unknown",
          length: copy.text.length,
          ...(copy.wholeLine ? { wholeLine: true } : {}),
          ...(copy.clipboardTypes?.length ? { clipboardTypes: copy.clipboardTypes } : {}),
        },
        content: copy.text,
      });
      if (id) getRing().remember({ clientEventId: id, sessionId, source: copy.source, text: copy.text });
      return id || null;
    } catch {
      return null;
    }
  }

  function start(sessionId: string): () => void {
    const doc = getDocument();
    if (!doc || !sessionId) return noop;

    let lastShortcut: { action: "copy" | "cut" | "paste"; at: number } | null = null;
    let lastDomPaste: { at: number; target: Element | null } | null = null;
    // A drag that started in this page: what it drops was not brought in.
    let pageDrag = false;
    const editors = new Map<MonacoEditorLike, Disposable[]>();
    let editorCreation: Disposable | null = null;
    let monacoHooked = false;

    // Recording must never break the clipboard of the page.
    const safely = <E>(handler: (event: E) => void) => (event: E) => {
      try {
        handler(event);
      } catch { /* best effort */ }
    };

    // One shortcut explains one clipboard event: whatever follows without a
    // new key press came from a menu.
    const methodFor = (action: "copy" | "cut" | "paste"): ClipboardMethod => {
      const shortcut = lastShortcut;
      if (!shortcut || shortcut.action !== action || now() - shortcut.at > SHORTCUT_WINDOW_MS) return "menu";
      lastShortcut = null;
      return "keyboard";
    };

    function recordPaste(paste: {
      source: SessionEventSource;
      method: ClipboardMethod;
      text: string;
      wholeLine?: boolean;
      clipboardTypes?: string[];
      fromPage?: boolean;
    }) {
      const classification = getRing().classify(paste.text);
      const origin = paste.fromPage ? "internal" : classification.origin;
      tracker.track(sessionId, {
        type: "clipboard_paste",
        source: paste.source,
        payload: {
          method: paste.method,
          length: paste.text.length,
          ...(paste.wholeLine ? { wholeLine: true } : {}),
          ...(paste.clipboardTypes?.length ? { clipboardTypes: paste.clipboardTypes } : {}),
          origin,
          ...(classification.match ? { match: classification.match } : {}),
        },
        ...(paste.text ? { content: paste.text } : {}),
      });
    }

    const onKeyDown = safely((event: KeyboardEvent) => {
      const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
      let action: "copy" | "cut" | "paste" | null = null;
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        if (key === "c" || key === "insert") action = "copy";
        else if (key === "x") action = "cut";
        else if (key === "v") action = "paste";
      } else if (event.shiftKey && !event.altKey) {
        if (key === "insert") action = "paste";
        else if (key === "delete") action = "cut";
      }
      if (action) lastShortcut = { action, at: now() };
    });

    const onCopyOrCut = safely((event: ClipboardEvent) => {
      const action = event.type === "cut" ? "cut" : "copy";
      if (!tracker.accepts(sessionId, action === "cut" ? "clipboard_cut" : "clipboard_copy")) return;
      const element = elementOf(event.target);
      if (isPasswordField(element)) return;
      // Cutting from a read-only control takes nothing.
      const control = textControlOf(element);
      if (action === "cut" && control && (control.disabled || control.readOnly)) return;

      const data = event.clipboardData;
      // A surface that fills the clipboard itself (Monaco) has done so by the
      // time the event bubbles here. A plain control has not: the browser
      // copies its selection after the event. Monaco's own input element is
      // never read: what it holds is not what gets copied.
      const text = readData(data, "text/plain") || (insideMonaco(element) ? "" : selectedText(element, doc));
      if (!text) return;
      recordCopy(sessionId, {
        action,
        source: sourceOf(element),
        method: methodFor(action),
        text,
        wholeLine: isWholeLine(data),
        clipboardTypes: typesOf(data),
      });
    });

    const onPaste = safely((event: ClipboardEvent) => {
      if (!tracker.accepts(sessionId, "clipboard_paste")) return;
      const element = elementOf(event.target);
      if (!isEditable(element)) return;
      const data = event.clipboardData;
      const text = readData(data, "text/plain");
      const clipboardTypes = typesOf(data);
      // Files and images come without text: the types still tell.
      if (!text && clipboardTypes.length === 0) return;
      lastDomPaste = { at: now(), target: element };
      recordPaste({
        source: sourceOf(element),
        method: methodFor("paste"),
        text,
        wholeLine: isWholeLine(data),
        clipboardTypes,
      });
    });

    const onDrop = safely((event: DragEvent) => {
      const fromPage = pageDrag;
      pageDrag = false;
      if (!tracker.accepts(sessionId, "clipboard_paste")) return;
      const element = elementOf(event.target);
      if (!isEditable(element)) return;
      const data = event.dataTransfer;
      const text = readData(data, "text/plain");
      const clipboardTypes = typesOf(data);
      if (!text && clipboardTypes.length === 0) return;
      recordPaste({ source: sourceOf(element), method: "drop", text, clipboardTypes, fromPage });
    });

    const onDragStart = () => {
      pageDrag = true;
    };
    const onDragEnd = () => {
      pageDrag = false;
    };

    function detachEditor(editor: MonacoEditorLike) {
      for (const subscription of editors.get(editor) ?? []) {
        try { subscription.dispose(); } catch { /* ignore */ }
      }
      editors.delete(editor);
    }

    // Monaco's context menu (and its command palette) paste through the
    // async clipboard API: no DOM event, only `onDidPaste`. A keyboard paste
    // raises both, so `onDidPaste` only counts when no DOM paste preceded it.
    function attachEditor(editor: MonacoEditorLike) {
      if (!editor || editors.has(editor)) return;
      // The text of a paste is the change it has just made. `onDidPaste` only
      // gives a range, which says little with several cursors. A `setValue`
      // (the LEIA's applyDiff tool) changes the content without pasting, so
      // it never reaches `onDidPaste`.
      let lastChange: string | null = null;
      const subscriptions: Disposable[] = [];
      subscriptions.push(
        editor.onDidChangeModelContent(safely((event) => {
          lastChange = event?.isFlush ? null : textOfChanges(event?.changes);
        })),
      );
      subscriptions.push(
        editor.onDidPaste(safely((event) => {
          const text = lastChange;
          lastChange = null;
          const container = editor.getContainerDomNode?.() ?? editor.getDomNode?.() ?? null;
          // A paste that started as a DOM event has already been recorded
          // from it. Monaco says so itself when it can; otherwise the DOM
          // paste that has just happened in this editor is taken to be it.
          const dom = lastDomPaste;
          const followsDomPaste =
            !!dom &&
            now() - dom.at <= DOM_PASTE_WINDOW_MS &&
            (!container || !dom.target || container.contains(dom.target));
          if (event?.clipboardEvent || followsDomPaste) {
            lastDomPaste = null;
            return;
          }
          if (!text || !tracker.accepts(sessionId, "clipboard_paste")) return;
          recordPaste({ source: sourceOf(container), method: methodFor("paste"), text });
        })),
      );
      if (typeof editor.onDidDispose === "function") {
        subscriptions.push(editor.onDidDispose(() => detachEditor(editor)));
      }
      editors.set(editor, subscriptions);
    }

    // Monaco loads on demand, after the first editor mounts, so its editors
    // are looked up here and on every sign of the student reaching for one
    // (a key, a click, focus moving), until the hook for new editors is in
    // place. Focus alone is not enough: no `focusin` fires in a window that
    // is not focused yet.
    function hookMonaco() {
      if (monacoHooked) return;
      const api = getMonaco()?.editor;
      if (!api) return;
      if (typeof api.onDidCreateEditor === "function") {
        editorCreation = api.onDidCreateEditor(safely((editor: MonacoEditorLike) => attachEditor(editor)));
        monacoHooked = true;
      }
      for (const editor of api.getEditors?.() ?? []) attachEditor(editor);
    }
    const onReach = safely(() => hookMonaco());

    doc.addEventListener("keydown", onKeyDown, true);
    doc.addEventListener("copy", onCopyOrCut);
    doc.addEventListener("cut", onCopyOrCut);
    doc.addEventListener("paste", onPaste, true);
    doc.addEventListener("drop", onDrop, true);
    doc.addEventListener("dragstart", onDragStart, true);
    doc.addEventListener("dragend", onDragEnd, true);
    for (const type of REACH_EVENTS) doc.addEventListener(type, onReach, true);
    try {
      hookMonaco();
    } catch { /* looked up again when the student reaches for an editor */ }

    return () => {
      doc.removeEventListener("keydown", onKeyDown, true);
      doc.removeEventListener("copy", onCopyOrCut);
      doc.removeEventListener("cut", onCopyOrCut);
      doc.removeEventListener("paste", onPaste, true);
      doc.removeEventListener("drop", onDrop, true);
      doc.removeEventListener("dragstart", onDragStart, true);
      doc.removeEventListener("dragend", onDragEnd, true);
      for (const type of REACH_EVENTS) doc.removeEventListener(type, onReach, true);
      try { editorCreation?.dispose(); } catch { /* ignore */ }
      for (const editor of [...editors.keys()]) detachEditor(editor);
    };
  }

  return { start, recordCopy };
}

/** The capture of the student views, bound to the shared tracker. */
export const clipboardCapture = createClipboardCapture();
