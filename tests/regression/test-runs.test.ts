import { describe, expect, test } from 'vitest';
import {
  MAX_CODE_LENGTH,
  MAX_REPORT_BYTES,
  MAX_RESULTS,
  MAX_STRING_LENGTH,
  buildTestRunReport,
  safeStringify,
} from '../../src/widgets/codeEditor/testRunReport';
import {
  appendLiveRun,
  describeTestRun,
  mergeTimeline,
  type TestRunRecord,
} from '../../src/lib/testRuns';
import type { TestRunSummary } from '../../src/widgets/codeEditor/types';

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

const summary = (overrides: Partial<TestRunSummary> = {}): TestRunSummary => ({
  passed: 1,
  failed: 1,
  total: 2,
  results: [
    { name: 'basic', ok: true, expected: [0, 1], actual: [0, 1] },
    { name: 'empty', ok: false, expected: [], actual: undefined },
  ],
  durationMs: 12.4,
  ...overrides,
});

const startedAt = new Date('2026-11-13T10:00:00.000Z');

const run = (id: string, createdAt: string, overrides: Partial<TestRunRecord> = {}): TestRunRecord => ({
  id,
  session: 's1',
  trigger: 'student',
  language: 'javascript',
  fnName: 'twoSum',
  status: 'failed',
  passed: 1,
  failed: 1,
  total: 2,
  results: [],
  error: null,
  durationMs: 10,
  createdAt,
  ...overrides,
});

describe('safeStringify — values a test can return', () => {
  test('matches JSON for plain values and keeps strings quoted', () => {
    expect(safeStringify([1, 'a', null, true])).toBe('[1,"a",null,true]');
    expect(safeStringify('text')).toBe('"text"');
    expect(safeStringify({ a: 1 })).toBe('{"a":1}');
  });

  test('never yields an empty value for undefined, also inside arrays and objects', () => {
    expect(safeStringify(undefined)).toBe('undefined');
    expect(safeStringify([1, undefined, 3])).toBe('[1,"[undefined]",3]');
    expect(safeStringify({ a: undefined })).toBe('{"a":"[undefined]"}');
  });

  test('serialises BigInt, Map, Set, functions and non-finite numbers without throwing', () => {
    expect(safeStringify(10n)).toBe('"10n"');
    expect(safeStringify(new Map([['a', 1]]))).toBe('{"[Map]":[["a",1]]}');
    expect(safeStringify(new Set([1, 2]))).toBe('{"[Set]":[1,2]}');
    expect(safeStringify(function named() {})).toBe('"[Function named]"');
    expect(safeStringify([NaN, Infinity])).toBe('["NaN","Infinity"]');
  });

  test('marks a real cycle but not a value that merely repeats', () => {
    const cyclic: Record<string, unknown> = { name: 'node' };
    cyclic.self = cyclic;
    expect(safeStringify(cyclic)).toBe('{"name":"node","self":"[Circular]"}');

    const shared = { x: 1 };
    expect(safeStringify([shared, shared])).toBe('[{"x":1},{"x":1}]');
  });

  test('truncates long values', () => {
    const text = safeStringify('x'.repeat(5000));
    expect(text.length).toBe(MAX_STRING_LENGTH);
    expect(text.endsWith('…')).toBe(true);
  });
});

describe('buildTestRunReport — what the backend receives', () => {
  test('captures code, trigger and outcome per test, serialising only failed comparisons', () => {
    const report = buildTestRunReport({
      trigger: 'student',
      language: 'javascript',
      fnName: 'twoSum',
      code: 'function twoSum() {}',
      summary: summary(),
      startedAt,
      clientRunId: 'run-1',
    });

    expect(report).toEqual({
      clientRunId: 'run-1',
      trigger: 'student',
      language: 'javascript',
      fnName: 'twoSum',
      code: 'function twoSum() {}',
      codeTruncated: false,
      results: [
        { name: 'basic', ok: true },
        { name: 'empty', ok: false, expected: '[]', actual: 'undefined' },
      ],
      error: null,
      durationMs: 12,
      clientRunAt: '2026-11-13T10:00:00.000Z',
    });
  });

  test('a failing test with an error reports the error instead of values', () => {
    const report = buildTestRunReport({
      trigger: 'leia',
      language: 'python',
      fnName: 'f',
      code: 'def f(): pass',
      summary: summary({ results: [{ name: 't', ok: false, error: 'IndexError: list index out of range' }] }),
      startedAt,
    });

    expect(report.results).toEqual([{ name: 't', ok: false, error: 'IndexError: list index out of range' }]);
    expect(report.clientRunId).toMatch(/\S{8,}/);
  });

  test('a suite error is reported with no per-test results', () => {
    const report = buildTestRunReport({
      trigger: 'student',
      language: 'javascript',
      fnName: 'f',
      code: 'function f( {',
      summary: summary({ results: [], passed: 0, failed: 0, total: 0, error: 'SyntaxError: Unexpected token' }),
      startedAt,
    });

    expect(report.results).toEqual([]);
    expect(report.error).toBe('SyntaxError: Unexpected token');
  });

  test('caps the code length and the number of results, and flags the truncation', () => {
    const report = buildTestRunReport({
      trigger: 'student',
      language: 'javascript',
      fnName: 'f',
      code: 'x'.repeat(MAX_CODE_LENGTH + 500),
      summary: summary({ results: Array.from({ length: MAX_RESULTS + 20 }, (_, i) => ({ name: `t${i}`, ok: true })) }),
      startedAt,
    });

    expect(report.code.length).toBe(MAX_CODE_LENGTH);
    expect(report.codeTruncated).toBe(true);
    expect(report.results).toHaveLength(MAX_RESULTS);
  });

  test('stays within the request budget even with huge values and multi-byte code', () => {
    const big = 'é'.repeat(4000);
    const report = buildTestRunReport({
      trigger: 'student',
      language: 'python',
      fnName: 'f',
      code: 'ñ'.repeat(MAX_CODE_LENGTH),
      summary: summary({
        results: Array.from({ length: MAX_RESULTS }, (_, i) => ({ name: `t${i}`, ok: false, expected: big, actual: big })),
      }),
      startedAt,
    });

    expect(bytes(report)).toBeLessThanOrEqual(MAX_REPORT_BYTES);
    expect(report.codeTruncated).toBe(true);
    expect(report.results).toHaveLength(MAX_RESULTS);
  });
});

describe('mergeTimeline — test run markers inside a transcript', () => {
  const messages = [
    { id: 'm1', timestamp: '2026-11-13T10:00:00.000Z' },
    { id: 'm2', timestamp: '2026-11-13T10:05:00.000Z' },
    { id: 'm3', timestamp: '2026-11-13T10:10:00.000Z' },
  ];

  test('places each run right before the first later message', () => {
    const timeline = mergeTimeline(messages, [
      run('late', '2026-11-13T10:20:00.000Z'),
      run('between', '2026-11-13T10:07:00.000Z'),
      run('first', '2026-11-13T09:59:00.000Z'),
    ]);

    expect(timeline.map((item) => item.key)).toEqual([
      'run-first',
      'msg-m1',
      'msg-m2',
      'run-between',
      'msg-m3',
      'run-late',
    ]);
  });

  test('keeps the transcript untouched when there are no runs', () => {
    expect(mergeTimeline(messages).map((item) => item.key)).toEqual(['msg-m1', 'msg-m2', 'msg-m3']);
    expect(mergeTimeline(messages, []).every((item) => item.kind === 'message')).toBe(true);
  });

  test('shows the runs even when the session has no messages', () => {
    const timeline = mergeTimeline([], [run('a', '2026-11-13T10:00:00.000Z')]);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].kind).toBe('testRun');
  });

  test('a run at the same instant as a message goes after it', () => {
    const timeline = mergeTimeline(messages, [run('same', '2026-11-13T10:05:00.000Z')]);
    expect(timeline.map((item) => item.key)).toEqual(['msg-m1', 'msg-m2', 'run-same', 'msg-m3']);
  });
});

describe('appendLiveRun — runs arriving over the socket', () => {
  test('appends in chronological order', () => {
    const runs = appendLiveRun([run('b', '2026-11-13T10:02:00.000Z')], run('a', '2026-11-13T10:01:00.000Z'));
    expect(runs.map((r) => r.id)).toEqual(['a', 'b']);
  });

  test('ignores a run that is already listed', () => {
    const current = [run('a', '2026-11-13T10:01:00.000Z')];
    expect(appendLiveRun(current, run('a', '2026-11-13T10:01:00.000Z'))).toBe(current);
  });

  test('starts a list and keeps only the most recent runs when capped', () => {
    expect(appendLiveRun(undefined, run('a', '2026-11-13T10:01:00.000Z'))).toHaveLength(1);

    let runs: TestRunRecord[] = [];
    for (let i = 0; i < 7; i++) {
      runs = appendLiveRun(runs, run(`r${i}`, `2026-11-13T10:0${i}:00.000Z`), 5);
    }
    expect(runs.map((r) => r.id)).toEqual(['r2', 'r3', 'r4', 'r5', 'r6']);
  });
});

describe('describeTestRun', () => {
  test('summarises the outcome', () => {
    expect(describeTestRun({ status: 'failed', passed: 3, total: 8 })).toBe('3/8 passed');
    expect(describeTestRun({ status: 'passed', passed: 8, total: 8 })).toBe('8/8 passed');
    expect(describeTestRun({ status: 'error', passed: 0, total: 0 })).toBe('error');
  });
});
