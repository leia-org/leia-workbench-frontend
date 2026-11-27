import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import axios from "axios";
import { createClipboardCapture, createCopyRing, clipboardCapture } from "../../src/lib/clipboardCapture";
import { sessionEvents, type SessionEventInput, type SessionEventWire } from "../../src/lib/sessionEvents";
import { Chat } from "../../src/views/Chat";
import { Edit } from "../../src/views/Edit";
import NotesWidget from "../../src/widgets/NotesWidget";
import PreviousSubmittedSolutionWidget from "../../src/widgets/PreviousSubmittedSolutionWidget";

// jsdom has no Monaco. This stands in for the parts of it the capture uses:
// editors that announce a paste and the change it made, and the registry the
// loader of @monaco-editor/react hands over once Monaco has loaded.
const monaco = vi.hoisted(() => {
  interface Change {
    text: string;
    range?: { startLineNumber: number; startColumn: number };
  }
  interface FakeEditor {
    onDidPaste(listener: (event: { clipboardEvent?: unknown }) => void): { dispose(): void };
    onDidChangeModelContent(listener: (event: { changes: Change[]; isFlush?: boolean }) => void): { dispose(): void };
    onDidDispose(listener: () => void): { dispose(): void };
    getContainerDomNode(): Element | null;
    getValue(): string;
    /** What the LEIA's applyDiff tool does. */
    setValue(next: string): void;
    /** A paste applied by Monaco: the change, then `onDidPaste`. */
    paste(changes: Change[] | string, event?: { clipboardEvent?: unknown }): void;
    announcePaste(event?: { clipboardEvent?: unknown }): void;
    dispose(): void;
    listeners(): number;
  }

  function emitter<T>() {
    const listeners = new Set<(event: T) => void>();
    return {
      listeners,
      on: (listener: (event: T) => void) => {
        listeners.add(listener);
        return { dispose: () => void listeners.delete(listener) };
      },
      fire: (event: T) => {
        for (const listener of [...listeners]) listener(event);
      },
    };
  }

  const state = { loaded: true, editors: [] as FakeEditor[] };
  const created = emitter<FakeEditor>();

  function createEditor(container: Element | null, value = ""): FakeEditor {
    const pasted = emitter<{ clipboardEvent?: unknown }>();
    const changed = emitter<{ changes: Change[]; isFlush?: boolean }>();
    const disposed = emitter<void>();
    let content = value;
    const editor: FakeEditor = {
      onDidPaste: pasted.on,
      onDidChangeModelContent: changed.on,
      onDidDispose: disposed.on,
      getContainerDomNode: () => container,
      getValue: () => content,
      setValue(next) {
        content = next;
        changed.fire({ changes: [{ text: next }], isFlush: true });
      },
      paste(changes, event = {}) {
        changed.fire({ changes: typeof changes === "string" ? [{ text: changes }] : changes });
        pasted.fire(event);
      },
      announcePaste(event = {}) {
        pasted.fire(event);
      },
      dispose() {
        disposed.fire();
        const index = state.editors.indexOf(editor);
        if (index >= 0) state.editors.splice(index, 1);
      },
      listeners: () => pasted.listeners.size + changed.listeners.size,
    };
    state.editors.push(editor);
    created.fire(editor);
    return editor;
  }

  const api = { editor: { getEditors: () => state.editors, onDidCreateEditor: created.on } };
  return { state, api, createEditor, creationListeners: () => created.listeners.size };
});

vi.mock("@monaco-editor/react", async () => {
  const React = await import("react");
  function Editor(props: {
    value?: string;
    defaultValue?: string;
    onMount?: (editor: unknown, monacoApi: unknown) => void;
  }) {
    const container = React.useRef<HTMLDivElement>(null);
    const initial = React.useRef(props.value ?? props.defaultValue ?? "");
    const onMount = React.useRef(props.onMount);
    React.useEffect(() => {
      const editor = monaco.createEditor(container.current, initial.current);
      onMount.current?.(editor, undefined);
      return () => editor.dispose();
    }, []);
    return React.createElement(
      "div",
      { className: "monaco-editor", ref: container },
      React.createElement("textarea", { "aria-label": "Monaco input" }),
    );
  }
  return {
    default: Editor,
    loader: { __getMonacoInstance: () => (monaco.state.loaded ? monaco.api : null) },
  };
});

vi.mock("@leia-org/luke-client", () => ({ useLuke: vi.fn() }));

vi.mock("mermaid", () => ({
  default: { initialize: vi.fn(), render: vi.fn().mockResolvedValue({ svg: "<svg></svg>" }) },
}));

vi.mock("../../src/components/FormatPreview", () => ({
  FormatPreview: ({ code }: { code: string }) => <div data-testid="format-preview">{code}</div>,
}));

// The real runner needs a Worker.
vi.mock("../../src/widgets/codeEditor/jsRunner", () => ({
  runJsTests: vi.fn(async () => ({ results: [{ name: "adds", ok: true, expected: 3, actual: 3 }] })),
}));

// jsdom has neither ClipboardEvent nor DataTransfer.
function transfer(data: Record<string, string> = {}) {
  const store = new Map(Object.entries(data));
  return {
    getData: (type: string) => store.get(type) ?? "",
    setData: (type: string, value: string) => void store.set(type, value),
    get types() {
      return [...store.keys()];
    },
  };
}

function clipboardEvent(type: "copy" | "cut" | "paste", data: Record<string, string> = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: transfer(data) });
  return event as ClipboardEvent;
}

function dropEvent(data: Record<string, string> = {}) {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer(data) });
  return event;
}

const textarea = (label: string) => screen.getByLabelText(label) as HTMLTextAreaElement;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubEnv("VITE_APP_BACKEND", "http://backend.test");
  monaco.state.loaded = true;
  monaco.state.editors.length = 0;
});

describe("clipboard capture on the page", () => {
  const Surfaces = () => (
    <div>
      <textarea aria-label="Chat" data-event-source="chat_input" defaultValue="hello world from chat" />
      <div data-event-source="notes">
        <textarea aria-label="Notes" defaultValue="remember the edge case" />
      </div>
      <textarea aria-label="Unmarked" defaultValue="somewhere else" />
      <textarea aria-label="Read only" readOnly data-event-source="chat_input" defaultValue="fixed text" />
      <input aria-label="Password" type="password" defaultValue="hunter2" />
      <p data-testid="message">A message from LEIA</p>
      <div data-event-source="code_editor">
        <div className="monaco-editor" data-testid="monaco">
          <textarea aria-label="Monaco input" defaultValue="what Monaco keeps for screen readers" />
        </div>
      </div>
    </div>
  );

  function start(options: { accepts?: boolean } = {}) {
    const tracked: SessionEventInput[] = [];
    const tracker = {
      accepts: vi.fn(() => options.accepts ?? true),
      track: vi.fn((_sessionId: string, input: SessionEventInput) => {
        tracked.push(input);
        return `event-${tracked.length}`;
      }),
    };
    const capture = createClipboardCapture({
      tracker,
      ring: createCopyRing({ storage: localStorage }),
      getMonaco: () => (monaco.state.loaded ? monaco.api : null),
    });
    render(<Surfaces />);
    const stop = capture.start("s1");
    return { tracked, tracker, capture, stop };
  }

  let stopCapture: (() => void) | null = null;
  const capture = (options?: { accepts?: boolean }) => {
    const started = start(options);
    stopCapture = started.stop;
    return started;
  };
  afterEach(() => {
    stopCapture?.();
    stopCapture = null;
  });

  test("a copy in a textarea records the selection of that control", () => {
    const { tracked, tracker } = capture();
    const chat = textarea("Chat");

    chat.setSelectionRange(6, 11);
    chat.dispatchEvent(clipboardEvent("copy"));

    expect(tracker.track).toHaveBeenCalledWith("s1", expect.anything());
    expect(tracked).toEqual([
      { type: "clipboard_copy", source: "chat_input", payload: { method: "menu", length: 5 }, content: "world" },
    ]);
  });

  test("a cut is its own kind of event, and nothing selected is nothing copied", () => {
    const { tracked } = capture();
    const notes = textarea("Notes");

    notes.setSelectionRange(3, 3);
    notes.dispatchEvent(clipboardEvent("copy"));
    notes.dispatchEvent(clipboardEvent("cut"));
    expect(tracked).toEqual([]);

    notes.setSelectionRange(0, 8);
    notes.dispatchEvent(clipboardEvent("cut"));
    expect(tracked).toEqual([
      { type: "clipboard_cut", source: "notes", payload: { method: "menu", length: 8 }, content: "remember" },
    ]);
  });

  test("tells a keyboard shortcut from a menu", () => {
    const { tracked } = capture();
    const chat = textarea("Chat");
    chat.setSelectionRange(0, 5);

    fireEvent.keyDown(chat, { key: "c", ctrlKey: true });
    chat.dispatchEvent(clipboardEvent("copy"));
    // The shortcut was for copying: this paste did not come from it.
    chat.dispatchEvent(clipboardEvent("paste", { "text/plain": "x" }));
    fireEvent.keyDown(chat, { key: "V", metaKey: true, shiftKey: true });
    chat.dispatchEvent(clipboardEvent("paste", { "text/plain": "x" }));
    fireEvent.keyDown(chat, { key: "Delete", shiftKey: true });
    chat.dispatchEvent(clipboardEvent("cut"));
    // AltGr combinations report ctrl and alt together.
    fireEvent.keyDown(chat, { key: "c", ctrlKey: true, altKey: true });
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5000);
    chat.dispatchEvent(clipboardEvent("copy"));

    expect(tracked.map((event) => [event.type, event.payload?.method])).toEqual([
      ["clipboard_copy", "keyboard"],
      ["clipboard_paste", "menu"],
      ["clipboard_paste", "keyboard"],
      ["clipboard_cut", "keyboard"],
      ["clipboard_copy", "menu"],
    ]);
  });

  test("a paste brings the text, what the clipboard offered and where it came from", () => {
    const { tracked } = capture();

    textarea("Chat").dispatchEvent(
      clipboardEvent("paste", { "text/plain": "from the web\r\nline two", "text/html": "<b>from the web</b>" }),
    );

    expect(tracked).toEqual([
      {
        type: "clipboard_paste",
        source: "chat_input",
        payload: {
          method: "menu",
          length: 22,
          clipboardTypes: ["text/plain", "text/html"],
          origin: "external",
        },
        content: "from the web\r\nline two",
      },
    ]);
  });

  test("a text copied on one surface and pasted on another is internal", () => {
    const { tracked } = capture();
    const notes = textarea("Notes");

    notes.setSelectionRange(13, 22);
    notes.dispatchEvent(clipboardEvent("copy"));
    textarea("Chat").dispatchEvent(clipboardEvent("paste", { "text/plain": "edge case" }));
    textarea("Chat").dispatchEvent(clipboardEvent("paste", { "text/plain": " edge case\n" }));

    expect(tracked[1].payload).toEqual({
      method: "menu",
      length: 9,
      clipboardTypes: ["text/plain"],
      origin: "internal",
      match: { clientEventId: "event-1", sessionId: "s1", source: "notes", kind: "exact", ageMs: expect.any(Number) },
    });
    expect(tracked[2].payload).toMatchObject({ origin: "internal", match: { clientEventId: "event-1", kind: "trimmed" } });
    expect(localStorage.getItem("leia:clipboard-copies")).not.toContain("edge case");
  });

  test("the surface is the closest data-event-source, or other", () => {
    const { tracked } = capture();

    textarea("Notes").dispatchEvent(clipboardEvent("paste", { "text/plain": "a" }));
    textarea("Unmarked").dispatchEvent(clipboardEvent("paste", { "text/plain": "b" }));

    expect(tracked.map((event) => event.source)).toEqual(["notes", "other"]);
  });

  test("leaves alone what never enters the page, and passwords", () => {
    const { tracked } = capture();
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    const readOnly = textarea("Read only");

    // Not an editable target: the clipboard goes nowhere.
    screen.getByTestId("message").dispatchEvent(clipboardEvent("paste", { "text/plain": "secret" }));
    readOnly.dispatchEvent(clipboardEvent("paste", { "text/plain": "secret" }));
    readOnly.setSelectionRange(0, 5);
    readOnly.dispatchEvent(clipboardEvent("cut"));
    password.dispatchEvent(clipboardEvent("paste", { "text/plain": "secret" }));
    password.setSelectionRange(0, 7);
    password.dispatchEvent(clipboardEvent("copy"));
    // A paste event without a clipboard.
    textarea("Chat").dispatchEvent(clipboardEvent("paste"));
    textarea("Chat").dispatchEvent(new Event("paste", { bubbles: true }));

    expect(tracked).toEqual([]);
  });

  test("a pasted file has no text, but is still a paste", () => {
    const { tracked } = capture();

    textarea("Chat").dispatchEvent(clipboardEvent("paste", { Files: "" }));

    expect(tracked).toEqual([
      {
        type: "clipboard_paste",
        source: "chat_input",
        payload: { method: "menu", length: 0, clipboardTypes: ["Files"], origin: "external" },
      },
    ]);
  });

  test("text dropped from another application is a paste by drop", () => {
    const { tracked } = capture();

    textarea("Chat").dispatchEvent(dropEvent({ "text/plain": "dragged in" }));
    // Dragged from a control of this same page: not brought in.
    fireEvent.dragStart(textarea("Notes"));
    textarea("Chat").dispatchEvent(dropEvent({ "text/plain": "moved around" }));
    fireEvent.dragEnd(textarea("Notes"));
    textarea("Chat").dispatchEvent(dropEvent({ "text/plain": "dragged in again" }));

    expect(tracked.map((event) => [event.content, event.payload?.method, event.payload?.origin])).toEqual([
      ["dragged in", "drop", "external"],
      ["moved around", "drop", "internal"],
      ["dragged in again", "drop", "external"],
    ]);
  });

  test("reads nothing while the session takes no observational events", () => {
    const { tracked, tracker } = capture({ accepts: false });
    const chat = textarea("Chat");
    const pasteEvent = clipboardEvent("paste", { "text/plain": "private" });
    const getData = vi.spyOn(pasteEvent.clipboardData as DataTransfer, "getData");

    chat.dispatchEvent(pasteEvent);
    chat.setSelectionRange(0, 5);
    chat.dispatchEvent(clipboardEvent("copy"));
    monaco.createEditor(screen.getByTestId("monaco")).paste("private");

    expect(getData).not.toHaveBeenCalled();
    expect(tracker.track).not.toHaveBeenCalled();
    expect(tracked).toEqual([]);
    expect(localStorage.getItem("leia:clipboard-copies")).toBeNull();
  });

  test("never breaks the clipboard of the page", () => {
    const { tracker } = capture();
    tracker.track.mockImplementation(() => {
      throw new Error("tracker down");
    });
    const chat = textarea("Chat");
    chat.setSelectionRange(0, 5);

    expect(() => chat.dispatchEvent(clipboardEvent("copy"))).not.toThrow();
    expect(() => chat.dispatchEvent(clipboardEvent("paste", { "text/plain": "x" }))).not.toThrow();
  });

  test("stops listening when stopped", () => {
    const { tracked, stop } = capture();
    const editor = monaco.createEditor(screen.getByTestId("monaco"));
    expect(editor.listeners()).toBe(2);

    stop();
    textarea("Chat").dispatchEvent(clipboardEvent("paste", { "text/plain": "late" }));
    editor.paste("late");

    expect(tracked).toEqual([]);
    expect(editor.listeners()).toBe(0);
    expect(monaco.creationListeners()).toBe(0);
  });

  describe("in a Monaco editor", () => {
    // Monaco handles `paste` in the capture phase of its container and stops
    // it there (copyPasteController.js), and fills the clipboard itself on
    // copy.
    function mountMonaco() {
      const container = screen.getByTestId("monaco");
      const input = within(container).getByLabelText("Monaco input") as HTMLTextAreaElement;
      container.addEventListener(
        "paste",
        (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
        },
        true,
      );
      return { container, input, editor: monaco.createEditor(container) };
    }

    test("sees a keyboard paste before Monaco stops it, and records it once", () => {
      const { tracked } = capture();
      const { input, editor } = mountMonaco();
      const reachedThePage = vi.fn();
      document.body.addEventListener("paste", reachedThePage);

      fireEvent.keyDown(input, { key: "v", ctrlKey: true });
      const pasteEvent = clipboardEvent("paste", { "text/plain": "const x = 1;" });
      input.dispatchEvent(pasteEvent);
      // Monaco then applies the paste and announces it.
      editor.paste("const x = 1;", { clipboardEvent: pasteEvent });

      document.body.removeEventListener("paste", reachedThePage);
      expect(reachedThePage).not.toHaveBeenCalled();
      expect(tracked).toEqual([
        {
          type: "clipboard_paste",
          source: "code_editor",
          payload: { method: "keyboard", length: 12, clipboardTypes: ["text/plain"], origin: "external" },
          content: "const x = 1;",
        },
      ]);
    });

    test("a paste from Monaco's context menu has no DOM event: the editor tells", () => {
      const { tracked } = capture();
      const { editor } = mountMonaco();

      editor.paste("pasted from the menu");

      expect(tracked).toEqual([
        {
          type: "clipboard_paste",
          source: "code_editor",
          payload: { method: "menu", length: 20, origin: "external" },
          content: "pasted from the menu",
        },
      ]);
    });

    test("a menu paste right after a keyboard paste is still recorded, as a menu paste", () => {
      const { tracked } = capture();
      const { input, editor } = mountMonaco();

      fireEvent.keyDown(input, { key: "v", ctrlKey: true });
      input.dispatchEvent(clipboardEvent("paste", { "text/plain": "first" }));
      editor.paste("first");
      editor.paste("second");

      expect(tracked.map((event) => [event.content, event.payload?.method])).toEqual([
        ["first", "keyboard"],
        ["second", "menu"],
      ]);
    });

    test("a DOM paste Monaco never applied does not hide the menu paste that follows", () => {
      const { tracked } = capture();
      const { input, editor } = mountMonaco();

      input.dispatchEvent(clipboardEvent("paste", { "text/plain": "not applied" }));
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + 600);
      editor.paste("applied from the menu");

      expect(tracked.map((event) => event.content)).toEqual(["not applied", "applied from the menu"]);
    });

    test("an edit by the LEIA's applyDiff tool is not a paste", () => {
      const { tracked } = capture();
      const { editor } = mountMonaco();

      editor.setValue("function twoSum() { /* rewritten by LEIA */ }");
      // Even a stray paste notification finds no pasted text to report.
      editor.announcePaste();

      expect(tracked).toEqual([]);
    });

    test("ignores a paste notification that carries its own DOM event", () => {
      const { tracked } = capture();
      const { editor } = mountMonaco();

      editor.paste("already seen", { clipboardEvent: clipboardEvent("paste") });

      expect(tracked).toEqual([]);
    });

    test("a paste on several cursors is one paste", () => {
      const { tracked } = capture();
      const { editor } = mountMonaco();

      // Monaco reports the changes from the end of the document backwards.
      editor.paste([
        { text: "third", range: { startLineNumber: 5, startColumn: 1 } },
        { text: "second", range: { startLineNumber: 2, startColumn: 9 } },
        { text: "first", range: { startLineNumber: 2, startColumn: 1 } },
      ]);
      editor.paste([
        { text: "same", range: { startLineNumber: 3, startColumn: 1 } },
        { text: "same", range: { startLineNumber: 1, startColumn: 1 } },
      ]);

      expect(tracked.map((event) => event.content)).toEqual(["first\nsecond\nthird", "same"]);
    });

    test("a copy takes what Monaco put on the clipboard, and knows a whole-line copy", () => {
      const { tracked } = capture();
      const { input, editor } = mountMonaco();
      input.addEventListener("copy", (event) => {
        event.preventDefault();
        event.clipboardData?.setData("text/plain", "    return total;\n");
        event.clipboardData?.setData("vscode-editor-data", JSON.stringify({ isFromEmptySelection: true }));
      });
      input.setSelectionRange(0, 4);

      fireEvent.keyDown(input, { key: "c", ctrlKey: true });
      input.dispatchEvent(clipboardEvent("copy"));
      editor.paste("    return total;\n");

      expect(tracked[0]).toEqual({
        type: "clipboard_copy",
        source: "code_editor",
        payload: {
          method: "keyboard",
          length: 18,
          wholeLine: true,
          clipboardTypes: ["text/plain", "vscode-editor-data"],
        },
        content: "    return total;\n",
      });
      expect(tracked[1].payload).toMatchObject({ origin: "internal", match: { source: "code_editor", kind: "exact" } });
    });

    test("never reads Monaco's own input element", () => {
      const { tracked } = capture();
      const { input } = mountMonaco();

      input.setSelectionRange(0, 11);
      input.dispatchEvent(clipboardEvent("copy"));

      expect(tracked).toEqual([]);
    });

    // No `focusin` fires in a window that has no focus yet, so a click or a
    // key must do as well.
    test.each([
      ["focus moving", (element: Element) => fireEvent.focusIn(element)],
      ["a click", (element: Element) => fireEvent.pointerDown(element)],
      ["a right click", (element: Element) => fireEvent.contextMenu(element)],
      ["a key", (element: Element) => fireEvent.keyDown(element, { key: "F10", shiftKey: true })],
    ])("finds a Monaco that loads late on %s, and the editors created afterwards", (_name, reach) => {
      monaco.state.loaded = false;
      const { tracked } = capture();
      const container = screen.getByTestId("monaco");
      const early = monaco.createEditor(container);

      early.paste("before Monaco was known");
      expect(tracked).toEqual([]);

      // Monaco finishes loading; the student reaching for the editor picks
      // its editors up.
      monaco.state.loaded = true;
      reach(container);
      early.paste("found on focus");
      const late = monaco.createEditor(null);
      late.paste("created afterwards");
      late.dispose();
      expect(late.listeners()).toBe(0);

      expect(tracked.map((event) => [event.content, event.source])).toEqual([
        ["found on focus", "code_editor"],
        ["created afterwards", "other"],
      ]);
    });
  });
});

describe("session events in the student views", () => {
  const fetchMock = vi.fn();
  const calls: string[] = [];

  const sentEvents = (): SessionEventWire[] =>
    fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith("/events"))
      .flatMap(([, init]) => JSON.parse(String((init as RequestInit).body)).events);

  beforeEach(() => {
    calls.length = 0;
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      calls.push(`fetch ${new URL(url).pathname}`);
      return { status: 200, json: async () => ({ results: [] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(axios, "post").mockImplementation(async (url: string) => {
      calls.push(`post ${new URL(url).pathname}`);
      return { status: 200, data: { finishedAt: "2026-11-26T10:30:00Z" } };
    });
  });

  // Nothing may be left queued for the next test.
  afterEach(async () => {
    await sessionEvents.flush();
  });

  const codeEditorWidget = {
    widgetType: "codeEditor",
    slot: "right",
    params: {
      fnName: "add",
      language: "javascript",
      starter: { javascript: "function add(a, b) { return a + b; }" },
      tests: [{ name: "adds", args: [1, 2], expected: 3 }],
    },
  };

  function mockSession(
    sessionId: string,
    options: { leia?: Record<string, unknown>; session?: Record<string, unknown>; widgets?: unknown[] } = {},
  ) {
    vi.spyOn(axios, "get").mockImplementation(async (url: string) => {
      if (!url.endsWith(`/api/v1/interactions/${sessionId}`)) return { status: 200, data: {} };
      return {
        status: 200,
        data: {
          session: {
            id: sessionId,
            isTest: false,
            startedAt: "2026-11-26T10:00:00Z",
            finishedAt: null,
            isRunnerInitialized: true,
            ...options.session,
          },
          replication: { name: "Rep", duration: 0, isActive: true, isRepeatable: false, code: "ABC", form: "" },
          leia: {
            id: "l1",
            configuration: { mode: "standard", askSolution: false, evaluateSolution: false, data: {} },
            leia: {
              id: "doc-1",
              spec: {
                persona: { spec: { firstName: "Marco" } },
                problem: { spec: { description: "Task", widgets: options.widgets ?? [] } },
                behaviour: { spec: {} },
              },
            },
            ...options.leia,
          },
          messages: [{ id: "m1", text: "Hello", isLeia: true, timestamp: "2026-11-26T10:00:01Z" }],
        },
      };
    });
  }

  async function openChat(sessionId: string) {
    render(
      <MemoryRouter initialEntries={[`/chat/${sessionId}`]}>
        <Routes>
          <Route path="/chat/:sessionId" element={<Chat />} />
          <Route path="/edit" element={<Edit />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Continue Task" }, { timeout: 3000 }));
    return (await screen.findByPlaceholderText(/Type a message/)) as HTMLTextAreaElement;
  }

  test("Chat records a paste in the message box when the backend offers events", async () => {
    mockSession("chat-on", { leia: { eventsEnabled: true } });
    const input = await openChat("chat-on");

    expect(localStorage.getItem("eventsEnabled")).toBe("true");
    expect(input.getAttribute("data-event-source")).toBe("chat_input");
    fireEvent.keyDown(input, { key: "v", ctrlKey: true });
    input.dispatchEvent(clipboardEvent("paste", { "text/plain": "an answer from elsewhere" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/api/v1/interactions/chat-on/events",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
    expect(sentEvents()).toEqual([
      {
        clientEventId: expect.stringMatching(/\S{8,}/),
        type: "clipboard_paste",
        source: "chat_input",
        actor: "student",
        view: "chat",
        clientAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        seq: expect.any(Number),
        payload: { method: "keyboard", length: 24, clipboardTypes: ["text/plain"], origin: "external" },
        content: "an answer from elsewhere",
      },
    ]);
  });

  test("Chat records nothing when the backend does not offer events", async () => {
    mockSession("chat-off");
    const input = await openChat("chat-off");

    input.dispatchEvent(clipboardEvent("paste", { "text/plain": "an answer from elsewhere" }));
    await sessionEvents.flush();

    expect(localStorage.getItem("eventsEnabled")).toBe("false");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("Chat sends a test run as an event, and to the old endpoint only without events", async () => {
    mockSession("chat-tests", { leia: { eventsEnabled: true, testRunsEnabled: true }, widgets: [codeEditorWidget] });
    await openChat("chat-tests");
    const editorSurface = (await screen.findByLabelText("Monaco input")).closest("[data-event-source]");
    expect(editorSurface?.getAttribute("data-event-source")).toBe("code_editor");

    fireEvent.click(screen.getByRole("button", { name: "Run tests" }));

    await waitFor(() => expect(sentEvents()).toHaveLength(1));
    expect(sentEvents()[0]).toMatchObject({
      type: "test_run",
      source: "code_editor",
      actor: "student",
      view: "chat",
      payload: { language: "javascript", fnName: "add", results: [{ name: "adds", ok: true }], error: null },
      content: "function add(a, b) { return a + b; }",
    });
    expect(calls.filter((call) => call.includes("test-runs"))).toEqual([]);
  });

  test("Chat keeps the old test run endpoint while the backend does not offer events", async () => {
    mockSession("chat-legacy", { leia: { testRunsEnabled: true }, widgets: [codeEditorWidget] });
    await openChat("chat-legacy");

    fireEvent.click(await screen.findByRole("button", { name: "Run tests" }));

    await waitFor(() => expect(calls).toContain("post /api/v1/interactions/chat-legacy/test-runs"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a student who declined the consent is not observed, but test runs are kept", async () => {
    mockSession("chat-declined", {
      leia: { eventsEnabled: true, testRunsEnabled: true },
      widgets: [codeEditorWidget],
      session: {
        dataUsage: {
          config: { dataUsageConsentRequired: true, dataUsageConsentMessage: "", conversationAutomatedRemoval: false },
          consentStatus: "declined",
          decidedAt: "2026-11-26T10:00:00Z",
          automatedRemovalApplied: false,
        },
      },
    });
    const input = await openChat("chat-declined");

    input.dispatchEvent(clipboardEvent("paste", { "text/plain": "private" }));
    monaco.state.editors[0].paste("private too");
    fireEvent.click(await screen.findByRole("button", { name: "Run tests" }));

    await waitFor(() => expect(sentEvents()).toHaveLength(1));
    expect(sentEvents()[0].type).toBe("test_run");
  });

  test("nothing is recorded while the consent is unanswered", async () => {
    mockSession("chat-pending", {
      leia: { eventsEnabled: true },
      session: {
        dataUsage: {
          config: { dataUsageConsentRequired: true, dataUsageConsentMessage: "May we?", conversationAutomatedRemoval: false },
          consentStatus: "pending",
          decidedAt: null,
          automatedRemovalApplied: false,
        },
      },
    });
    render(
      <MemoryRouter initialEntries={["/chat/chat-pending"]}>
        <Routes>
          <Route path="/chat/:sessionId" element={<Chat />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("May we?");

    expect(sessionEvents.accepts("chat-pending", "test_run")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("Chat sends what is queued before finishing the session, then stops", async () => {
    mockSession("chat-finish", { leia: { eventsEnabled: true } });
    await openChat("chat-finish");

    sessionEvents.track("chat-finish", { type: "page_leave", source: "page", payload: { reason: "blur" } });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Finish activity" }));

    await screen.findByRole("heading", { name: /complete/i });
    expect(calls).toEqual([
      "fetch /api/v1/interactions/chat-finish/events",
      "post /api/v1/interactions/chat-finish/finish",
    ]);
    expect(sessionEvents.accepts("chat-finish", "clipboard_paste")).toBe(false);
  });

  test("Edit records the solution editor with the flag Chat left, and flushes before sending", async () => {
    localStorage.setItem("sessionId", "edit-on");
    localStorage.setItem("eventsEnabled", "true");
    localStorage.setItem("exercise", JSON.stringify({ solutionFormat: "text", initialSolution: "draft" }));
    localStorage.setItem("configuration", JSON.stringify({ mode: "standard", askSolution: true, evaluateSolution: false }));
    localStorage.setItem("session", JSON.stringify({ id: "edit-on", startedAt: "2026-11-26T10:00:00Z" }));
    vi.spyOn(axios, "get").mockResolvedValue({ status: 200, data: {} });
    render(
      <MemoryRouter>
        <Edit />
      </MemoryRouter>,
    );
    const surface = (await screen.findByLabelText("Monaco input")).closest("[data-event-source]");
    expect(surface?.getAttribute("data-event-source")).toBe("solution_editor");
    await waitFor(() => expect(sessionEvents.accepts("edit-on", "clipboard_paste")).toBe(true));

    monaco.state.editors[0].paste("a whole solution");
    expect(sentEvents()).toEqual([
      expect.objectContaining({
        type: "clipboard_paste",
        source: "solution_editor",
        view: "edit",
        payload: { method: "menu", length: 16, origin: "external" },
        content: "a whole solution",
      }),
    ]);

    calls.length = 0;
    sessionEvents.track("edit-on", { type: "page_leave", source: "page", payload: { reason: "blur" } });
    fireEvent.click(screen.getByRole("button", { name: "Send solution" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Send solution" }));

    fireEvent.click(await screen.findByRole("button", { name: "Back to home" }));
    expect(calls).toEqual([
      "fetch /api/v1/interactions/edit-on/events",
      "post /api/v1/interactions/edit-on/result",
    ]);
    expect(sessionEvents.accepts("edit-on", "clipboard_paste")).toBe(false);
    expect(localStorage.getItem("eventsEnabled")).toBeNull();
  });

  test("Edit records nothing without the flag", async () => {
    localStorage.setItem("sessionId", "edit-off");
    localStorage.setItem("exercise", JSON.stringify({ solutionFormat: "text" }));
    localStorage.setItem("session", JSON.stringify({ id: "edit-off" }));
    render(
      <MemoryRouter>
        <Edit />
      </MemoryRouter>,
    );
    await screen.findByLabelText("Monaco input");

    monaco.state.editors[0].paste("a whole solution");

    expect(sessionEvents.accepts("edit-off", "clipboard_paste")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("the Copy button of the previous solution is a copy, and pasting it is internal", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({
      data: { stage: { number: 1, total: 2 }, availability: "both", solution: "my stage one answer", solutionFormat: "text" },
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const stopTracker = sessionEvents.start("stage-2", { view: "chat", observe: true });
    const stopCapture = clipboardCapture.start("stage-2");
    render(
      <>
        <PreviousSubmittedSolutionWidget sessionId="stage-2" stageNumber={1} view="chat" onClose={vi.fn()} />
        <NotesWidget />
      </>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Copy submitted solution" }));
    await waitFor(() => expect(sentEvents()).toHaveLength(1));
    const notes = screen.getByPlaceholderText("Write your notes here...");
    notes.dispatchEvent(clipboardEvent("paste", { "text/plain": "my stage one answer" }));
    stopCapture();
    stopTracker();

    expect(writeText).toHaveBeenCalledWith("my stage one answer");
    const [copied, pasted] = sentEvents();
    expect(copied).toMatchObject({
      type: "clipboard_copy",
      source: "previous_solution",
      payload: { method: "button", length: 19 },
      content: "my stage one answer",
    });
    expect(pasted).toMatchObject({
      type: "clipboard_paste",
      source: "notes",
      payload: {
        origin: "internal",
        match: { clientEventId: copied.clientEventId, sessionId: "stage-2", source: "previous_solution", kind: "exact" },
      },
    });
  });
});
