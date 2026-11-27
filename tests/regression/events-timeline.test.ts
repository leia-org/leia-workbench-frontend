import { describe, expect, test } from 'vitest';
import {
  appendLiveEvents,
  buildEventItems,
  buildTimeline,
  countEventGroups,
  describeAway,
  describeClipboardEvent,
  formatDuration,
  hasAnyEvents,
  markerTargetId,
  mergeEventCounts,
  pairAwayIntervals,
  sumEventCounts,
  toTestRunRecord,
  type ClipboardEvent,
  type PageLeaveEvent,
  type PageReturnEvent,
  type SessionEventRecord,
  type TestRunEvent,
} from '../../src/lib/events';
import { isPreviewHost } from '../../src/lib/features';

const base = (id: string, at: string, seq = 0) => ({
  id,
  session: 's1',
  replication: 'rep-1',
  actor: 'student' as const,
  hasContent: false,
  contentTruncated: false,
  clientEventId: `client-${id}`,
  clientAt: at,
  seq,
  at,
  createdAt: at,
});

const testRun = (id: string, at: string, overrides: Partial<TestRunEvent> = {}): TestRunEvent => ({
  ...base(id, at),
  type: 'test_run',
  source: 'code_editor',
  hasContent: true,
  payload: {
    language: 'javascript',
    fnName: 'twoSum',
    results: [
      { name: 'basic', ok: true },
      { name: 'empty', ok: false, expected: '[]', actual: 'undefined' },
    ],
    error: null,
    durationMs: 12,
    status: 'failed',
    passed: 1,
    failed: 1,
    total: 2,
  },
  ...overrides,
});

const paste = (id: string, at: string, overrides: Partial<ClipboardEvent> = {}): ClipboardEvent => ({
  ...base(id, at),
  type: 'clipboard_paste',
  source: 'chat_input',
  hasContent: true,
  payload: {
    method: 'keyboard',
    length: 120,
    lines: 4,
    hash: 'abc',
    preview: 'function twoSum',
    origin: 'external',
  },
  ...overrides,
});

const leave = (id: string, at: string, reason = 'hidden', seq = 0): PageLeaveEvent => ({
  ...base(id, at, seq),
  type: 'page_leave',
  source: 'page',
  payload: { reason },
});

const back = (
  id: string,
  at: string,
  awayMs: number | undefined,
  overrides: Partial<PageReturnEvent['payload']> = {},
  seq = 0,
): PageReturnEvent => ({
  ...base(id, at, seq),
  type: 'page_return',
  source: 'page',
  payload: { awayMs: awayMs as number, reason: 'hidden', becameHidden: true, ...overrides },
});

const messages = [
  { id: 'm1', timestamp: '2026-11-26T10:00:00.000Z' },
  { id: 'm2', timestamp: '2026-11-26T10:05:00.000Z' },
  { id: 'm3', timestamp: '2026-11-26T10:10:00.000Z' },
];

const keys = (items: Array<{ key: string }>) => items.map((item) => item.key);

describe('buildTimeline — event markers inside a transcript', () => {
  test('places each event right before the first later message, whatever its type', () => {
    const timeline = buildTimeline(messages, [
      testRun('late', '2026-11-26T10:20:00.000Z'),
      paste('between', '2026-11-26T10:07:00.000Z'),
      testRun('first', '2026-11-26T09:59:00.000Z'),
    ]);

    expect(keys(timeline)).toEqual([
      'event-first',
      'msg-m1',
      'msg-m2',
      'event-between',
      'msg-m3',
      'event-late',
    ]);
  });

  test('keeps the transcript untouched when there are no events', () => {
    expect(keys(buildTimeline(messages))).toEqual(['msg-m1', 'msg-m2', 'msg-m3']);
    expect(buildTimeline(messages, []).every((item) => item.kind === 'message')).toBe(true);
    expect(keys(buildTimeline(messages, null))).toEqual(['msg-m1', 'msg-m2', 'msg-m3']);
  });

  test('shows the events even when the session has no messages', () => {
    const timeline = buildTimeline([], [testRun('a', '2026-11-26T10:00:00.000Z')]);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].kind).toBe('event');
  });

  test('an event at the same instant as a message goes after it', () => {
    const timeline = buildTimeline(messages, [paste('same', '2026-11-26T10:05:00.000Z')]);
    expect(keys(timeline)).toEqual(['msg-m1', 'msg-m2', 'event-same', 'msg-m3']);
  });

  test('orders events by the time they happened and then by the client counter', () => {
    const at = '2026-11-26T10:07:00.000Z';
    const timeline = buildTimeline(messages, [
      paste('third', at, { seq: 9 }),
      testRun('later', '2026-11-26T10:08:00.000Z', { seq: 1 }),
      paste('first', at, { seq: 3 }),
      paste('second', at, { seq: 4 }),
    ]);

    expect(keys(timeline)).toEqual([
      'msg-m1',
      'msg-m2',
      'event-first',
      'event-second',
      'event-third',
      'event-later',
      'msg-m3',
    ]);
  });

  test('marks an absence of 5 s or more where the student left, as one paired marker', () => {
    const timeline = buildTimeline(messages, [
      leave('l1', '2026-11-26T10:06:00.000Z'),
      back('r1', '2026-11-26T10:06:42.000Z', 42000),
    ]);

    expect(keys(timeline)).toEqual(['msg-m1', 'msg-m2', 'away-l1', 'msg-m3']);
    const marker = timeline[2];
    expect(marker.kind).toBe('away');
    if (marker.kind !== 'away') throw new Error('expected an away marker');
    expect(marker.interval.awayMs).toBe(42000);
    expect(markerTargetId(marker)).toBe('l1');
  });

  test('leaves out short absences and those with no return, and never marks raw page events', () => {
    const timeline = buildTimeline(messages, [
      leave('short', '2026-11-26T10:01:00.000Z'),
      back('short-back', '2026-11-26T10:01:04.000Z', 4999),
      leave('exact', '2026-11-26T10:02:00.000Z'),
      back('exact-back', '2026-11-26T10:02:05.000Z', 5000),
      leave('open', '2026-11-26T10:11:00.000Z'),
    ]);

    expect(keys(timeline)).toEqual(['msg-m1', 'away-exact', 'msg-m2', 'msg-m3']);
  });

  test('the threshold for absences can be changed', () => {
    const events = [leave('l', '2026-11-26T10:01:00.000Z'), back('r', '2026-11-26T10:01:02.000Z', 2000)];
    expect(keys(buildTimeline(messages, events, { minAwayMs: 1000 }))).toContain('away-l');
    expect(keys(buildTimeline(messages, events))).not.toContain('away-l');
  });
});

describe('appendLiveEvents — events arriving over the socket', () => {
  test('appends in chronological order, a whole batch at once', () => {
    const events = appendLiveEvents(
      [paste('b', '2026-11-26T10:02:00.000Z')],
      [testRun('c', '2026-11-26T10:03:00.000Z'), paste('a', '2026-11-26T10:01:00.000Z')],
    );
    expect(events.map((event) => event.id)).toEqual(['a', 'b', 'c']);
  });

  test('breaks ties of the same instant with the client counter', () => {
    const at = '2026-11-26T10:02:00.000Z';
    const events = appendLiveEvents([paste('second', at, { seq: 2 })], [paste('first', at, { seq: 1 })]);
    expect(events.map((event) => event.id)).toEqual(['first', 'second']);
  });

  test('ignores events that are already listed and keeps the same list', () => {
    const current = [paste('a', '2026-11-26T10:01:00.000Z')];
    expect(appendLiveEvents(current, [paste('a', '2026-11-26T10:01:00.000Z')])).toBe(current);
    expect(appendLiveEvents(current, [])).toBe(current);
    expect(appendLiveEvents(current, undefined)).toBe(current);
  });

  test('does not repeat an event that comes twice in the same batch', () => {
    const event = paste('a', '2026-11-26T10:01:00.000Z');
    expect(appendLiveEvents([], [event, event])).toHaveLength(1);
  });

  test('starts a list and keeps only the most recent events when capped', () => {
    expect(appendLiveEvents(undefined, [paste('a', '2026-11-26T10:01:00.000Z')])).toHaveLength(1);

    let events: SessionEventRecord[] = [];
    for (let i = 0; i < 7; i++) {
      events = appendLiveEvents(events, [paste(`e${i}`, `2026-11-26T10:0${i}:00.000Z`)], 5);
    }
    expect(events.map((event) => event.id)).toEqual(['e2', 'e3', 'e4', 'e5', 'e6']);
  });
});

describe('pairAwayIntervals — leaving the page and coming back', () => {
  test('pairs a leave with the return that follows, using the measured duration', () => {
    const intervals = pairAwayIntervals([
      leave('l1', '2026-11-26T10:00:00.000Z', 'blur'),
      // The two timestamps are 50 s apart; the browser measured 42 s.
      back('r1', '2026-11-26T10:00:50.000Z', 42000, { reason: 'blur', becameHidden: false }),
    ]);

    expect(intervals).toHaveLength(1);
    expect(intervals[0]).toMatchObject({
      id: 'l1',
      startAt: '2026-11-26T10:00:00.000Z',
      endAt: '2026-11-26T10:00:50.000Z',
      awayMs: 42000,
      reason: 'blur',
      becameHidden: false,
    });
    expect(intervals[0].leaveEvent?.id).toBe('l1');
    expect(intervals[0].returnEvent?.id).toBe('r1');
    expect(describeAway(intervals[0])).toBe('Away 42 s');
  });

  test('falls back to the timestamps when the return carries no duration', () => {
    const [interval] = pairAwayIntervals([
      leave('l1', '2026-11-26T10:00:00.000Z'),
      back('r1', '2026-11-26T10:02:05.000Z', undefined),
    ]);
    expect(interval.awayMs).toBe(125000);
    expect(describeAway(interval)).toBe('Away 2 min 5 s');
  });

  test('sorts the events first, so the order they arrive in does not matter', () => {
    const intervals = pairAwayIntervals([
      back('r2', '2026-11-26T10:10:30.000Z', 30000),
      leave('l1', '2026-11-26T10:00:00.000Z'),
      leave('l2', '2026-11-26T10:10:00.000Z'),
      back('r1', '2026-11-26T10:00:10.000Z', 10000),
    ]);
    expect(intervals.map((interval) => [interval.id, interval.awayMs])).toEqual([
      ['l1', 10000],
      ['l2', 30000],
    ]);
  });

  test('a leave and its return in the same instant pair by the client counter', () => {
    const at = '2026-11-26T10:00:00.000Z';
    const intervals = pairAwayIntervals([back('r1', at, 1500, {}, 2), leave('l1', at, 'hidden', 1)]);
    expect(intervals).toHaveLength(1);
    expect(intervals[0]).toMatchObject({ id: 'l1', awayMs: 1500 });
  });

  test('a leave with no return stays open', () => {
    const [interval] = pairAwayIntervals([leave('l1', '2026-11-26T10:00:00.000Z')]);
    expect(interval).toMatchObject({ id: 'l1', endAt: null, awayMs: null, becameHidden: true });
    expect(interval.returnEvent).toBeNull();
    expect(describeAway(interval)).toBe('Left the page');
  });

  test('two leaves in a row give an open interval and a paired one', () => {
    const intervals = pairAwayIntervals([
      leave('l1', '2026-11-26T10:00:00.000Z'),
      leave('l2', '2026-11-26T10:01:00.000Z'),
      back('r2', '2026-11-26T10:01:20.000Z', 20000),
    ]);
    expect(intervals.map((interval) => [interval.id, interval.awayMs])).toEqual([
      ['l1', null],
      ['l2', 20000],
    ]);
  });

  test('a return whose leave is missing still shows, starting when the absence began', () => {
    const [interval] = pairAwayIntervals([back('r1', '2026-11-26T10:00:30.000Z', 30000)]);
    expect(interval).toMatchObject({
      id: 'r1',
      startAt: '2026-11-26T10:00:00.000Z',
      endAt: '2026-11-26T10:00:30.000Z',
      awayMs: 30000,
    });
    expect(interval.leaveEvent).toBeNull();
  });

  test('ignores other events and an empty or missing list', () => {
    expect(pairAwayIntervals([testRun('t', '2026-11-26T10:00:00.000Z'), paste('p', '2026-11-26T10:01:00.000Z')])).toEqual([]);
    expect(pairAwayIntervals([])).toEqual([]);
    expect(pairAwayIntervals(undefined)).toEqual([]);
  });

  test('a focus loss that later hid the tab counts as hidden', () => {
    const [interval] = pairAwayIntervals([
      leave('l1', '2026-11-26T10:00:00.000Z', 'blur'),
      back('r1', '2026-11-26T10:00:08.000Z', 8000, { reason: 'blur', becameHidden: true }),
    ]);
    expect(interval.becameHidden).toBe(true);
  });
});

describe('buildEventItems — what the Events section lists', () => {
  test('numbers the test runs in order and lists an absence once, where it started', () => {
    const items = buildEventItems([
      testRun('t2', '2026-11-26T10:09:00.000Z'),
      back('r1', '2026-11-26T10:06:10.000Z', 10000),
      paste('p1', '2026-11-26T10:07:00.000Z'),
      leave('l1', '2026-11-26T10:06:00.000Z'),
      testRun('t1', '2026-11-26T10:01:00.000Z'),
    ]);

    expect(items.map((item) => [item.kind, item.id, item.group])).toEqual([
      ['test_run', 't1', 'tests'],
      ['away', 'l1', 'away'],
      ['clipboard', 'p1', 'clipboard'],
      ['test_run', 't2', 'tests'],
    ]);
    expect(items.flatMap((item) => (item.kind === 'test_run' ? [item.number] : []))).toEqual([1, 2]);
  });

  test('skips event types it does not know', () => {
    const unknown = { ...base('x', '2026-11-26T10:00:00.000Z'), type: 'scroll', source: 'page', payload: {} };
    expect(buildEventItems([unknown as unknown as SessionEventRecord])).toEqual([]);
    expect(buildTimeline(messages, [unknown as unknown as SessionEventRecord])).toHaveLength(3);
  });
});

describe('event counters', () => {
  test('group the per-type counters the way the instructor sees them', () => {
    expect(
      countEventGroups({
        test_run: 3,
        clipboard_copy: 2,
        clipboard_cut: 1,
        clipboard_paste: 4,
        page_leave: 5,
        page_return: 5,
      }),
    ).toEqual({ tests: 3, clipboard: 7, away: 5, total: 15 });
    expect(countEventGroups(undefined)).toEqual({ tests: 0, clipboard: 0, away: 0, total: 0 });
  });

  test('merging keeps the highest value of each type and never goes down', () => {
    expect(mergeEventCounts({ test_run: 3, clipboard_paste: 1 }, { test_run: 2, clipboard_paste: 4, page_leave: 1 })).toEqual({
      test_run: 3,
      clipboard_paste: 4,
      page_leave: 1,
    });
    expect(mergeEventCounts(undefined, { test_run: 1 })).toEqual({ test_run: 1 });
    expect(mergeEventCounts({ test_run: 1 }, undefined)).toEqual({ test_run: 1 });
  });

  test('adds up the stages of an attempt', () => {
    expect(sumEventCounts([{ test_run: 1, clipboard_copy: 2 }, null, undefined, { test_run: 4 }])).toEqual({
      test_run: 5,
      clipboard_copy: 2,
    });
  });

  test('tells whether a session has any event at all', () => {
    expect(hasAnyEvents({ test_run: 0, page_leave: 1 })).toBe(true);
    expect(hasAnyEvents({ test_run: 0 })).toBe(false);
    expect(hasAnyEvents({})).toBe(false);
    expect(hasAnyEvents(null)).toBe(false);
    expect(hasAnyEvents(undefined)).toBe(false);
  });
});

describe('toTestRunRecord — a test_run event for the test run card', () => {
  test('maps the payload, the actor and the event time', () => {
    const event = testRun('t1', '2026-11-26T10:01:00.000Z', {
      actor: 'leia',
      createdAt: '2026-11-26T10:01:03.000Z',
      reportedToLeiaAt: '2026-11-26T10:02:00.000Z',
    });

    expect(toTestRunRecord(event)).toEqual({
      id: 't1',
      session: 's1',
      trigger: 'leia',
      language: 'javascript',
      fnName: 'twoSum',
      code: undefined,
      codeTruncated: false,
      status: 'failed',
      passed: 1,
      failed: 1,
      total: 2,
      results: event.payload.results,
      error: null,
      durationMs: 12,
      clientRunAt: '2026-11-26T10:01:00.000Z',
      reportedToLeiaAt: '2026-11-26T10:02:00.000Z',
      createdAt: '2026-11-26T10:01:00.000Z',
    });
  });

  test('carries the code of an event fetched on its own', () => {
    const record = toTestRunRecord(
      testRun('t1', '2026-11-26T10:01:00.000Z', { content: 'function twoSum() {}', contentTruncated: true }),
    );
    expect(record.code).toBe('function twoSum() {}');
    expect(record.codeTruncated).toBe(true);
    expect(record.trigger).toBe('student');
  });

  test('survives an event with no payload', () => {
    const event = { ...testRun('t1', '2026-11-26T10:01:00.000Z'), payload: undefined } as unknown as TestRunEvent;
    expect(toTestRunRecord(event)).toMatchObject({ status: 'error', results: [], passed: 0, total: 0 });
  });
});

describe('labels', () => {
  test('describe a clipboard event by action, size and surface', () => {
    expect(describeClipboardEvent(paste('p', '2026-11-26T10:00:00.000Z'))).toBe('Pasted 120 chars in Chat input');
    expect(
      describeClipboardEvent(
        paste('c', '2026-11-26T10:00:00.000Z', {
          type: 'clipboard_copy',
          source: 'code_editor',
          payload: { method: 'keyboard', length: 1, lines: 1, hash: 'h', preview: 'x' },
        }),
      ),
    ).toBe('Copied 1 char from Code editor');
    expect(
      describeClipboardEvent(paste('x', '2026-11-26T10:00:00.000Z', { type: 'clipboard_cut', source: 'notes' })),
    ).toBe('Cut 120 chars from Notes');
  });

  test('format durations', () => {
    expect(formatDuration(400)).toBe('0 s');
    expect(formatDuration(42000)).toBe('42 s');
    expect(formatDuration(120000)).toBe('2 min');
    expect(formatDuration(125000)).toBe('2 min 5 s');
    expect(formatDuration(3780000)).toBe('1 h 3 min');
    expect(formatDuration(7200000)).toBe('2 h');
  });
});

describe('isPreviewHost — where features in preview are offered', () => {
  test('accepts the pre deployments and a local server', () => {
    expect(isPreviewHost('pre.workbench.leia.ovh')).toBe(true);
    expect(isPreviewHost('pre-112.workbench.leia.ovh')).toBe(true);
    expect(isPreviewHost('localhost')).toBe(true);
    expect(isPreviewHost('127.0.0.1')).toBe(true);
  });

  test('rejects production and lookalikes', () => {
    expect(isPreviewHost('workbench.leia.ovh')).toBe(false);
    expect(isPreviewHost('pre.workbench.leia.ovh.example.com')).toBe(false);
    expect(isPreviewHost('pre-x.workbench.leia.ovh')).toBe(false);
    expect(isPreviewHost('')).toBe(false);
  });

  test('is false where there is no window', () => {
    expect(isPreviewHost()).toBe(false);
  });
});
