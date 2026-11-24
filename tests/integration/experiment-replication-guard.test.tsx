import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../src/context', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'owner', role: 'admin', email: 'owner@example.com' },
    logout: vi.fn(),
  }),
}));

import { Experiments } from '../../src/views/Experiments';
import { Experiment } from '../../src/views/Experiment';

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
  configuration: { mode: 'standard' },
  leia: {
    id,
    metadata: { name: id },
    spec: { behaviour: { spec: { description } } },
  },
});

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Workbench Create Replication guards', () => {
  test('Experiments view disables Create Replication for empty stages or unresolved outputs and enables for valid activities', async () => {
    const experiments = [
      {
        id: 'exp-empty',
        name: 'Empty Stage Activity',
        isPublished: false,
        user: { id: 'owner', email: 'owner@example.com' },
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T12:00:00Z',
        stages: [
          { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
          { id: 's2', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
        ],
        leias: [makeLeia('l1', 's1', 'Stage 1')],
      },
      {
        id: 'exp-unresolved',
        name: 'Unresolved Output Activity',
        isPublished: false,
        user: { id: 'owner', email: 'owner@example.com' },
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T11:00:00Z',
        stages: [
          { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
          { id: 's2', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
        ],
        leias: [
          makeLeia('l1', 's1', 'Stage 1'),
          makeLeia('l2', 's2', 'Check {{previousStage.outputs.submitedSolution}}'),
        ],
      },
      {
        id: 'exp-valid',
        name: 'Ready Staged Activity',
        isPublished: false,
        user: { id: 'owner', email: 'owner@example.com' },
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T10:00:00Z',
        stages: [
          { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
          { id: 's2', outputSources: { conversation: null, submitedSolution: 's1', problem: null }, orchestration },
        ],
        leias: [
          makeLeia('l1', 's1', 'Stage 1'),
          makeLeia('l2', 's2', 'Check {{previousStage.outputs.submitedSolution}}'),
        ],
      },
    ];

    vi.spyOn(axios, 'get').mockResolvedValue({
      data: { experiments, nextCursor: null },
    });

    render(
      <MemoryRouter initialEntries={['/experiments']}>
        <Experiments />
      </MemoryRouter>,
    );

    const createBtn = (await screen.findByRole('button', {
      name: 'Create Replication from this Experiment',
    })) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);
    expect(screen.getByText('Stage 2 requires at least one LEIA')).toBeTruthy();

    fireEvent.click(screen.getByText('Unresolved Output Activity'));
    await waitFor(() =>
      expect(screen.getByText('Select an earlier stage for submitted solution in stage 2')).toBeTruthy(),
    );
    expect(
      (screen.getByRole('button', { name: 'Create Replication from this Experiment' }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByText('Ready Staged Activity'));
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Create Replication from this Experiment' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
  });

  test('Experiment preview disables Create Replication and shows alert when stage resolution is missing', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      data: {
        id: 'exp-unresolved',
        name: 'Unresolved Preview Activity',
        isPublished: false,
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T10:00:00Z',
        stages: [
          { id: 's1', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
          { id: 's2', outputSources: { conversation: null, submitedSolution: null, problem: null }, orchestration },
        ],
        leias: [
          makeLeia('l1', 's1', 'Stage 1'),
          makeLeia('l2', 's2', 'Use {{previousStage.leia.problem.description}}'),
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={['/experiments/exp-unresolved']}>
        <Routes>
          <Route path="/experiments/:id" element={<Experiment />} />
        </Routes>
      </MemoryRouter>,
    );

    const createBtn = (await screen.findByRole('button', {
      name: 'Create Replication',
    })) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain(
      'Select an earlier stage for problem in stage 2',
    );
  });
});
