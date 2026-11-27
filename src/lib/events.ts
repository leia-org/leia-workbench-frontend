import type { TestRunReportResult } from "../widgets/codeEditor/testRunReport";
import type { TestRunRecord, TestRunStatus } from "./testRuns";

// Session events as the backend returns them to instructors. Every tracked
// interaction of a student (a test run, a copy or paste, leaving the page) is
// one record with a type, the surface it happened on and a light payload.
// Pure: no I/O and no React.

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

export interface TestRunEventPayload {
  language: string;
  fnName: string;
  results: TestRunReportResult[];
  /** Suite-level failure (syntax error, timeout). */
  error: string | null;
  durationMs: number;
  status: TestRunStatus;
  passed: number;
  failed: number;
  total: number;
}

/** The earlier copy a pasted text was recognised as. */
export interface ClipboardMatch {
  clientEventId: string;
  sessionId: string;
  source: SessionEventSource;
  /** How the texts compare: identical, or identical once trimmed. */
  kind: "exact" | "trimmed";
  ageMs: number;
}

export interface ClipboardEventPayload {
  /** keyboard, menu, button or (pastes only) drop. */
  method: string;
  length: number;
  lines: number;
  hash: string;
  preview: string;
  wholeLine?: boolean;
  clipboardTypes?: string[];
  /** Pastes only: whether the text was copied inside the activity. */
  origin?: "internal" | "external";
  match?: ClipboardMatch | null;
}

export interface PageLeavePayload {
  /** hidden (tab or window no longer visible) or blur (focus lost). */
  reason: string;
}

export interface PageReturnPayload {
  awayMs: number;
  reason: string;
  becameHidden: boolean;
}

interface SessionEventBase {
  id: string;
  session: string;
  replication: string;
  run?: string | null;
  stageId?: string | null;
  stageIndex?: number | null;
  source: SessionEventSource;
  actor: SessionEventActor;
  view?: string | null;
  hasContent: boolean;
  contentTruncated: boolean;
  clientEventId: string;
  clientAt: string;
  /** Client-side counter: breaks ties between events of the same instant. */
  seq: number;
  /** When the event happened, corrected for the delay of batched delivery. */
  at: string;
  /** When the backend received it. */
  createdAt: string;
  reportedToLeiaAt?: string | null;
  /** Code of a test run or clipboard text. Only in a single-event response. */
  content?: string;
}

export interface TestRunEvent extends SessionEventBase {
  type: "test_run";
  payload: TestRunEventPayload;
}

export interface ClipboardEvent extends SessionEventBase {
  type: "clipboard_copy" | "clipboard_cut" | "clipboard_paste";
  payload: ClipboardEventPayload;
}

export interface PageLeaveEvent extends SessionEventBase {
  type: "page_leave";
  payload: PageLeavePayload;
}

export interface PageReturnEvent extends SessionEventBase {
  type: "page_return";
  payload: PageReturnPayload;
}

export type SessionEventRecord = TestRunEvent | ClipboardEvent | PageLeaveEvent | PageReturnEvent;

export const isTestRunEvent = (event: SessionEventRecord): event is TestRunEvent =>
  event.type === "test_run";

export const isClipboardEvent = (event: SessionEventRecord): event is ClipboardEvent =>
  event.type === "clipboard_copy" || event.type === "clipboard_cut" || event.type === "clipboard_paste";

// — labels ----------------------------------------------------------------

const humanize = (value: string): string => {
  const text = String(value ?? "").replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Unknown";
};

const EVENT_TYPE_LABELS: Record<SessionEventType, string> = {
  test_run: "Test run",
  clipboard_copy: "Copy",
  clipboard_cut: "Cut",
  clipboard_paste: "Paste",
  page_leave: "Left the page",
  page_return: "Returned to the page",
};

const EVENT_SOURCE_LABELS: Record<SessionEventSource, string> = {
  chat_input: "Chat input",
  code_editor: "Code editor",
  solution_editor: "Solution editor",
  notes: "Notes",
  previous_solution: "Previous solution",
  page: "Page",
  other: "Other",
};

const CLIPBOARD_METHOD_LABELS: Record<string, string> = {
  keyboard: "Keyboard",
  menu: "Context menu",
  button: "Button",
  drop: "Drag and drop",
};

const lookup = (labels: Record<string, string>, key: string): string =>
  Object.prototype.hasOwnProperty.call(labels, key) ? labels[key] : humanize(key);

export const eventTypeLabel = (type: string): string => lookup(EVENT_TYPE_LABELS, type);

export const eventSourceLabel = (source: string): string => lookup(EVENT_SOURCE_LABELS, source);

export const clipboardMethodLabel = (method: string): string => lookup(CLIPBOARD_METHOD_LABELS, method);

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** "120 chars · 4 lines". */
export function describeClipboardSize(payload: Pick<ClipboardEventPayload, "length" | "lines">): string {
  return `${plural(payload?.length ?? 0, "char")} · ${plural(payload?.lines ?? 0, "line")}`;
}

/** "Pasted 120 chars in Chat input", "Copied 80 chars from Code editor". */
export function describeClipboardEvent(event: ClipboardEvent): string {
  const size = plural(event.payload?.length ?? 0, "char");
  const surface = eventSourceLabel(event.source);
  if (event.type === "clipboard_paste") return `Pasted ${size} in ${surface}`;
  return `${event.type === "clipboard_cut" ? "Cut" : "Copied"} ${size} from ${surface}`;
}

/** "42 s", "2 min 5 s", "1 h 3 min". */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  if (minutes < 60) return restSeconds ? `${minutes} min ${restSeconds} s` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours} h ${restMinutes} min` : `${hours} h`;
}

// — counters --------------------------------------------------------------

/** Number of events of a session by type, as lists and the socket carry them. */
export type EventCounts = { [type: string]: number | undefined };

/** The filters of the instructor's Events section. */
export type EventGroup = "tests" | "clipboard" | "away";

export const EVENT_GROUPS: EventGroup[] = ["tests", "clipboard", "away"];

export const EVENT_GROUP_LABELS: Record<EventGroup, string> = {
  tests: "Tests",
  clipboard: "Clipboard",
  away: "Away",
};

export type EventGroupCounts = Record<EventGroup, number> & { total: number };

const count = (counts: EventCounts | null | undefined, type: SessionEventType): number => {
  const value = counts?.[type];
  return typeof value === "number" && value > 0 ? value : 0;
};

export function hasAnyEvents(counts?: EventCounts | null): boolean {
  return Object.values(counts ?? {}).some((value) => typeof value === "number" && value > 0);
}

// Per-type counters turned into what the instructor sees. An absence is one
// item although it is stored as two events, so it is counted by its leave.
export function countEventGroups(counts?: EventCounts | null): EventGroupCounts {
  const tests = count(counts, "test_run");
  const clipboard =
    count(counts, "clipboard_copy") + count(counts, "clipboard_cut") + count(counts, "clipboard_paste");
  const away = count(counts, "page_leave");
  return { tests, clipboard, away, total: tests + clipboard + away };
}

// Counters can arrive out of order (socket batches, a refresh in between), so
// merging keeps the highest value seen for each type and never goes down.
export function mergeEventCounts(
  current?: EventCounts | null,
  incoming?: EventCounts | null,
): EventCounts {
  const merged: EventCounts = { ...(current ?? {}) };
  for (const [type, value] of Object.entries(incoming ?? {})) {
    if (typeof value !== "number") continue;
    merged[type] = Math.max(value, merged[type] ?? 0);
  }
  return merged;
}

/** Adds up the counters of several sessions (the stages of one attempt). */
export function sumEventCounts(list: Array<EventCounts | null | undefined>): EventCounts {
  const total: EventCounts = {};
  for (const counts of list) {
    for (const [type, value] of Object.entries(counts ?? {})) {
      if (typeof value === "number") total[type] = (total[type] ?? 0) + value;
    }
  }
  return total;
}

// — ordering --------------------------------------------------------------

const toTime = (value: string | undefined | null): number => {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
};

const eventTime = (event: Pick<SessionEventRecord, "at" | "createdAt">): number =>
  toTime(event.at ?? event.createdAt);

// By the time they happened, then by the client's counter. Events without a
// usable time go last (`Infinity - Infinity` is NaN, which falls to `seq`).
const byTimeThenSeq = <T extends { time: number; seq: number }>(a: T, b: T): number =>
  a.time - b.time || a.seq - b.seq;

const compareEvents = (a: SessionEventRecord, b: SessionEventRecord): number =>
  byTimeThenSeq({ time: eventTime(a), seq: a.seq ?? 0 }, { time: eventTime(b), seq: b.seq ?? 0 });

// Adds events received live to a session's list: no duplicates (the same
// event can arrive by socket and by a fetch), chronological, optionally capped
// to the most recent ones. Returns the same list when nothing is new.
export function appendLiveEvents(
  events: SessionEventRecord[] | undefined | null,
  incoming: SessionEventRecord[] | undefined | null,
  maxLength?: number,
): SessionEventRecord[] {
  const current = events ?? [];
  const known = new Set(current.map((event) => event.id));
  const fresh: SessionEventRecord[] = [];
  for (const event of incoming ?? []) {
    if (!event || known.has(event.id)) continue;
    known.add(event.id);
    fresh.push(event);
  }
  if (fresh.length === 0) return current;
  const merged = [...current, ...fresh].sort(compareEvents);
  return typeof maxLength === "number" && merged.length > maxLength ? merged.slice(-maxLength) : merged;
}

// — presence --------------------------------------------------------------

/** One absence: the student left the page and (usually) came back. */
export interface AwayInterval {
  /** The leave event's id, or the return's when the leave was not recorded. */
  id: string;
  leaveEvent: PageLeaveEvent | null;
  returnEvent: PageReturnEvent | null;
  startAt: string;
  /** Null when no return was recorded (tab closed, or still away). */
  endAt: string | null;
  /** Null when no return was recorded. */
  awayMs: number | null;
  seq: number;
  reason: string;
  /** The tab or window stopped being visible, not only lost the focus. */
  becameHidden: boolean;
}

const openInterval = (leave: PageLeaveEvent): AwayInterval => ({
  id: leave.id,
  leaveEvent: leave,
  returnEvent: null,
  startAt: leave.at,
  endAt: null,
  awayMs: null,
  seq: leave.seq ?? 0,
  reason: leave.payload?.reason ?? "",
  becameHidden: leave.payload?.reason === "hidden",
});

function closedInterval(leave: PageLeaveEvent | null, back: PageReturnEvent): AwayInterval {
  const endTime = eventTime(back);
  const reported = back.payload?.awayMs;
  // The duration the browser measured is exact; the two timestamps are only
  // an estimate, since each batch is dated on arrival.
  const measured = typeof reported === "number" && Number.isFinite(reported) && reported >= 0 ? reported : null;
  const reason = leave?.payload?.reason ?? back.payload?.reason ?? "";
  const shared = {
    returnEvent: back,
    endAt: back.at,
    reason,
    becameHidden: back.payload?.becameHidden === true || reason === "hidden",
  };

  if (leave) {
    const elapsed = endTime - eventTime(leave);
    return {
      ...shared,
      id: leave.id,
      leaveEvent: leave,
      startAt: leave.at,
      awayMs: measured ?? (Number.isFinite(elapsed) ? Math.max(0, elapsed) : null),
      seq: leave.seq ?? 0,
    };
  }
  // A return whose leave is missing (lost, or over the session's cap).
  return {
    ...shared,
    id: back.id,
    leaveEvent: null,
    startAt:
      measured !== null && Number.isFinite(endTime) ? new Date(endTime - measured).toISOString() : back.at,
    awayMs: measured,
    seq: back.seq ?? 0,
  };
}

// Pairs each `page_leave` with the `page_return` that follows it. A leave
// with no return stays open; a second leave in a row closes nothing and opens
// a new interval. Other event types are ignored.
export function pairAwayIntervals(events: SessionEventRecord[] | undefined | null): AwayInterval[] {
  const intervals: AwayInterval[] = [];
  let open: PageLeaveEvent | null = null;

  for (const event of [...(events ?? [])].sort(compareEvents)) {
    if (event.type === "page_leave") {
      if (open) intervals.push(openInterval(open));
      open = event;
    } else if (event.type === "page_return") {
      intervals.push(closedInterval(open, event));
      open = null;
    }
  }
  if (open) intervals.push(openInterval(open));
  return intervals;
}

/** "Away 42 s", or "Left the page" when no return was recorded. */
export const describeAway = (interval: AwayInterval): string =>
  interval.awayMs === null ? "Left the page" : `Away ${formatDuration(interval.awayMs)}`;

export const awayReasonLabel = (interval: AwayInterval): string =>
  interval.becameHidden ? "Tab hidden" : "Focus lost";

// — what the instructor sees ----------------------------------------------

/** One entry of the Events section, in the order things happened. */
export type EventListItem =
  | { kind: "test_run"; id: string; group: "tests"; event: TestRunEvent; number: number }
  | { kind: "clipboard"; id: string; group: "clipboard"; event: ClipboardEvent }
  | { kind: "away"; id: string; group: "away"; interval: AwayInterval };

// Events as listed to the instructor: test runs numbered in order, clipboard
// events, and absences as one paired entry placed where the student left.
export function buildEventItems(events: SessionEventRecord[] | undefined | null): EventListItem[] {
  const entries: Array<{ time: number; seq: number; item: EventListItem }> = [];

  for (const event of events ?? []) {
    if (isTestRunEvent(event)) {
      entries.push({
        time: eventTime(event),
        seq: event.seq ?? 0,
        item: { kind: "test_run", id: event.id, group: "tests", event, number: 0 },
      });
    } else if (isClipboardEvent(event)) {
      entries.push({
        time: eventTime(event),
        seq: event.seq ?? 0,
        item: { kind: "clipboard", id: event.id, group: "clipboard", event },
      });
    }
  }
  for (const interval of pairAwayIntervals(events)) {
    entries.push({
      time: toTime(interval.startAt),
      seq: interval.seq,
      item: { kind: "away", id: interval.id, group: "away", interval },
    });
  }

  entries.sort(byTimeThenSeq);
  let runNumber = 0;
  return entries.map(({ item }) => (item.kind === "test_run" ? { ...item, number: ++runNumber } : item));
}

/** Absences shorter than this are listed but not marked in the transcript. */
export const AWAY_MARKER_MIN_MS = 5000;

/** An event shown inside a transcript at the moment it happened. */
export type TimelineMarker =
  | { kind: "event"; key: string; event: TestRunEvent | ClipboardEvent }
  | { kind: "away"; key: string; interval: AwayInterval };

export type TimelineItem<M> = { kind: "message"; key: string; message: M } | TimelineMarker;

/** Id of the Events section entry a transcript marker points to. */
export const markerTargetId = (marker: TimelineMarker): string =>
  marker.kind === "away" ? marker.interval.id : marker.event.id;

// Interleaves events into a transcript. Messages keep the order they came in;
// each event goes right before the first message sent after it. Test runs and
// clipboard events are all marked; absences only from `minAwayMs` up, and only
// once the return is known.
export function buildTimeline<M extends { id: string; timestamp: string }>(
  messages: M[],
  events: SessionEventRecord[] | undefined | null = [],
  options: { minAwayMs?: number } = {},
): TimelineItem<M>[] {
  const minAwayMs = options.minAwayMs ?? AWAY_MARKER_MIN_MS;
  const markers: Array<{ time: number; marker: TimelineMarker }> = [];

  for (const item of buildEventItems(events)) {
    if (item.kind === "away") {
      const { interval } = item;
      if (interval.awayMs === null || interval.awayMs < minAwayMs) continue;
      markers.push({
        time: toTime(interval.startAt),
        marker: { kind: "away", key: `away-${interval.id}`, interval },
      });
    } else {
      markers.push({
        time: eventTime(item.event),
        marker: { kind: "event", key: `event-${item.event.id}`, event: item.event },
      });
    }
  }

  const items: TimelineItem<M>[] = [];
  let next = 0;
  for (const message of messages) {
    const messageTime = toTime(message.timestamp);
    while (next < markers.length && markers[next].time < messageTime) {
      items.push(markers[next].marker);
      next++;
    }
    items.push({ kind: "message", key: `msg-${message.id}`, message });
  }
  for (; next < markers.length; next++) items.push(markers[next].marker);
  return items;
}

// — test runs -------------------------------------------------------------

// A `test_run` event in the shape the test run card was written for. `code`
// is only set when the event was fetched on its own.
export function toTestRunRecord(event: TestRunEvent): TestRunRecord {
  const payload: Partial<TestRunEventPayload> = event.payload ?? {};
  return {
    id: event.id,
    session: event.session,
    trigger: event.actor === "leia" ? "leia" : "student",
    language: payload.language ?? "",
    fnName: payload.fnName ?? "",
    code: event.content,
    codeTruncated: event.contentTruncated === true,
    status: payload.status ?? "error",
    passed: payload.passed ?? 0,
    failed: payload.failed ?? 0,
    total: payload.total ?? 0,
    results: Array.isArray(payload.results) ? payload.results : [],
    error: payload.error ?? null,
    durationMs: payload.durationMs ?? 0,
    clientRunAt: event.clientAt,
    reportedToLeiaAt: event.reportedToLeiaAt ?? null,
    createdAt: event.at ?? event.createdAt,
  };
}
