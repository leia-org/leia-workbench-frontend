import { describe, expect, test } from 'vitest';
import {
  getDependentStagesForSubmittedSolution,
  rubricRequiresSubmittedSolution,
} from '../../src/views/replication/stageOutputs';
import type { ReplicationData } from '../../src/views/replication/types';

const orchestration = {
  mode: 'single' as const,
  maxInternalTurns: 2,
  openingLeiaId: null,
  problemLeiaId: null,
  sharedTask: '',
};

const makeLeia = (id: string, stageId: string, description: string) => ({
  id,
  stageId,
  configuration: { mode: 'standard', askSolution: true, evaluateSolution: true },
  runnerConfiguration: {},
  sessionCount: 0,
  leia: {
    id,
    metadata: { name: id },
    spec: { behaviour: { spec: { description } } },
  },
});

describe('getDependentStagesForSubmittedSolution', () => {
  test('returns dependent stage numbers only for stages referenced via submitedSolution', () => {
    const experiment: ReplicationData['experiment'] = {
      name: 'Three-stage activity',
      stages: [
        { id: 's1', outputSources: { conversation: null, submitedSolution: null }, orchestration },
        { id: 's2', outputSources: { conversation: null, submitedSolution: null }, orchestration },
        { id: 's3', outputSources: { conversation: 's2', submitedSolution: 's1' }, orchestration },
      ],
      leias: [
        makeLeia('l1', 's1', 'Solve problem'),
        makeLeia('l2', 's2', 'Discuss approach'),
        makeLeia('l3', 's3', 'Use {{previousStage.outputs.submitedSolution}} and {{previousStage.outputs.conversation}}'),
      ],
    };

    expect(getDependentStagesForSubmittedSolution(experiment, 's1')).toEqual([3]);
    expect(getDependentStagesForSubmittedSolution(experiment, 's2')).toEqual([]);
    expect(getDependentStagesForSubmittedSolution(experiment, 's3')).toEqual([]);
  });

  test('does not lock a stage when later stages do not actually reference submitedSolution', () => {
    const experiment: ReplicationData['experiment'] = {
      name: 'Conversation-only staged activity',
      stages: [
        { id: 's1', outputSources: { conversation: null, submitedSolution: null }, orchestration },
        { id: 's2', outputSources: { conversation: 's1', submitedSolution: 's1' }, orchestration },
        { id: 's3', outputSources: { conversation: null, submitedSolution: 's2' }, orchestration },
      ],
      leias: [
        makeLeia('l1', 's1', 'Stage 1'),
        makeLeia('l2', 's2', 'Only {{previousStage.outputs.conversation}}'),
        makeLeia('l3', 's3', 'Needs {{previousStage.outputs.submitedSolution}}'),
      ],
    };

    expect(getDependentStagesForSubmittedSolution(experiment, 's1')).toEqual([]);
    expect(getDependentStagesForSubmittedSolution(experiment, 's2')).toEqual([3]);
  });

  test('locks a stage when a later stage rubric evaluationPrompt references previousStage.outputs.submitedSolution', () => {
    const experiment: ReplicationData['experiment'] = {
      name: 'Rubric staged activity',
      stages: [
        { id: 's1', outputSources: { conversation: null, submitedSolution: null }, orchestration },
        { id: 's2', outputSources: { conversation: 's1', submitedSolution: 's1' }, orchestration },
      ],
      leias: [
        makeLeia('l1', 's1', 'Stage 1'),
        {
          ...makeLeia('l2', 's2', 'Only conversation in behaviour'),
          leia: {
            id: 'l2',
            metadata: { name: 'l2' },
            spec: {
              behaviour: { spec: { description: 'Only conversation in behaviour' } },
              rubric: {
                spec: {
                  evaluationPrompt: 'Compare against {{previousStage.outputs.submitedSolution}}',
                },
              },
            },
          },
        },
      ],
    };

    expect(getDependentStagesForSubmittedSolution(experiment, 's1')).toEqual([2]);
  });

  test('detects when rubric evaluationPrompt requires currentStage.outputs.submitedSolution', () => {
    expect(
      rubricRequiresSubmittedSolution({
        id: 'l1',
        metadata: { name: 'l1' },
        spec: {
          rubric: {
            spec: {
              evaluationPrompt: 'Grade {{currentStage.outputs.submitedSolution}}',
            },
          },
        },
      }),
    ).toBe(true);

    expect(
      rubricRequiresSubmittedSolution({
        id: 'l2',
        metadata: { name: 'l2' },
        spec: {
          rubric: {
            spec: {
              evaluationPrompt: 'Grade {{currentStage.outputs.conversation}}',
            },
          },
        },
      }),
    ).toBe(false);
  });
});
