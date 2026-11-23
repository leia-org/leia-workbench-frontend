import { describe, expect, test } from 'vitest';
import {
  groupSessionsByRun,
  resolveSolutionFormatForLeia,
} from '../../src/views/replication/activityRuns';

describe('activityRuns grouping & solution format helpers', () => {
  test('groups multi-stage sessions by runId in stage order and computes completion accurately', () => {
    const groups = groupSessionsByRun(
      [
        {
          id: 's2',
          runId: 'run-1',
          stageId: 'st-2',
          stageNumber: 2,
          stageTotal: 2,
          startedAt: '2026-11-20T10:10:00Z',
          finishedAt: null,
          user: { email: 'alice@example.com' },
        },
        {
          id: 's1',
          runId: 'run-1',
          stageId: 'st-1',
          stageNumber: 1,
          stageTotal: 2,
          startedAt: '2026-11-20T10:00:00Z',
          finishedAt: '2026-11-20T10:05:00Z',
          user: { email: 'alice@example.com' },
        },
        {
          id: 'legacy-1',
          runId: null,
          startedAt: '2026-11-20T09:00:00Z',
          finishedAt: '2026-11-20T09:30:00Z',
          user: { email: 'bob@example.com' },
        },
      ],
      2
    );

    expect(groups).toHaveLength(2);
    const [alice, bob] = groups;
    expect(alice.runId).toBe('run-1');
    expect(alice.sessions.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(alice.isCompleted).toBe(false);
    expect(alice.hasActiveStage).toBe(true);
    expect(alice.currentSession.id).toBe('s2');

    // Legacy single session without runId stays its own group.
    expect(bob.runId).toBeNull();
    expect(bob.sessions.map((s) => s.id)).toEqual(['legacy-1']);
  });

  test('marks a staged run completed only when the final stage has finished', () => {
    const incomplete = groupSessionsByRun(
      [
        {
          id: 's1',
          runId: 'run-a',
          stageNumber: 1,
          stageTotal: 2,
          startedAt: '2026-11-20T10:00:00Z',
          finishedAt: '2026-11-20T10:05:00Z',
        },
      ],
      2
    );
    expect(incomplete[0].isCompleted).toBe(false);

    const complete = groupSessionsByRun(
      [
        {
          id: 's1',
          runId: 'run-b',
          stageNumber: 1,
          stageTotal: 2,
          startedAt: '2026-11-20T10:00:00Z',
          finishedAt: '2026-11-20T10:05:00Z',
        },
        {
          id: 's2',
          runId: 'run-b',
          stageNumber: 2,
          stageTotal: 2,
          startedAt: '2026-11-20T10:06:00Z',
          finishedAt: '2026-11-20T10:12:00Z',
        },
      ],
      2
    );
    expect(complete[0].isCompleted).toBe(true);
    expect(complete[0].finishedAt).toBe('2026-11-20T10:12:00Z');
  });

  test('resolves solutionFormat per LEIA rather than always falling back to the first LEIA', () => {
    const info = {
      l1: { name: 'Stage 1', solutionFormat: 'text' },
      l2: { name: 'Stage 2', solutionFormat: 'mermaid' },
    };
    expect(resolveSolutionFormatForLeia('l1', info, 'text')).toBe('text');
    expect(resolveSolutionFormatForLeia('l2', info, 'text')).toBe('mermaid');
    expect(resolveSolutionFormatForLeia('unknown', info, 'markdown')).toBe('markdown');
  });
});
