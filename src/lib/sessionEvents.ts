import type { TestRunReport } from "../widgets/codeEditor/testRunReport";

// Student side of the generic `events` collection: every tracked interaction
// (a test run, a copy or paste, leaving the page) is queued here and sent to
// the backend in batches. Best effort by design: nothing in this module may
// throw or delay the student, and a backend that does not offer the feature
// (404) silences it for that session.
//
// The session id travels with each queued event, not with the tracker, so a
// stage change or the move from the chat to /edit never mixes sessions.

export type SessionEventType =
  | "test_run"
  | "clipboard_copy"
  | "clipboard_cut"
  | "clipboard_paste"
  | "page_leave"
  | "page_return";

export type SessionEventSource =
  | "chat_input"
  | "code_editor"
  | "solution_editor"
  | "notes"
  | "previous_solution"
  | "page"
  | "other";

export type SessionEventActor = "student" | "leia";
export type SessionEventView = "chat" | "edit";

export interface SessionEventInput {
  type: SessionEventType;
  source: SessionEventSource;
  /** Defaults to the student. */
  actor?: SessionEventActor;
  /** Light, JSON-safe facts about the event. */
  payload?: Record<string, unknown>;
  /** Heavy text (code under test, clipboard text). Sent without batching. */
  content?: string;
  /** The caller already cut `content`. */
  contentTruncated?: boolean;
  /** Send right away instead of waiting for the batch window. */
  urgent?: boolean;
  /** Defaults to a fresh id. Makes a resent event idempotent on the server. */
  clientEventId?: string;
  /** When it happened, if not right now. */
  clientAt?: Date | number | string;
}

export interface SessionEventsStartOptions {
  view: SessionEventView;
  /** false: only functional events (test runs) are sent, e.g. the student
   *  declined the data usage consent. */
  observe: boolean;
}

/** One event as the backend receives it. */
export interface SessionEventWire {
  clientEventId: string;
  type: SessionEventType;
  source: SessionEventSource;
  actor: SessionEventActor;
  view: SessionEventView;
  clientAt: string;
  seq: number;
  payload?: Record<string, unknown>;
  content?: string;
  contentTruncated?: boolean;
}

export interface SessionEventsResponse {
  status: number;
  json?: () => Promise<unknown>;
}

export interface SessionEventsDeps {
  fetch: (url: string, init: RequestInit) => Promise<SessionEventsResponse>;
  baseUrl: () => string;
  now: () => number;
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  randomId: () => string;
  /** Subscribes to "the page is being hidden or unloaded". */
  onPageHide: (listener: () => void) => () => void;
  warn: (...args: unknown[]) => void;
}

export interface SessionEventsTracker {
  /** Starts accepting events of a session. Reference counted: the session is
   *  dropped when every returned stop function has been called. */
  start(sessionId: string, options: SessionEventsStartOptions): () => void;
  /** Queues an event. Never throws; returns its `clientEventId`. */
  track(sessionId: string, input: SessionEventInput): string;
  /** Sends what is queued. `unload`: the page may be going away, so favour
   *  requests that outlive it. Resolves when the requests in flight settle. */
  flush(options?: { unload?: boolean }): Promise<void>;
  /** Whether `track` would currently keep an event of this type. */
  accepts(sessionId: string, type: SessionEventType): boolean;
}

// Server-side limits (see the backend's eventTypes and eventsBodyParser).
export const MAX_CONTENT_LENGTH = 60000;
export const REQUEST_MAX_EVENTS = 50;
// Batch window: whichever comes first.
export const BATCH_DELAY_MS = 2000;
export const BATCH_MAX_EVENTS = 20;
export const BATCH_MAX_BYTES = 250000;
// Browsers cap the bodies of all pending keepalive requests at 64 kB.
export const KEEPALIVE_BUDGET_BYTES = 60000;
export const RETRY_DELAY_MS = 1500;
export const REQUEST_TIMEOUT_MS = 15000;

// `{"sentAt":"…","events":[]}` around the events of a request.
const ENVELOPE_BYTES = 64;

interface SessionState {
  refs: number;
  view: SessionEventView;
  observe: boolean;
}

interface QueuedEvent {
  sessionId: string;
  event: SessionEventWire;
  bytes: number;
  attempts: number;
  sending: boolean;
  /** Not sent again before this moment (backoff after a failed attempt). */
  notBefore: number;
}

type SendOutcome = "done" | "retry" | "disable";

const noop = () => undefined;

const byteLength = (text: string): number => new TextEncoder().encode(text).length;

function defaultRandomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch { /* not available in insecure contexts */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function defaultOnPageHide(listener: () => void): () => void {
  if (typeof document === "undefined" || typeof window === "undefined") return noop;
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") listener();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", listener);
  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", listener);
  };
}

const defaultDeps: SessionEventsDeps = {
  fetch: (url, init) => fetch(url, init),
  baseUrl: () => import.meta.env.VITE_APP_BACKEND,
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  randomId: defaultRandomId,
  onPageHide: defaultOnPageHide,
  warn: (...args) => console.warn(...args),
};

function toIso(value: Date | number | string | undefined, fallback: number): string {
  const date = value === undefined ? new Date(fallback) : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(fallback).toISOString() : date.toISOString();
}

// Cuts without leaving half of a surrogate pair at the end.
function cutText(text: string, maxLength: number): string {
  const cut = text.slice(0, maxLength);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/** Spreads a test run report of the code editor over an event: the code goes
 *  to `content`, who started it to `actor`, the outcome to `payload`. */
export function testRunEventInput(report: TestRunReport): SessionEventInput {
  return {
    type: "test_run",
    source: "code_editor",
    actor: report.trigger,
    clientEventId: report.clientRunId,
    clientAt: report.clientRunAt,
    payload: {
      language: report.language,
      fnName: report.fnName,
      results: report.results,
      error: report.error,
      durationMs: report.durationMs,
    },
    content: report.code,
    contentTruncated: report.codeTruncated,
  };
}

export function createSessionEventsTracker(overrides: Partial<SessionEventsDeps> = {}): SessionEventsTracker {
  const deps: SessionEventsDeps = { ...defaultDeps, ...overrides };

  const sessions = new Map<string, SessionState>();
  // Sessions the backend answered 404 for. Kept for the life of the page.
  const disabled = new Set<string>();
  const counters = new Map<string, number>();
  const inFlight = new Set<Promise<void>>();
  let queue: QueuedEvent[] = [];
  let batchTimer: unknown = null;
  let keepaliveBytes = 0;
  let stopPageHide: (() => void) | null = null;

  function accepts(sessionId: string, type: SessionEventType): boolean {
    const session = sessions.get(sessionId);
    if (!session || disabled.has(sessionId)) return false;
    return session.observe || type === "test_run";
  }

  function nextSeq(sessionId: string): number {
    const seq = counters.get(sessionId) ?? 0;
    counters.set(sessionId, seq + 1);
    return seq;
  }

  function buildEvent(sessionId: string, view: SessionEventView, input: SessionEventInput, id: string): SessionEventWire {
    const event: SessionEventWire = {
      clientEventId: id,
      type: input.type,
      source: input.source,
      actor: input.actor ?? "student",
      view,
      clientAt: toIso(input.clientAt, deps.now()),
      seq: nextSeq(sessionId),
    };
    let payload = input.payload ? { ...input.payload } : undefined;
    if (typeof input.content === "string") {
      let content = input.content;
      let truncated = input.contentTruncated === true;
      if (content.length > MAX_CONTENT_LENGTH) {
        // The original length survives the cut.
        payload = { ...payload, length: typeof payload?.length === "number" ? payload.length : content.length };
        content = cutText(content, MAX_CONTENT_LENGTH);
        truncated = true;
      }
      event.content = content;
      if (truncated) event.contentTruncated = true;
    }
    if (payload) event.payload = payload;
    return event;
  }

  function clearBatchTimer() {
    if (batchTimer === null) return;
    deps.clearTimeout(batchTimer);
    batchTimer = null;
  }

  function scheduleBatch() {
    if (batchTimer !== null) return;
    batchTimer = deps.setTimeout(() => {
      batchTimer = null;
      void flush();
    }, BATCH_DELAY_MS);
  }

  function remove(items: QueuedEvent[]) {
    const gone = new Set(items);
    queue = queue.filter((item) => !gone.has(item));
  }

  // Requests of one session: at most 50 events each and, unless a single
  // event is bigger on its own, at most `maxBytes`.
  function chunk(items: QueuedEvent[], maxBytes: number): QueuedEvent[][] {
    const chunks: QueuedEvent[][] = [];
    let current: QueuedEvent[] = [];
    let bytes = ENVELOPE_BYTES;
    for (const item of items) {
      const full = current.length >= REQUEST_MAX_EVENTS || bytes + item.bytes + 1 > maxBytes;
      if (current.length > 0 && full) {
        chunks.push(current);
        current = [];
        bytes = ENVELOPE_BYTES;
      }
      current.push(item);
      bytes += item.bytes + 1;
    }
    if (current.length > 0) chunks.push(current);
    return chunks;
  }

  async function post(sessionId: string, body: string, keepalive: boolean): Promise<SendOutcome> {
    const url = `${deps.baseUrl()}/api/v1/interactions/${encodeURIComponent(sessionId)}/events`;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = controller ? deps.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
    try {
      const response = await deps.fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive,
        ...(controller ? { signal: controller.signal } : {}),
      });
      // Feature switched off, or the session does not exist.
      if (response.status === 404) return "disable";
      if (response.status >= 500) return "retry";
      if (response.status >= 400) {
        // Consent pending, finished session, malformed batch: retrying
        // cannot help.
        deps.warn("Session events were not recorded", response.status);
        return "done";
      }
      await reportRejected(response);
      return "done";
    } catch {
      return "retry";
    } finally {
      if (timeout !== null) deps.clearTimeout(timeout);
    }
  }

  // The answer carries one verdict per event; all of them are final. A
  // rejection is only worth a console line (ids and reasons, never content).
  async function reportRejected(response: SessionEventsResponse) {
    try {
      const data = (await response.json?.()) as { results?: Array<{ clientEventId?: string; status?: string; reason?: string }> } | undefined;
      const rejected = (data?.results ?? []).filter((result) => result?.status === "rejected");
      if (rejected.length > 0) {
        deps.warn("Session events rejected", rejected.map(({ clientEventId, reason }) => ({ clientEventId, reason })));
      }
    } catch { /* an unreadable answer changes nothing */ }
  }

  function send(sessionId: string, items: QueuedEvent[]) {
    for (const item of items) item.sending = true;
    const body = JSON.stringify({
      sentAt: new Date(deps.now()).toISOString(),
      events: items.map((item) => item.event),
    });
    const bytes = ENVELOPE_BYTES + items.reduce((total, item) => total + item.bytes + 1, 0);
    // A keepalive request survives the page being closed, so every request
    // that fits in what is left of the browser's budget is sent that way.
    const keepalive = keepaliveBytes + bytes <= KEEPALIVE_BUDGET_BYTES;
    if (keepalive) keepaliveBytes += bytes;

    const request: Promise<void> = post(sessionId, body, keepalive)
      .then((outcome) => {
        if (outcome === "disable") {
          disabled.add(sessionId);
          queue = queue.filter((item) => item.sessionId !== sessionId);
          return;
        }
        if (outcome === "done") {
          remove(items);
          return;
        }
        const again = items.filter((item) => item.attempts === 0);
        const lost = items.filter((item) => item.attempts > 0);
        if (lost.length > 0) {
          deps.warn(`${lost.length} session event(s) could not be recorded`);
          remove(lost);
        }
        if (again.length > 0) {
          const notBefore = deps.now() + RETRY_DELAY_MS;
          for (const item of again) {
            item.attempts = 1;
            item.sending = false;
            item.notBefore = notBefore;
          }
          deps.setTimeout(() => void flush(), RETRY_DELAY_MS);
        }
      })
      .catch(noop)
      .finally(() => {
        if (keepalive) keepaliveBytes -= bytes;
        inFlight.delete(request);
      });
    inFlight.add(request);
  }

  function flush(options: { unload?: boolean } = {}): Promise<void> {
    try {
      const unload = options.unload === true;
      const now = deps.now();
      // Whatever stays behind is in backoff and has its own timer.
      clearBatchTimer();
      // On unload nothing waits for its backoff: there is no later.
      const ready = queue.filter((item) => !item.sending && (unload || item.notBefore <= now));

      const bySession = new Map<string, QueuedEvent[]>();
      for (const item of ready) {
        const items = bySession.get(item.sessionId);
        if (items) items.push(item);
        else bySession.set(item.sessionId, [item]);
      }
      // On unload, smaller requests so that as many as possible fit in the
      // keepalive budget.
      const maxBytes = unload ? KEEPALIVE_BUDGET_BYTES : BATCH_MAX_BYTES;
      for (const [sessionId, items] of bySession) {
        for (const part of chunk(items, maxBytes)) send(sessionId, part);
      }
    } catch (error) {
      deps.warn("Session events could not be sent", error);
    }
    return Promise.allSettled([...inFlight]).then(noop);
  }

  function track(sessionId: string, input: SessionEventInput): string {
    let id = "";
    try {
      id = input.clientEventId || deps.randomId();
      const session = sessions.get(sessionId);
      if (!session || !accepts(sessionId, input.type)) return id;

      const event = buildEvent(sessionId, session.view, input, id);
      queue.push({
        sessionId,
        event,
        bytes: byteLength(JSON.stringify(event)),
        attempts: 0,
        sending: false,
        notBefore: 0,
      });

      const waiting = queue.filter((item) => !item.sending);
      const waitingBytes = waiting.reduce((total, item) => total + item.bytes, 0);
      const immediate =
        input.urgent === true ||
        event.content !== undefined ||
        waiting.length >= BATCH_MAX_EVENTS ||
        waitingBytes >= BATCH_MAX_BYTES;
      if (immediate) void flush();
      else scheduleBatch();
    } catch (error) {
      deps.warn("Session event could not be tracked", error);
    }
    return id;
  }

  function start(sessionId: string, options: SessionEventsStartOptions): () => void {
    if (!sessionId) return noop;
    const existing = sessions.get(sessionId);
    if (existing) {
      existing.refs += 1;
      existing.view = options.view;
      existing.observe = options.observe;
    } else {
      sessions.set(sessionId, { refs: 1, view: options.view, observe: options.observe });
    }
    if (!stopPageHide) {
      try {
        stopPageHide = deps.onPageHide(() => void flush({ unload: true }));
      } catch { /* without the listener, batches still go out on their own */ }
    }

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      const session = sessions.get(sessionId);
      if (!session) return;
      session.refs -= 1;
      if (session.refs > 0) return;
      sessions.delete(sessionId);
      // What was tracked while it ran is still owed to the server.
      void flush({ unload: true });
      if (sessions.size === 0 && stopPageHide) {
        try { stopPageHide(); } catch { /* ignore */ }
        stopPageHide = null;
      }
    };
  }

  return { start, track, flush, accepts };
}

/** The tracker of the student views. */
export const sessionEvents = createSessionEventsTracker();
