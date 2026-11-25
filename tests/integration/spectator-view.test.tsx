import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import axios from "axios";

type SocketHandler = (...args: unknown[]) => void;

const { mockIo, socketHandlers, mockSocketEmit, mockSocketDisconnect } = vi.hoisted(() => {
  const handlers = new Map<string, SocketHandler>();
  const emit = vi.fn();
  const disconnect = vi.fn();
  const ioFn = vi.fn(() => ({
    on: vi.fn((event: string, cb: SocketHandler) => {
      handlers.set(event, cb);
    }),
    emit,
    disconnect,
  }));
  return {
    mockIo: ioFn,
    socketHandlers: handlers,
    mockSocketEmit: emit,
    mockSocketDisconnect: disconnect,
  };
});

vi.mock("socket.io-client", () => ({
  io: mockIo,
}));

import { SpectatorView } from "../../src/views/SpectatorView";

function renderSpectator(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/spectate/:sessionId" element={<SpectatorView />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("SpectatorView stage history and per-stage evaluation visibility", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockIo.mockClear();
    mockSocketEmit.mockClear();
    mockSocketDisconnect.mockClear();
    socketHandlers.clear();
    vi.stubEnv("VITE_APP_BACKEND", "http://localhost:3001");
    Element.prototype.scrollIntoView = vi.fn();
  });

  test("lets spectator inspect earlier stages (messages, submitted solution, and stage-specific evaluation) while tracking live stage", async () => {
    const runStages = [
      {
        sessionId: "sess-1",
        stageId: "st-1",
        stageIndex: 0,
        stageNumber: 1,
        stageTotal: 3,
        startedAt: "2026-11-25T09:00:00Z",
        finishedAt: "2026-11-25T09:10:00Z",
        isActive: false,
        messageCount: 2,
        hasSubmittedSolution: true,
        mode: "standard",
        leiaName: "Interviewer",
      },
      {
        sessionId: "sess-2",
        stageId: "st-2",
        stageIndex: 1,
        stageNumber: 2,
        stageTotal: 3,
        startedAt: "2026-11-25T09:11:00Z",
        finishedAt: null,
        isActive: true,
        messageCount: 1,
        hasSubmittedSolution: false,
        mode: "standard",
        leiaName: "Reviewer",
      },
    ];

    vi.spyOn(axios, "get").mockImplementation(async (url: string) => {
      if (url.includes("/sessions/sess-2")) {
        return {
          data: {
            session: {
              id: "sess-2",
              runId: "run-1",
              isTest: false,
              startedAt: "2026-11-25T09:11:00Z",
              finishedAt: null,
              isRunnerInitialized: true,
              result: null,
              evaluation: null,
              score: null,
              stage: { number: 2, total: 3, hasNext: true },
            },
            messages: [
              {
                id: "m-2-1",
                text: "Live stage 2 message",
                isLeia: true,
                timestamp: "2026-11-25T09:11:10Z",
              },
            ],
            leia: {
              showEvaluation: false,
              configuration: {
                mode: "standard",
                askSolution: true,
                evaluationMode: "classic",
                showSolution: false,
              },
            },
            runStages,
          },
        };
      }

      return {
        data: {
          session: {
            id: "sess-1",
            runId: "run-1",
            isTest: false,
            startedAt: "2026-11-25T09:00:00Z",
            finishedAt: "2026-11-25T09:10:00Z",
            isRunnerInitialized: true,
            result: "Stage 1 submitted answer",
            evaluation: "Strong Stage 1 analysis",
            evaluationMode: "classic",
            score: 9,
            stage: { number: 1, total: 3, hasNext: true },
          },
          messages: [
            {
              id: "m-1-1",
              text: "Hello from stage 1",
              isLeia: false,
              timestamp: "2026-11-25T09:01:00Z",
            },
          ],
          leia: {
            showEvaluation: true,
            configuration: {
              mode: "standard",
              askSolution: true,
              evaluationMode: "classic",
              showSolution: true,
            },
          },
          runStages,
        },
      };
    });

    renderSpectator("/spectate/sess-2?token=tok-123");

    // Opens on live Stage 2
    await waitFor(() => {
      expect(screen.getByText("Live stage 2 message")).toBeTruthy();
    });

    // Stage bar shows Stage 1 (clickable), Stage 2 (Live), Stage 3 (disabled)
    const stage1Btn = screen.getByRole("button", { name: /Stage 1/i });
    const stage3Btn = screen.getByRole("button", { name: /Stage 3/i });
    expect((stage3Btn as HTMLButtonElement).disabled).toBe(true);

    // Switch to Stage 1 to inspect previous work
    fireEvent.click(stage1Btn);

    await waitFor(() => {
      expect(screen.getByText("Hello from stage 1")).toBeTruthy();
      expect(screen.getByText("Stage 1 submitted answer")).toBeTruthy();
      expect(screen.getByText("Strong Stage 1 analysis")).toBeTruthy();
      expect(screen.getByText("9 / 10")).toBeTruthy();
      expect(screen.getByText(/Student is live in Stage 2/i)).toBeTruthy();
    });

    // Live message arriving for Stage 2 must not pollute Stage 1 messages
    act(() => {
      socketHandlers.get("message:new")?.({
        id: "m-2-2",
        session: "sess-2",
        text: "Another live stage 2 message",
        isLeia: false,
        timestamp: "2026-11-25T09:12:00Z",
      });
    });
    expect(screen.queryByText("Another live stage 2 message")).toBeNull();

    // If student advances from Stage 2 to Stage 3 while spectator reads Stage 1,
    // spectator stays on Stage 1 and banner updates to Stage 3
    act(() => {
      socketHandlers.get("run:stageChanged")?.({
        previousSessionId: "sess-2",
        nextSessionId: "sess-3",
        stageId: "st-3",
        stageNumber: 3,
        stageTotal: 3,
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Hello from stage 1")).toBeTruthy();
      expect(screen.getByText(/Student is live in Stage 3/i)).toBeTruthy();
      expect((screen.getByRole("button", { name: /Stage 3/i }) as HTMLButtonElement).disabled).toBe(
        false
      );
    });
  });

  test("does not show evaluation when showSolution/showEvaluation is disabled for that stage, even if session:evaluated arrives via socket", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({
      data: {
        session: {
          id: "sess-hidden",
          runId: "run-2",
          isTest: false,
          startedAt: "2026-11-25T10:00:00Z",
          finishedAt: null,
          isRunnerInitialized: true,
          result: null,
          evaluation: null,
          score: null,
          stage: { number: 1, total: 2, hasNext: true },
        },
        messages: [
          {
            id: "m-1",
            text: "Student answer",
            isLeia: false,
            timestamp: "2026-11-25T10:01:00Z",
          },
        ],
        leia: {
          showEvaluation: false,
          configuration: {
            mode: "standard",
            askSolution: false,
            evaluationMode: "rubric",
            showSolution: false,
          },
        },
        runStages: [
          {
            sessionId: "sess-hidden",
            stageId: "st-1",
            stageIndex: 0,
            stageNumber: 1,
            stageTotal: 2,
            startedAt: "2026-11-25T10:00:00Z",
            finishedAt: null,
            isActive: true,
            messageCount: 1,
            hasSubmittedSolution: false,
          },
        ],
      },
    });

    renderSpectator("/spectate/sess-hidden?token=tok-hidden");

    await waitFor(() => {
      expect(screen.getByText("Student answer")).toBeTruthy();
    });

    // Session finishes and a session:evaluated event arrives on socket
    act(() => {
      socketHandlers.get("session:finished")?.({
        sessionId: "sess-hidden",
        finishedAt: "2026-11-25T10:05:00Z",
      });
      socketHandlers.get("session:evaluated")?.({
        sessionId: "sess-hidden",
        score: 7.5,
        evaluationMode: "rubric",
        evaluation: "Secret instructor evaluation",
        rubricEvaluation: {
          rubricName: "Secret Rubric",
          scale: 10,
          totalScore: 7.5,
          summary: "Should not be visible",
          sections: [],
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Finished")).toBeTruthy();
    });

    expect(screen.queryByRole("region", { name: "Evaluation" })).toBeNull();
    expect(screen.queryByText("Secret instructor evaluation")).toBeNull();
    expect(screen.queryByText("Should not be visible")).toBeNull();
  });

  test("shows evaluation live when showEvaluation is enabled for that stage", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({
      data: {
        session: {
          id: "sess-shown",
          isTest: false,
          startedAt: "2026-11-25T10:00:00Z",
          finishedAt: null,
          isRunnerInitialized: true,
          result: null,
          evaluation: null,
          score: null,
        },
        messages: [
          {
            id: "m-1",
            text: "Hello",
            isLeia: false,
            timestamp: "2026-11-25T10:01:00Z",
          },
        ],
        leia: {
          showEvaluation: true,
          configuration: {
            mode: "standard",
            askSolution: true,
            evaluationMode: "classic",
            showSolution: true,
          },
        },
      },
    });

    renderSpectator("/spectate/sess-shown?token=tok-shown");

    await waitFor(() => {
      expect(screen.getByText("Hello")).toBeTruthy();
    });

    act(() => {
      socketHandlers.get("session:finished")?.({
        sessionId: "sess-shown",
        finishedAt: "2026-11-25T10:05:00Z",
        result: "Final submitted text",
      });
      socketHandlers.get("session:evaluated")?.({
        sessionId: "sess-shown",
        score: 8.5,
        evaluationMode: "classic",
        evaluation: "Great explanation!",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Final submitted text")).toBeTruthy();
      expect(screen.getByText("Great explanation!")).toBeTruthy();
      expect(screen.getByText("8.5 / 10")).toBeTruthy();
    });
  });
});
