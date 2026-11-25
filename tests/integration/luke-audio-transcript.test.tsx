import { useEffect, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { TranscriptionMessage } from '@leia-org/luke-client';

const { lukeStore } = vi.hoisted(() => {
  const listeners = new Set<(next: TranscriptionMessage[]) => void>();
  return {
    lukeStore: {
      transcription: [] as TranscriptionMessage[],
      setTranscription(next: TranscriptionMessage[]) {
        this.transcription = next;
        listeners.forEach((listener) => listener(next));
      },
      subscribe(listener: (next: TranscriptionMessage[]) => void) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      reset() {
        this.transcription = [];
        listeners.clear();
      },
    },
  };
});

vi.mock('@leia-org/luke-client', () => ({
  useLuke: () => {
    const [transcription, setTranscription] = useState<TranscriptionMessage[]>(
      () => lukeStore.transcription,
    );
    useEffect(() => lukeStore.subscribe(setTranscription), []);
    return {
      connectionState: 'connected',
      isConnected: true,
      providers: [{ id: 'gemini', name: 'gemini', voices: [{ id: 'Puck', name: 'Puck' }] }],
      selectedProvider: { id: 'gemini', name: 'gemini', voices: [{ id: 'Puck', name: 'Puck' }] },
      selectedVoice: { id: 'Puck', name: 'Puck' },
      selectProvider: vi.fn(),
      reload: vi.fn(),
      isRecording: true,
      startRecording: vi.fn().mockResolvedValue(undefined),
      stopRecording: vi.fn(),
      audioLevel: 0,
      assistantAudioLevel: 0,
      transcription,
      sessionId: 'luke-ws-1',
    };
  },
}));

import { LukeAudioWidget } from '../../src/components/LukeAudioWidget';
import { Chat } from '../../src/views/Chat';

beforeEach(() => {
  lukeStore.reset();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('LukeAudioWidget finalized transcript emission', () => {
  test('emits transcripts finalized in place after streaming partials without skipping or duplicating', () => {
    const onTranscriptComplete = vi.fn();
    lukeStore.transcription = [{ role: 'user', text: 'Hel', final: false, timestamp: 1000 }];

    render(
      <LukeAudioWidget
        wsUrl="ws://localhost:3001/luke"
        token="luke-token"
        lukeConfig={{ provider: 'gemini', voice: 'Puck' }}
        onTranscriptComplete={onTranscriptComplete}
      />,
    );
    expect(onTranscriptComplete).not.toHaveBeenCalled();

    // Turn 1 finalizes in place at index 0 (array length stays 1).
    const finalizedUser: TranscriptionMessage = {
      role: 'user',
      text: 'Hello, can we discuss the requirements?',
      final: true,
      timestamp: 1100,
    };
    act(() => {
      lukeStore.setTranscription([finalizedUser]);
    });
    expect(onTranscriptComplete).toHaveBeenCalledTimes(1);
    expect(onTranscriptComplete).toHaveBeenLastCalledWith(
      'Hello, can we discuss the requirements?',
      false,
      new Date(1100),
      0,
    );

    // Turn 2 starts as a streaming partial at index 1.
    act(() => {
      lukeStore.setTranscription([
        finalizedUser,
        { role: 'assistant', text: 'Sure', final: false, timestamp: 1200 },
      ]);
    });
    expect(onTranscriptComplete).toHaveBeenCalledTimes(1);

    // Turn 2 finalizes in place at index 1 (array length stays 2).
    const finalizedAssistant: TranscriptionMessage = {
      role: 'assistant',
      text: 'Sure, what would you like to know?',
      final: true,
      timestamp: 1300,
    };
    act(() => {
      lukeStore.setTranscription([finalizedUser, finalizedAssistant]);
    });
    expect(onTranscriptComplete).toHaveBeenCalledTimes(2);
    expect(onTranscriptComplete).toHaveBeenLastCalledWith(
      'Sure, what would you like to know?',
      true,
      new Date(1300),
      1,
    );

    // An interrupted partial left non-final does not block a later finalized turn,
    // and whitespace-only finalized turns are ignored.
    const finalizedFollowup: TranscriptionMessage = {
      role: 'assistant',
      text: 'Let me clarify that.',
      final: true,
      timestamp: 1500,
    };
    act(() => {
      lukeStore.setTranscription([
        finalizedUser,
        finalizedAssistant,
        { role: 'user', text: 'Wait actually...', final: false, timestamp: 1400 },
        { role: 'user', text: '   ', final: true, timestamp: 1450 },
        finalizedFollowup,
      ]);
    });
    expect(onTranscriptComplete).toHaveBeenCalledTimes(3);
    expect(onTranscriptComplete).toHaveBeenLastCalledWith(
      'Let me clarify that.',
      true,
      new Date(1500),
      2,
    );
  });

  test('enables the solution phase in Luke mode once a streaming transcript finalizes when a later stage uses the conversation', async () => {
    vi.stubEnv('VITE_APP_BACKEND', 'http://localhost:3001');
    vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      data: {
        session: {
          id: 'sess-luke-1',
          stage: { number: 1, total: 2, hasNext: true },
        },
        replication: {
          id: 'rep-1',
          name: 'Luke Staged Replication',
          duration: null,
        },
        messages: [],
        leia: {
          audioMode: 'luke',
          lukeConfig: { provider: 'gemini', voice: 'Puck', widgets: [] },
          hideAudioTranscription: false,
          requiresConversationForNextStage: true,
          configuration: {
            mode: 'standard',
            askSolution: true,
            evaluateSolution: false,
          },
          leia: {
            id: 'leia-1',
            spec: {
              persona: { spec: { firstName: 'Ana' } },
              behaviour: { spec: {} },
              problem: { spec: { description: 'Interview Ana', details: '', solutionFormat: 'text' } },
            },
          },
        },
      },
    });
    const post = vi.spyOn(axios, 'post').mockResolvedValue({
      status: 200,
      data: { token: 'luke-jwt' },
    });

    render(
      <MemoryRouter initialEntries={['/chat/sess-luke-1']}>
        <Routes>
          <Route path="/chat/:sessionId" element={<Chat />} />
          <Route path="/edit" element={<div>Editor screen</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const startButton = await screen.findByRole('button', { name: 'Start Stage 1' }, { timeout: 3000 });
    expect(screen.getByText('Use your microphone')).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(startButton);

    const goToEditorButton = (await screen.findByRole(
      'button',
      { name: /Continue to solution/i },
      { timeout: 3000 },
    )) as HTMLButtonElement;
    expect(goToEditorButton.disabled).toBe(true);
    expect(goToEditorButton.title).toBe(
      'Have a conversation before finishing because a later stage uses it',
    );

    await waitFor(() => expect(screen.getByText('Listening')).toBeTruthy());

    // Partial transcript arrives — button stays disabled until a turn finalizes.
    act(() => {
      lukeStore.setTranscription([
        { role: 'user', text: 'Hola Ana', final: false, timestamp: 2000 },
      ]);
    });
    expect(goToEditorButton.disabled).toBe(true);

    // Same index finalizes in place (`final: true`) — button unlocks and navigates to /edit.
    act(() => {
      lukeStore.setTranscription([
        { role: 'user', text: 'Hola Ana, cuéntame los requisitos', final: true, timestamp: 2100 },
      ]);
    });

    await waitFor(() => expect(goToEditorButton.disabled).toBe(false));
    expect(goToEditorButton.title).toBe('');

    fireEvent.click(goToEditorButton);
    expect(await screen.findByText('Editor screen')).toBeTruthy();
  });
});
