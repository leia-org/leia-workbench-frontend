import { describe, expect, test } from 'vitest';
import { getActivityReplicationBlocker, type ReplicableExperiment } from '../../src/lib/activityStages';

const orchestration = {
  mode: 'single' as const,
  maxInternalTurns: 2,
  openingLeiaId: null,
  problemLeiaId: null,
  sharedTask: '',
};

const makeLeia = (
  id: string,
  stageId: string,
  description: string,
  { mode = 'standard', evaluationPrompt }: { mode?: string; evaluationPrompt?: string } = {},
) => ({
  id,
  stageId,
  configuration: { mode },
  leia: {
    id,
    metadata: { name: id },
    spec: {
      behaviour: { spec: { description } },
      ...(evaluationPrompt ? { rubric: { spec: { evaluationPrompt } } } : {}),
    },
  },
});

describe('getActivityReplicationBlocker', () => {
  test('blocks activities when any stage has no LEIAs', () => {
    const experiment: ReplicableExperiment = {
      stages: [
        { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
        { id: 's2', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
      ],
      leias: [makeLeia('l1', 's1', 'Stage 1')],
    };

    expect(getActivityReplicationBlocker(experiment)).toBe('Stage 2 requires at least one LEIA');
  });

  test('blocks activities when referenced previous stage outputs are unresolved', () => {
    const missingConversation: ReplicableExperiment = {
      stages: [
        { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
        { id: 's2', outputSources: { conversation: null, submitedSolution: 's1', problem: null }, orchestration },
      ],
      leias: [
        makeLeia('l1', 's1', 'Stage 1'),
        makeLeia('l2', 's2', '{{previousStage.outputs.conversation}} {{previousStage.outputs.submitedSolution}}'),
      ],
    };
    expect(getActivityReplicationBlocker(missingConversation)).toBe(
      'Select an earlier stage for conversation in stage 2',
    );

    const missingProblemInRubric: ReplicableExperiment = {
      stages: [
        { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
        { id: 's2', outputSources: { conversation: 's1', submitedSolution: null, problem: null }, orchestration },
      ],
      leias: [
        makeLeia('l1', 's1', 'Stage 1'),
        makeLeia('l2', 's2', 'Review {{previousStage.outputs.conversation}}', {
          evaluationPrompt: 'Compare with {{previousStage.leia.problem.solution}}',
        }),
      ],
    };
    expect(getActivityReplicationBlocker(missingProblemInRubric)).toBe(
      'Select an earlier stage for problem in stage 2',
    );
  });

  test('blocks legacy activities without LEIAs and stage 1 references', () => {
    expect(getActivityReplicationBlocker({ leias: [] })).toBe('Add at least one LEIA before replicating');

    const firstStageRef: ReplicableExperiment = {
      stages: [
        { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
      ],
      leias: [makeLeia('l1', 's1', 'Review {{previousStage.outputs.submitedSolution}}')],
    };
    expect(getActivityReplicationBlocker(firstStageRef)).toBe(
      'The first stage cannot use previous stage references',
    );
  });

  test('returns null when every stage has LEIAs and all referenced outputs are resolved', () => {
    const valid: ReplicableExperiment = {
      stages: [
        { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
        { id: 's2', outputSources: { conversation: 's1', submitedSolution: 's1', problem: 's1' }, orchestration },
      ],
      leias: [
        makeLeia('l1', 's1', 'Stage 1'),
        makeLeia('l2', 's2', 'Review {{previousStage.outputs.conversation}} and {{previousStage.outputs.submitedSolution}}', {
          evaluationPrompt: 'Problem: {{previousStage.leia.problem.description}}',
        }),
      ],
    };

    expect(getActivityReplicationBlocker(valid)).toBeNull();
  });
});
