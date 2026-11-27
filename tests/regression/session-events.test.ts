import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  BATCH_DELAY_MS,
  BATCH_MAX_EVENTS,
  KEEPALIVE_BUDGET_BYTES,
  MAX_CONTENT_LENGTH,
  REQUEST_TIMEOUT_MS,
  RETRY_DELAY_MS,
  createSessionEventsTracker,
  testRunEventInput,
  type SessionEventInput,
  type SessionEventWire,
  type SessionEventsResponse,
} from '../../src/lib/sessionEvents';
import {
  COPY_RING_KEY,
  COPY_RING_SIZE,
  createCopyRing,
  normalizeClipboardText,
} from '../../src/lib/clipboardCapture';
import {
  BLUR_GRACE_MS,
  createPagePresence,
  startPagePresence,
  type PagePresenceEvent,
} from '../../src/lib/pagePresence';
import { buildTestRunReport } from '../../src/widgets/codeEditor/testRunReport';

const START = new Date('2026-11-26T10:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

interface SentRequest {
  url: string;
  keepalive: boolean;
  body: { sentAt: string; events: SessionEventWire[] };
}

type Responder = (request: SentRequest) => SessionEventsResponse | Promise<SessionEventsResponse>;

const ok: Responder = (request) => ({
  status: 200,
  json: async () => ({
    results: request.body.events.map((event) => ({ clientEventId: event.clientEventId, status: 'stored' })),
  }),
});

function setup(responder: Responder = ok) {
  const requests: SentRequest[] = [];
  const state: { responder: Responder; hide: (() => void) | null } = { responder, hide: null };
  let nextId = 0;
  const warn = vi.fn();
  const tracker = createSessionEventsTracker({
    fetch: async (url, init) => {
      const request: SentRequest = {
        url,
        keepalive: init.keepalive === true,
        body: JSON.parse(String(init.body)),
      };
      requests.push(request);
      return state.responder(request);
    },
    baseUrl: () => 'http://backend.test',
    randomId: () => `event-${++nextId}`,
    onPageHide: (listener) => {
      state.hide = listener;
      return () => {
        state.hide = null;
      };
    },
    warn,
  });
  return { tracker, requests, state, warn };
}

const leave: SessionEventInput = { type: 'page_leave', source: 'page', payload: { reason: 'blur' } };
const paste = (content: string): SessionEventInput => ({
  type: 'clipboard_paste',
  source: 'chat_input',
  payload: { method: 'keyboard', length: content.length, origin: 'external' },
  content,
});
const ids = (request: SentRequest) => request.body.events.map((event) => event.clientEventId);

describe('session events tracker — batches', () => {
  test('holds light events for the batch window and sends them together', async () => {
    const { tracker, requests } = setup();
    tracker.start('s1', { view: 'chat', observe: true });

    const first = tracker.track('s1', leave);
    await vi.advanceTimersByTimeAsync(500);
    const second = tracker.track('s1', { type: 'page_return', source: 'page', payload: { awayMs: 500 } });
    await vi.advanceTimersByTimeAsync(BATCH_DELAY_MS - 501);
    expect(requests).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('http://backend.test/api/v1/interactions/s1/events');
    expect(requests[0].body.sentAt).toBe('2026-11-26T10:00:02.000Z');
    expect(requests[0].body.events).toEqual([
      {
        clientEventId: first,
        type: 'page_leave',
        source: 'page',
        actor: 'student',
        view: 'chat',
        clientAt: '2026-11-26T10:00:00.000Z',
        seq: 0,
        payload: { reason: 'blur' },
      },
      {
        clientEventId: second,
        type: 'page_return',
        source: 'page',
        actor: 'student',
        view: 'chat',
        clientAt: '2026-11-26T10:00:00.500Z',
        seq: 1,
        payload: { awayMs: 500 },
      },
    ]);

    // Stored events are not sent again.
    await vi.advanceTimersByTimeAsync(10 * BATCH_DELAY_MS);
    expect(requests).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('sends at once an event that carries content, with what was waiting', () => {
    const { tracker, requests } = setup();
    tracker.start('s1', { view: 'chat', observe: true });

    tracker.track('s1', leave);
    expect(requests).toHaveLength(0);
    tracker.track('s1', paste('pasted text'));

    expect(requests).toHaveLength(1);
    expect(requests[0].body.events.map((event) => event.type)).toEqual(['page_leave', 'clipboard_paste']);
    expect(requests[0].body.events[1].content).toBe('pasted text');
  });

  test('sends at once an urgent event', () => {
    const { tracker, requests } = setup();
    tracker.start('s1', { view: 'chat', observe: true });

    tracker.track('s1', { ...leave, payload: { reason: 'hidden' }, urgent: true });

    expect(requests).toHaveLength(1);
  });

  test('does not wait for the window once twenty events are queued', () => {
    const { tracker, requests } = setup();
    tracker.start('s1', { view: 'chat', observe: true });

    for (let i = 0; i < BATCH_MAX_EVENTS - 1; i++) tracker.track('s1', leave);
    expect(requests).toHaveLength(0);
    tracker.track('s1', leave);

    expect(requests).toHaveLength(1);
    expect(requests[0].body.events).toHaveLength(BATCH_MAX_EVENTS);
  });

  test('does not wait for the window once the queue is heavy, and splits oversized batches', async () => {
    const { tracker, requests } = setup();
    tracker.start('s1', { view: 'chat', observe: true });
    const heavy = (): SessionEventInput => ({ ...leave, payload: { reason: 'blur', filler: 'x'.repeat(100000) } });

    tracker.track('s1', heavy());
    tracker.track('s1', heavy());
    expect(requests).toHaveLength(0);
    tracker.track('s1', heavy());

    // 300 kB waiting: sent now, in requests of at most 250 kB.
    expect(requests.map((request) => request.body.events.length)).toEqual([2, 1]);
    await vi.advanceTimersByTimeAsync(0);
  });

  test('keeps each event in the request of its own session', async () => {
    const { tracker, requests } = setup();
    tracker.start('stage-1', { view: 'chat', observe: true });
    tracker.start('stage-2', { view: 'edit', observe: true });

    tracker.track('stage-1', leave);
    tracker.track('stage-2', leave);
    tracker.track('stage-1', leave);
    await tracker.flush();

    expect(requests).toHaveLength(2);
    const byUrl = Object.fromEntries(requests.map((request) => [request.url, request.body.events]));
    expect(byUrl['http://backend.test/api/v1/interactions/stage-1/events'].map((event) => [event.seq, event.view]))
      .toEqual([[0, 'chat'], [1, 'chat']]);
    expect(byUrl['http://backend.test/api/v1/interactions/stage-2/events'].map((event) => [event.seq, event.view]))
      .toEqual([[0, 'edit']]);
  });

  test('ignores sessions that were not started, and never throws', async () => {
    const { tracker, requests } = setup();

    expect(tracker.track('unknown', leave)).toBe('event-1');
    expect(tracker.accepts('unknown', 'page_leave')).toBe(false);
    expect(() => tracker.track('unknown', null as unknown as SessionEventInput)).not.toThrow();
    await tracker.flush();

    expect(requests).toHaveLength(0);
  });

  test('without consent to be observed, only test runs are sent', async () => {
    const { tracker, requests } = setup();
    tracker.start('s1', { view: 'chat', observe: false });

    tracker.track('s1', leave);
    tracker.track('s1', paste('private'));
    tracker.track('s1', { type: 'test_run', source: 'code_editor', payload: { language: 'python' }, content: 'def f(): pass' });
    await tracker.flush();

    expect(tracker.accepts('s1', 'clipboard_paste')).toBe(false);
    expect(tracker.accepts('s1', 'test_run')).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0].body.events.map((event) => event.type)).toEqual(['test_run']);
  });

  test('cuts content beyond the server limit and keeps its original length', async () => {
    const { tracker, requests } = setup();
    tracker.start('s1', { view: 'chat', observe: true });
    const long = 'a'.repeat(MAX_CONTENT_LENGTH + 250);

    tracker.track('s1', { type: 'clipboard_copy', source: 'notes', payload: { method: 'menu', length: long.length }, content: long });
    tracker.track('s1', { type: 'clipboard_copy', source: 'notes', payload: { method: 'menu' }, content: long });
    tracker.track('s1', paste('short'));
    await tracker.flush();

    const events = requests.flatMap((request) => request.body.events);
    expect(events[0].content).toHaveLength(MAX_CONTENT_LENGTH);
    expect(events[0].contentTruncated).toBe(true);
    expect(events[0].payload).toEqual({ method: 'menu', length: MAX_CONTENT_LENGTH + 250 });
    expect(events[1].payload).toEqual({ method: 'menu', length: MAX_CONTENT_LENGTH + 250 });
    expect(events[2].content).toBe('short');
    expect(events[2]).not.toHaveProperty('contentTruncated');
  });

  test('a session is tracked until every start has been stopped, and stopping sends what is left', async () => {
    const { tracker, requests, state } = setup();
    const stopFirst = tracker.start('s1', { view: 'chat', observe: true });
    const stopSecond = tracker.start('s1', { view: 'chat', observe: true });
    expect(state.hide).toBeTypeOf('function');

    stopFirst();
    stopFirst();
    expect(tracker.accepts('s1', 'page_leave')).toBe(true);

    tracker.track('s1', leave);
    stopSecond();
    expect(tracker.accepts('s1', 'page_leave')).toBe(false);
    expect(state.hide).toBeNull();
    expect(requests).toHaveLength(1);

    tracker.track('s1', leave);
    await tracker.flush();
    expect(requests).toHaveLength(1);
  });
});

describe('session events tracker — failures', () => {
  test('retries once after a network failure', async () => {
    const { tracker, requests, state } = setup(() => {
      throw new TypeError('Failed to fetch');
    });
    tracker.start('s1', { view: 'chat', observe: true });

    tracker.track('s1', paste('kept'));
    await vi.advanceTimersByTimeAsync(0);
    expect(requests).toHaveLength(1);

    state.responder = ok;
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS - 1);
    expect(requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(requests).toHaveLength(2);
    expect(ids(requests[1])).toEqual(ids(requests[0]));

    await vi.advanceTimersByTimeAsync(60000);
    expect(requests).toHaveLength(2);
  });

  test('gives up after the second server error', async () => {
    const { tracker, requests, warn } = setup(() => ({ status: 503 }));
    tracker.start('s1', { view: 'chat', observe: true });

    tracker.track('s1', paste('lost'));
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    expect(requests).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(60000);
    expect(requests).toHaveLength(2);
    expect(warn).toHaveBeenCalledWith('1 session event(s) could not be recorded');

    // Later events are still attempted.
    tracker.track('s1', paste('next'));
    expect(requests).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
  });

  test('an event waiting for its retry is not resent by an earlier batch', async () => {
    const { tracker, requests, state } = setup(() => ({ status: 500 }));
    tracker.start('s1', { view: 'chat', observe: true });

    tracker.track('s1', paste('first'));
    await vi.advanceTimersByTimeAsync(100);
    state.responder = ok;
    tracker.track('s1', paste('second'));
    await vi.advanceTimersByTimeAsync(0);

    expect(requests.map((request) => request.body.events.map((event) => event.content))).toEqual([['first'], ['second']]);
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    expect(requests[2].body.events.map((event) => event.content)).toEqual(['first']);
  });

  test('a 404 switches the session off: the feature is not offered', async () => {
    const { tracker, requests } = setup(() => ({ status: 404 }));
    tracker.start('s1', { view: 'chat', observe: true });
    tracker.start('s2', { view: 'chat', observe: true });

    tracker.track('s1', leave);
    tracker.track('s1', paste('one'));
    await vi.advanceTimersByTimeAsync(0);
    expect(requests).toHaveLength(1);
    expect(tracker.accepts('s1', 'clipboard_paste')).toBe(false);
    expect(tracker.accepts('s1', 'test_run')).toBe(false);

    tracker.track('s1', paste('two'));
    await vi.advanceTimersByTimeAsync(60000);
    expect(requests).toHaveLength(1);

    // Starting it again does not bring it back; other sessions are unaffected.
    tracker.start('s1', { view: 'edit', observe: true });
    expect(tracker.accepts('s1', 'clipboard_paste')).toBe(false);
    expect(tracker.accepts('s2', 'clipboard_paste')).toBe(true);
  });

  test.each([400, 403, 413])('a %i is final: no retry', async (status) => {
    const { tracker, requests } = setup(() => ({ status }));
    tracker.start('s1', { view: 'chat', observe: true });

    tracker.track('s1', paste('text'));
    await vi.advanceTimersByTimeAsync(60000);

    expect(requests).toHaveLength(1);
    expect(tracker.accepts('s1', 'clipboard_paste')).toBe(true);
  });

  test('reports rejected events by id and reason only', async () => {
    const { tracker, warn } = setup((request) => ({
      status: 200,
      json: async () => ({
        results: [{ clientEventId: request.body.events[0].clientEventId, status: 'rejected', reason: 'cap_reached' }],
      }),
    }));
    tracker.start('s1', { view: 'chat', observe: true });

    tracker.track('s1', paste('secret text'));
    await tracker.flush();

    expect(warn).toHaveBeenCalledWith('Session events rejected', [{ clientEventId: 'event-1', reason: 'cap_reached' }]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret text');
  });

  test('a request that never answers is abandoned and retried', async () => {
    let attempts = 0;
    const tracker = createSessionEventsTracker({
      // Like the real fetch: pending until it is aborted.
      fetch: (_url, init) =>
        new Promise<SessionEventsResponse>((_resolve, reject) => {
          attempts += 1;
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
      baseUrl: () => 'http://backend.test',
      onPageHide: () => () => undefined,
      warn: vi.fn(),
    });
    tracker.start('s1', { view: 'chat', observe: true });

    tracker.track('s1', paste('slow'));
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(attempts).toBe(1);
    await vi.advanceTimersByTimeAsync(1 + RETRY_DELAY_MS);
    expect(attempts).toBe(2);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 60000);
    expect(attempts).toBe(2);
  });
});

describe('session events tracker — leaving the page', () => {
  test('sends what is queued when the page is hidden, in a request that outlives it', () => {
    const { tracker, requests, state } = setup();
    tracker.start('s1', { view: 'chat', observe: true });

    tracker.track('s1', leave);
    tracker.track('s1', leave);
    state.hide?.();

    expect(requests).toHaveLength(1);
    expect(requests[0].keepalive).toBe(true);
    expect(requests[0].body.events).toHaveLength(2);
  });

  test('fills the keepalive budget first and sends the rest as ordinary requests', () => {
    const { tracker, requests, state } = setup();
    tracker.start('s1', { view: 'chat', observe: true });
    const sized = (bytes: number): SessionEventInput => ({ ...leave, payload: { reason: 'blur', filler: 'x'.repeat(bytes) } });

    tracker.track('s1', sized(25000));
    tracker.track('s1', sized(25000));
    tracker.track('s1', sized(25000));
    state.hide?.();

    expect(requests.map((request) => [request.body.events.length, request.keepalive])).toEqual([
      [2, true],
      [1, false],
    ]);
    const bytes = new TextEncoder().encode(JSON.stringify(requests[0].body)).length;
    expect(bytes).toBeLessThanOrEqual(KEEPALIVE_BUDGET_BYTES);
  });

  test('a small request is always sent so that closing the tab cannot cancel it', () => {
    const { tracker, requests } = setup();
    tracker.start('s1', { view: 'chat', observe: true });

    tracker.track('s1', paste('pasted just before closing'));
    tracker.track('s1', paste('x'.repeat(MAX_CONTENT_LENGTH)));

    expect(requests.map((request) => request.keepalive)).toEqual([true, false]);
  });

  test('the budget is released when a request settles', async () => {
    const { tracker, requests } = setup();
    tracker.start('s1', { view: 'chat', observe: true });

    tracker.track('s1', paste('x'.repeat(40000)));
    tracker.track('s1', paste('y'.repeat(40000)));
    await tracker.flush();
    tracker.track('s1', paste('z'.repeat(40000)));

    expect(requests.map((request) => request.keepalive)).toEqual([true, false, true]);
  });

  test('does not wait for a retry when the page is going away', async () => {
    const { tracker, requests, state } = setup(() => ({ status: 500 }));
    tracker.start('s1', { view: 'chat', observe: true });

    tracker.track('s1', paste('text'));
    await vi.advanceTimersByTimeAsync(10);
    state.responder = ok;
    state.hide?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(requests).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    expect(requests).toHaveLength(2);
  });
});

describe('testRunEventInput — a test run as an event', () => {
  test('spreads the report: code to content, trigger to actor, outcome to payload', async () => {
    const report = buildTestRunReport({
      trigger: 'leia',
      language: 'javascript',
      fnName: 'twoSum',
      code: 'function twoSum() {}',
      summary: {
        passed: 1,
        failed: 1,
        total: 2,
        results: [
          { name: 'basic', ok: true },
          { name: 'empty', ok: false, expected: [], actual: undefined },
        ],
        durationMs: 12.4,
      },
      startedAt: new Date('2026-11-26T09:59:58.000Z'),
      clientRunId: 'run-1',
    });
    const { tracker, requests } = setup();
    tracker.start('s1', { view: 'chat', observe: false });

    expect(tracker.track('s1', testRunEventInput(report))).toBe('run-1');
    await tracker.flush();

    expect(requests[0].body.events).toEqual([
      {
        clientEventId: 'run-1',
        type: 'test_run',
        source: 'code_editor',
        actor: 'leia',
        view: 'chat',
        clientAt: '2026-11-26T09:59:58.000Z',
        seq: 0,
        payload: {
          language: 'javascript',
          fnName: 'twoSum',
          results: [
            { name: 'basic', ok: true },
            { name: 'empty', ok: false, expected: '[]', actual: 'undefined' },
          ],
          error: null,
          durationMs: 12,
        },
        content: 'function twoSum() {}',
      },
    ]);
  });

  test('carries over a cut made by the report', () => {
    const report = buildTestRunReport({
      trigger: 'student',
      language: 'python',
      fnName: 'f',
      code: 'x'.repeat(MAX_CONTENT_LENGTH + 10),
      summary: { passed: 0, failed: 0, total: 0, results: [], error: 'SyntaxError', durationMs: 1 },
      startedAt: START,
    });

    const input = testRunEventInput(report);

    expect(input.content).toHaveLength(MAX_CONTENT_LENGTH);
    expect(input.contentTruncated).toBe(true);
    expect(input.actor).toBe('student');
  });
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('paste classification — was the text copied inside the workbench', () => {
  const copy = (text: string, id = 'copy-1', source: 'code_editor' | 'notes' | 'chat_input' = 'code_editor') =>
    ({ clientEventId: id, sessionId: 'stage-1', source, text });

  test('a text copied before is internal and points at its copy', () => {
    const ring = createCopyRing({ storage: memoryStorage() });
    ring.remember(copy('const total = a + b;'));
    vi.advanceTimersByTime(4200);

    expect(ring.classify('const total = a + b;')).toEqual({
      origin: 'internal',
      match: { clientEventId: 'copy-1', sessionId: 'stage-1', source: 'code_editor', kind: 'exact', ageMs: 4200 },
    });
  });

  test('line endings do not make a text different', () => {
    const ring = createCopyRing({ storage: memoryStorage() });
    ring.remember(copy('line one\r\nline two\rline three'));

    expect(normalizeClipboardText('a\r\nb\rc\n')).toBe('a\nb\nc\n');
    expect(ring.classify('line one\nline two\nline three').match?.kind).toBe('exact');
  });

  test('surrounding whitespace only downgrades the match to trimmed', () => {
    const ring = createCopyRing({ storage: memoryStorage() });
    ring.remember(copy('    return total;\n'));

    expect(ring.classify('return total;').match).toMatchObject({ clientEventId: 'copy-1', kind: 'trimmed' });
    expect(ring.classify('return  total;')).toEqual({ origin: 'external' });
  });

  test('anything else is external', () => {
    const ring = createCopyRing({ storage: memoryStorage() });
    ring.remember(copy('known'));
    ring.remember(copy('   \n', 'blank'));

    expect(ring.classify('brought from elsewhere')).toEqual({ origin: 'external' });
    expect(ring.classify('Known')).toEqual({ origin: 'external' });
    expect(ring.classify('')).toEqual({ origin: 'external' });
    // Whitespace alone never matches by trimming…
    expect(ring.classify('\t')).toEqual({ origin: 'external' });
    // …only as the very same text.
    expect(ring.classify('   \n').match).toMatchObject({ clientEventId: 'blank', kind: 'exact' });
  });

  test('the most recent copy wins, and an exact match beats a trimmed one', () => {
    const ring = createCopyRing({ storage: memoryStorage() });
    ring.remember(copy('value', 'old', 'notes'));
    ring.remember(copy('value', 'new', 'chat_input'));
    expect(ring.classify('value').match).toMatchObject({ clientEventId: 'new', source: 'chat_input' });

    ring.remember(copy(' value ', 'spaced'));
    expect(ring.classify('value').match).toMatchObject({ clientEventId: 'new', kind: 'exact' });
    expect(ring.classify('value\n').match).toMatchObject({ clientEventId: 'spaced', kind: 'trimmed' });
  });

  test('remembers the last thirty copies', () => {
    const ring = createCopyRing({ storage: memoryStorage() });
    for (let i = 0; i <= COPY_RING_SIZE; i++) ring.remember(copy(`text ${i}`, `copy-${i}`));

    expect(ring.classify('text 0')).toEqual({ origin: 'external' });
    expect(ring.classify('text 1').match?.clientEventId).toBe('copy-1');
    expect(ring.classify(`text ${COPY_RING_SIZE}`).match?.clientEventId).toBe(`copy-${COPY_RING_SIZE}`);
  });

  test('stores hashes, never the copied text', () => {
    const storage = memoryStorage();
    const ring = createCopyRing({ storage });
    ring.remember(copy('my password is hunter2'));

    const stored = storage.getItem(COPY_RING_KEY) ?? '';
    expect(JSON.parse(stored)).toHaveLength(1);
    expect(stored).not.toContain('hunter2');
    expect(stored).not.toContain('password');
  });

  test('outlives the page: another stage or view reads the same ring', () => {
    const storage = memoryStorage();
    createCopyRing({ storage }).remember(copy('from stage one'));

    expect(createCopyRing({ storage }).classify('from stage one').match).toMatchObject({
      sessionId: 'stage-1',
      kind: 'exact',
    });
  });

  test('works from memory when the storage is unusable or corrupt', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const ring = createCopyRing({ storage: broken });
    ring.remember(copy('still works'));
    expect(ring.classify('still works').origin).toBe('internal');

    const corrupt = memoryStorage();
    corrupt.setItem(COPY_RING_KEY, '{"not":"a list"}');
    expect(createCopyRing({ storage: corrupt }).classify('anything')).toEqual({ origin: 'external' });
    corrupt.setItem(COPY_RING_KEY, '[{"id":1},null,"x"]');
    expect(createCopyRing({ storage: corrupt }).classify('anything')).toEqual({ origin: 'external' });
  });
});

describe('page presence — leaving and coming back', () => {
  const present = { hidden: false, focused: true };
  const blurred = { hidden: false, focused: false };
  const hidden = { hidden: true, focused: false };

  function machine(initial = present) {
    const events: PagePresenceEvent[] = [];
    return { events, presence: createPagePresence(initial, { emit: (event) => events.push(event) }) };
  }

  test('a hidden page is reported at once, and its return says how long it took', () => {
    const { events, presence } = machine();

    presence.update(hidden);
    expect(events).toEqual([
      { type: 'page_leave', at: START.getTime(), payload: { reason: 'hidden' }, urgent: true },
    ]);

    vi.advanceTimersByTime(42000);
    // Visible again but still behind another window: not back yet.
    presence.update(blurred);
    expect(events).toHaveLength(1);
    vi.advanceTimersByTime(500);
    presence.update(present);

    expect(events[1]).toEqual({
      type: 'page_return',
      at: START.getTime() + 42500,
      payload: { awayMs: 42500, reason: 'hidden', becameHidden: true },
      urgent: false,
    });
  });

  test('a loss of focus shorter than a second is not reported', () => {
    const { events, presence } = machine();

    presence.update(blurred);
    vi.advanceTimersByTime(BLUR_GRACE_MS - 1);
    presence.update(present);
    vi.advanceTimersByTime(10000);

    expect(events).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('a longer loss of focus is reported from the moment it began', () => {
    const { events, presence } = machine();

    presence.update(blurred);
    vi.advanceTimersByTime(BLUR_GRACE_MS - 1);
    expect(events).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(events).toEqual([
      { type: 'page_leave', at: START.getTime(), payload: { reason: 'blur' }, urgent: false },
    ]);

    vi.advanceTimersByTime(6000);
    presence.update(present);
    expect(events[1]).toEqual({
      type: 'page_return',
      at: START.getTime() + 7000,
      payload: { awayMs: 7000, reason: 'blur', becameHidden: false },
      urgent: false,
    });
  });

  test('a page hidden right after losing focus left when the focus went', () => {
    const { events, presence } = machine();

    presence.update(blurred);
    vi.advanceTimersByTime(300);
    presence.update(hidden);

    expect(events).toEqual([
      { type: 'page_leave', at: START.getTime(), payload: { reason: 'hidden' }, urgent: true },
    ]);
    vi.advanceTimersByTime(5000);
    expect(events).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('a return tells whether the page got hidden while the focus was away', () => {
    const { events, presence } = machine();

    presence.update(blurred);
    vi.advanceTimersByTime(2000);
    presence.update(hidden);
    presence.update(blurred);
    vi.advanceTimersByTime(1000);
    presence.update(present);

    expect(events.map((event) => event.type)).toEqual(['page_leave', 'page_return']);
    expect(events[1].payload).toEqual({ awayMs: 3000, reason: 'blur', becameHidden: true });
  });

  test('repeated reports of the same state change nothing', () => {
    const { events, presence } = machine();

    presence.update(present);
    presence.update(hidden);
    presence.update(hidden);
    presence.update(present);
    presence.update(present);

    expect(events.map((event) => event.type)).toEqual(['page_leave', 'page_return']);
  });

  test('a page that starts in the background has no leave to report', () => {
    const { events, presence } = machine(hidden);

    vi.advanceTimersByTime(5000);
    presence.update(present);
    expect(events).toEqual([]);

    presence.update(hidden);
    expect(events.map((event) => event.type)).toEqual(['page_leave']);
  });

  test('stopping cancels a report that was still pending', () => {
    const { events, presence } = machine();

    presence.update(blurred);
    presence.dispose();
    vi.advanceTimersByTime(BLUR_GRACE_MS * 5);
    presence.update(hidden);

    expect(events).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('watches the visibility of the document and the focus of the window', () => {
    const page = { hidden: false, focused: true };
    const doc = Object.assign(new EventTarget(), { hasFocus: () => page.focused });
    Object.defineProperty(doc, 'hidden', { get: () => page.hidden });
    const win = new EventTarget();
    const events: PagePresenceEvent[] = [];
    const stop = startPagePresence({
      emit: (event) => events.push(event),
      document: doc as unknown as Document,
      window: win as unknown as Window,
    });

    page.focused = false;
    win.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(BLUR_GRACE_MS);
    expect(events.map((event) => event.type)).toEqual(['page_leave']);

    page.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    page.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(events).toHaveLength(1);

    page.focused = true;
    win.dispatchEvent(new Event('focus'));
    expect(events[1].payload).toEqual({ awayMs: BLUR_GRACE_MS, reason: 'blur', becameHidden: true });

    stop();
    page.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(events).toHaveLength(2);
  });
});
