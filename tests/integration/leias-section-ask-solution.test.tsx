import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { LeiasSection } from '../../src/views/replication/sections/LeiasSection';
import type { ReplicationData } from '../../src/views/replication/types';

const orchestration = {
  mode: 'single' as const,
  maxInternalTurns: 2,
  openingLeiaId: null,
  problemLeiaId: null,
  sharedTask: '',
};

const makeLeia = (id: string, name: string, stageId: string, description: string) => ({
  id,
  stageId,
  configuration: { mode: 'standard', askSolution: true, evaluateSolution: true },
  runnerConfiguration: { modelName: 'gpt-4.1', apiKeyId: 'key-1', audioMode: null },
  sessionCount: 0,
  leia: {
    id,
    metadata: { name },
    spec: {
      behaviour: { spec: { description } },
      problem: { spec: {} },
      persona: { spec: {} },
    },
  },
});

const replication: ReplicationData = {
  id: 'rep-1',
  name: 'Staged replication',
  isActive: false,
  duration: null,
  isRepeatable: false,
  isShared: false,
  code: 'CODE123',
  createdAt: '',
  updatedAt: '',
  form: null,
  language: 'en',
  experiment: {
    name: 'Three-stage experiment',
    stages: [
      { id: 's1', outputSources: { conversation: null, submitedSolution: null }, orchestration },
      { id: 's2', outputSources: { conversation: null, submitedSolution: null }, orchestration },
      { id: 's3', outputSources: { conversation: 's2', submitedSolution: 's1' }, orchestration },
    ],
    leias: [
      makeLeia('l1', 'Stage 1 LEIA', 's1', 'Solve problem'),
      makeLeia('l2', 'Stage 2 LEIA', 's2', 'Discuss approach'),
      makeLeia(
        'l3',
        'Stage 3 LEIA',
        's3',
        'Check {{previousStage.outputs.submitedSolution}} and {{previousStage.outputs.conversation}}',
      ),
    ],
  },
};

test('locks Ask for student solution only on stages cited for submitedSolution', () => {
  const onToggleAskSolution = vi.fn().mockResolvedValue(undefined);
  const commonProps = {
    replication,
    localReplication: replication,
    onLeiaSelect: vi.fn(),
    availableModels: ['gpt-4.1'],
    hasFetchedAvailableModels: true,
    apiKeys: [],
    apiKeyProvidersMapped: { openai: ['gpt-4.1'] },
    providerProviderModuleMap: { openai: 'openai-responses' },
    onLocalLeiaChange: vi.fn(),
    onLocalLeiaReset: vi.fn(),
    onLeiaUpdate: vi.fn().mockResolvedValue(true),
    onToggleAskSolution,
    onToggleEvaluateSolution: vi.fn().mockResolvedValue(undefined),
    onStartTestSession: vi.fn(),
    startingSessionLeiaId: null,
    invalidLeiaFields: {},
  };

  const { rerender } = render(
    <MemoryRouter>
      <LeiasSection {...commonProps} activeLeiaId="l1" />
    </MemoryRouter>,
  );

  // First switch in the Conversation section is "Ask for student solution".
  const stage1Switch = screen.getAllByRole('switch')[0] as HTMLInputElement;
  expect(stage1Switch.checked).toBe(true);
  expect(stage1Switch.disabled).toBe(true);
  expect(screen.getByText(/Locked because Stage 3 uses this stage's submitted solution\./)).toBeTruthy();

  rerender(
    <MemoryRouter>
      <LeiasSection {...commonProps} activeLeiaId="l2" />
    </MemoryRouter>,
  );

  const stage2Switch = screen.getAllByRole('switch')[0] as HTMLInputElement;
  expect(stage2Switch.checked).toBe(true);
  expect(stage2Switch.disabled).toBe(false);
  expect(screen.queryByText(/Locked because/)).toBeNull();
  fireEvent.click(stage2Switch);
  expect(onToggleAskSolution).toHaveBeenCalledWith(1);
});
