import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import axios from "axios";
import { LeiasSection } from "../../src/views/replication/sections/LeiasSection";
import PreviousConversationWidget from "../../src/widgets/PreviousConversationWidget";
import { Chat } from "../../src/views/Chat";
import { Edit } from "../../src/views/Edit";
import type {
  ReplicationData,
  StagePreviousConversationConfig,
} from "../../src/views/replication/types";

test("keeps the solution within its stage and shows a separate task before the final stage", async () => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubEnv("VITE_APP_BACKEND", "http://backend.test");
  const stagePlan = [
    { askSolution: true, mode: "conversation" },
    { askSolution: false, mode: "transcription" },
  ];
  const completedAt = "2026-11-25T12:10:00Z";
  const finishedStages = new Map<number, Record<string, unknown>>();
  const session = (number: number) => ({
    id: `task-${number}`,
    stage: { number, total: 2, hasNext: number < 2 },
    stagePlan,
    startedAt: "2026-11-25T12:00:00Z",
    finishedAt: null,
    ...finishedStages.get(number),
  });
  vi.spyOn(axios, "get").mockImplementation(async (url) => {
    if (url.endsWith("/task-1/evaluation/")) {
      return {
        status: 200,
        data: { rubricEvaluation: {
          rubricName: "Stage 1 rubric",
          totalScore: 8,
          scale: 10,
          summary: "Good use of evidence.",
          sections: [],
        } },
      };
    }
    if (url.endsWith("/task-2/evaluation/")) {
      return { status: 200, data: { evaluation: "Clear analysis of the transcript." } };
    }
    const number = url.endsWith("/task-1") ? 1 : 2;
    const phase = stagePlan[number - 1];
    return {
      status: 200,
      data: {
        session: session(number),
        replication: { name: "Activity", duration: 0, form: "https://example.test/feedback" },
        showReferenceSolution: false,
        leia: {
          showReferenceSolution: false,
          configuration: { ...phase, evaluationMode: "rubric" },
          leia: { spec: {
            persona: { spec: { firstName: "LEIA" } },
            problem: { spec: { description: `Task for Stage ${number}`, solutionFormat: "text", initialSolution: "My answer" } },
            behaviour: { spec: {} },
          } },
        },
        messages: [{ id: "msg-1", text: "Hello", isLeia: true, timestamp: "2026-11-25T12:00:00Z" }],
      },
    };
  });
  const post = vi.spyOn(axios, "post").mockImplementation(async (url, body) => {
    if (url.endsWith("/task-1/result")) {
      finishedStages.set(1, {
        finishedAt: completedAt,
        result: body.result,
        spectateUrl: "https://example.test/conversation",
      });
      return { status: 200, data: session(1) };
    }
    if (url.endsWith("/task-1/next-stage")) return { status: 201, data: { sessionId: "task-2" } };
    if (url.endsWith("/task-2/finish")) {
      finishedStages.set(2, {
        finishedAt: completedAt,
        spectateUrl: "https://example.test/final-conversation",
      });
      return { status: 200, data: session(2) };
    }
    throw new Error(`Unexpected POST ${url}`);
  });
  const open = (path: string) => render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/chat/:sessionId" element={<Chat />} />
        <Route path="/edit" element={<Edit />} />
      </Routes>
    </MemoryRouter>,
  );

  const view = open("/chat/task-1");
  const introProgress = within(await screen.findByRole("region", { name: "Activity progress" }));
  expect(introProgress.getAllByRole("listitem")).toHaveLength(2);
  expect(introProgress.getByText("Send solution")).toBeTruthy();
  expect(introProgress.getByText("Review transcript")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Start Stage 1" }));
  expect(screen.getByRole("img", { name: "LEIA Logo" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Continue to solution" }));
  expect(screen.getByRole("img", { name: "LEIA Logo" })).toBeTruthy();
  expect(screen.queryByText("Stage 1 of 2")).toBeNull();
  expect(within(screen.getByRole("region", { name: "Activity progress" }))
    .getByText("Send solution").getAttribute("aria-current")).toBe("step");
  fireEvent.click(screen.getByRole("button", { name: "Send solution" }));
  const confirmation = screen.getByRole("dialog", { name: "Send your solution?" });
  expect(within(confirmation).getByText(/Stage 2 comes next/)).toBeTruthy();
  fireEvent.click(within(confirmation).getByRole("button", { name: "Send solution" }));

  await screen.findByRole("heading", { name: "Stage 1 completed" });
  expect(screen.queryByRole("link", { name: "Open feedback form" })).toBeNull();
  expect(post).toHaveBeenCalledExactlyOnceWith("http://backend.test/api/v1/interactions/task-1/result", { result: "My answer" });
  const review = screen.getByRole("button", { name: "Review your solution" });
  const continueStage = screen.getByRole("button", { name: "Continue to Stage 2" });
  const actions = review.closest("footer");
  expect(continueStage.closest("footer")).toBe(actions);
  expect(screen.queryByLabelText("Conversation viewer link (valid for 1 year)")).toBeNull();
  const rubric = await screen.findByRole("region", { name: "Evaluation" });
  expect(within(rubric).getByText("Stage 1 rubric")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Evaluation" })).toBeNull();
  expect(rubric.contains(continueStage)).toBe(false);
  fireEvent.click(review);
  fireEvent.click(screen.getByRole("button", { name: "Back to completion" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to Stage 2" }));
  const instructions = await screen.findByRole("region", { name: "What you’ll do" });
  expect(within(instructions).getByText("Task for Stage 2")).toBeTruthy();
  expect(screen.getByText("Review the transcript for this stage.")).toBeTruthy();
  const start = screen.getByRole("button", { name: "Start Stage 2" });
  expect(instructions.contains(start)).toBe(false);
  fireEvent.click(start);
  fireEvent.click(screen.getByRole("button", { name: "Finish Stage 2" }));
  await screen.findByRole("heading", { name: "Activity complete" });
  expect(screen.getByText("Thank you for completing the activity.")).toBeTruthy();
  const finalViewer = screen.getByLabelText("Conversation viewer link (valid for 1 year)") as HTMLInputElement;
  expect(finalViewer.value).toBe("https://example.test/final-conversation");
  const evaluation = await screen.findByText("Clear analysis of the transcript.");
  const backToHome = screen.getByRole("button", { name: "Back to home" });
  expect(evaluation.compareDocumentPosition(backToHome) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open feedback form" }).getAttribute("href")).toBe("https://example.test/feedback");
  expect(post).toHaveBeenCalledTimes(3);

  view.unmount();
  open("/chat/task-2");
  await screen.findByRole("heading", { name: "Activity complete" });
  expect(post).toHaveBeenCalledTimes(3);
}, 15000);

vi.mock("@leia-org/luke-client", () => ({
  useLuke: vi.fn(),
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: "<svg></svg>" }),
  },
}));

vi.mock("../../src/components/FormatEditor", () => ({
  FormatEditor: ({ value }: { value: string }) => (
    <textarea aria-label="Solution editor" readOnly value={value} />
  ),
}));

vi.mock("../../src/components/FormatPreview", () => ({
  FormatPreview: () => <div data-testid="format-preview" />,
}));

const singleOrchestration = {
  mode: "single" as const,
  maxInternalTurns: 2,
  openingLeiaId: null,
  problemLeiaId: null,
  sharedTask: "",
};

const makeLeia = (id: string, name: string, stageId: string) => ({
  id,
  stageId,
  configuration: {
    mode: "standard",
    askSolution: true,
    evaluateSolution: false,
    showSolution: false,
  },
  runnerConfiguration: {
    modelName: "gpt-4.1",
    apiKeyId: "key-1",
    audioMode: null,
  },
  sessionCount: 0,
  leia: {
    id,
    metadata: { name },
    spec: {
      behaviour: { spec: { description: "Guide the student." } },
      problem: { spec: {} },
      persona: { spec: {} },
    },
  },
});

const buildStagedReplication = (
  stage2PrevConv?: StagePreviousConversationConfig,
  stage3PrevConv?: StagePreviousConversationConfig,
): ReplicationData => ({
  id: "rep-1",
  name: "Three-stage replication",
  isActive: false,
  duration: null,
  isRepeatable: false,
  isShared: false,
  code: "STG123",
  createdAt: "",
  updatedAt: "",
  form: null,
  language: "en",
  experiment: {
    name: "Three-stage experiment",
    stages: [
      { id: "s1", orchestration: singleOrchestration },
      {
        id: "s2",
        orchestration: {
          mode: "multi",
          maxInternalTurns: 2,
          openingLeiaId: "l2a",
          problemLeiaId: "l2a",
          sharedTask: "",
        },
        ...(stage2PrevConv ? { previousConversation: stage2PrevConv } : {}),
      },
      {
        id: "s3",
        orchestration: singleOrchestration,
        ...(stage3PrevConv ? { previousConversation: stage3PrevConv } : {}),
      },
    ],
    leias: [
      makeLeia("l1", "Interviewer", "s1"),
      makeLeia("l2a", "Reviewer A", "s2"),
      makeLeia("l2b", "Reviewer B", "s2"),
      makeLeia("l3", "Synthesizer", "s3"),
    ],
  },
});

const commonLeiasProps = {
  onLeiaSelect: vi.fn(),
  availableModels: ["gpt-4.1"],
  hasFetchedAvailableModels: true,
  apiKeys: [],
  apiKeyProvidersMapped: { openai: ["gpt-4.1"] },
  providerProviderModuleMap: { openai: "openai-responses" },
  onLocalLeiaChange: vi.fn(),
  onLocalLeiaReset: vi.fn(),
  onLeiaUpdate: vi.fn().mockResolvedValue(true),
  onToggleAskSolution: vi.fn().mockResolvedValue(undefined),
  onToggleEvaluateSolution: vi.fn().mockResolvedValue(undefined),
  onToggleShowSolution: vi.fn().mockResolvedValue(undefined),
  onStartTestSession: vi.fn(),
  startingSessionLeiaId: null,
  invalidLeiaFields: {},
};

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  vi.stubEnv("VITE_APP_BACKEND", "http://backend.test");
});

describe("LeiasSection previous conversation stage configuration", () => {
  test("hides configuration on Stage 1 and renders stage-level controls on stages n>1 (including secondary MultiLEIA actors)", async () => {
    const onUpdateStagePreviousConversation = vi.fn().mockResolvedValue(undefined);
    const rep = buildStagedReplication();

    const { rerender } = render(
      <MemoryRouter>
        <LeiasSection
          {...commonLeiasProps}
          replication={rep}
          localReplication={rep}
          activeLeiaId="l1"
          onUpdateStagePreviousConversation={onUpdateStagePreviousConversation}
        />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("switch", { name: "Show Conversation button" }),
    ).toBeNull();

    // Stage 2 secondary MultiLEIA actor still sees and can edit the Stage 2 setting.
    rerender(
      <MemoryRouter>
        <LeiasSection
          {...commonLeiasProps}
          replication={rep}
          localReplication={rep}
          activeLeiaId="l2b"
          onUpdateStagePreviousConversation={onUpdateStagePreviousConversation}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Applies to all LEIAs in Stage 2/i)).toBeTruthy();
    const toggle = screen.getByRole("switch", {
      name: "Show Conversation button",
    }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(toggle.disabled).toBe(false);

    fireEvent.click(toggle);
    await waitFor(() =>
      expect(onUpdateStagePreviousConversation).toHaveBeenCalledWith("s2", {
        enabled: true,
        sourceStageId: "s1",
        availability: "both",
      }),
    );
  });

  test("lets instructors pick an earlier source stage and toggle Chat only vs Chat & Editor on Stage 3", async () => {
    const onUpdateStagePreviousConversation = vi.fn().mockResolvedValue(undefined);
    const rep = buildStagedReplication(undefined, {
      enabled: true,
      sourceStageId: "s2",
      availability: "both",
    });

    render(
      <MemoryRouter>
        <LeiasSection
          {...commonLeiasProps}
          replication={rep}
          localReplication={rep}
          activeLeiaId="l3"
          onUpdateStagePreviousConversation={onUpdateStagePreviousConversation}
        />
      </MemoryRouter>,
    );

    const chatOnlyButton = screen.getByRole("button", { name: "Chat only" });
    fireEvent.click(chatOnlyButton);

    await waitFor(() =>
      expect(onUpdateStagePreviousConversation).toHaveBeenCalledWith("s3", {
        enabled: true,
        sourceStageId: "s2",
        availability: "chat",
      }),
    );

    // Change source stage via MUI Select listbox to Stage 1.
    const selectButton = screen.getByRole("combobox", {
      name: "Previous conversation source stage",
    });
    fireEvent.mouseDown(selectButton);
    const stage1Option = await screen.findByRole("option", {
      name: /Stage 1 · Interviewer/,
    });
    fireEvent.click(stage1Option);

    await waitFor(() =>
      expect(onUpdateStagePreviousConversation).toHaveBeenCalledWith("s3", {
        enabled: true,
        sourceStageId: "s1",
        availability: "both",
      }),
    );
  });
});

describe("PreviousConversationWidget", () => {
  test("fetches and displays previous stage messages including MultiLEIA actors, and closes on X", async () => {
    const getSpy = vi.spyOn(axios, "get").mockResolvedValue({
      data: {
        stage: { number: 1, total: 2 },
        availability: "both",
        interactionMode: "multi",
        mode: "standard",
        audioMode: null,
        leiaName: "Elena",
        personaAvatar: null,
        actors: [
          { id: "l1", name: "Elena", avatar: null },
          { id: "l1b", name: "Lucia", avatar: null },
        ],
        messages: [
          {
            id: "m1",
            text: "Could you explain the requirements?",
            isLeia: false,
            timestamp: "2026-11-24T10:00:00Z",
          },
          {
            id: "m2",
            text: "Sure! Let's review **actors** first.",
            isLeia: true,
            senderId: "l1b",
            senderName: "Lucia",
            timestamp: "2026-11-24T10:01:00Z",
          },
        ],
      },
    });
    const onClose = vi.fn();

    render(
      <PreviousConversationWidget
        sessionId="sess-2"
        stageNumber={1}
        view="chat"
        onClose={onClose}
      />,
    );

    expect(await screen.findByText("Could you explain the requirements?")).toBeTruthy();
    expect(screen.getByText("Lucia")).toBeTruthy();
    expect(screen.getByText("Conversation · Stage 1")).toBeTruthy();
    expect(getSpy).toHaveBeenCalledWith(
      "http://backend.test/api/v1/interactions/sess-2/previous-conversation",
      { params: { view: "chat" } },
    );

    fireEvent.click(screen.getByRole("button", { name: "Close conversation" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("shows an empty state when no messages were recorded and supports retry on error", async () => {
    const getSpy = vi
      .spyOn(axios, "get")
      .mockRejectedValueOnce(new Error("Network down"))
      .mockResolvedValueOnce({
        data: {
          stage: { number: 1, total: 2 },
          availability: "both",
          interactionMode: "single",
          mode: "standard",
          audioMode: null,
          leiaName: "Elena",
          messages: [],
        },
      });

    render(
      <PreviousConversationWidget
        sessionId="sess-2"
        stageNumber={1}
        view="editor"
        onClose={vi.fn()}
      />,
    );

    expect(
      await screen.findByText("Could not load the previous conversation."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByText("No messages were recorded in Stage 1."),
    ).toBeTruthy();
    expect(getSpy).toHaveBeenCalledTimes(2);
  });
});

describe("Student Conversation button in Chat and Edit views", () => {
  test("Chat renders Conversation button next to Notes when enabled and opens the floating viewer", async () => {
    vi.spyOn(axios, "get").mockImplementation(async (url) => {
      if (url.endsWith("/api/v1/interactions/sess-2")) {
        return {
          status: 200,
          data: {
            session: {
              id: "sess-2",
              runId: "run-1",
              isTest: false,
              startedAt: "2026-11-24T11:00:00Z",
              finishedAt: null,
              isRunnerInitialized: true,
              stage: { number: 2, total: 2, hasNext: false },
              previousConversation: {
                enabled: true,
                stageNumber: 1,
                availability: "chat",
              },
            },
            replication: {
              name: "Rep",
              duration: 0,
              isActive: true,
              isRepeatable: false,
              code: "ABC",
              form: "",
            },
            leia: {
              id: "l2",
              configuration: {
                mode: "standard",
                askSolution: true,
                evaluateSolution: false,
                data: {},
              },
              leia: {
                id: "doc-2",
                spec: {
                  persona: { spec: { firstName: "Marco" } },
                  problem: { spec: { description: "Stage 2 task" } },
                  behaviour: { spec: {} },
                },
              },
            },
            messages: [],
          },
        };
      }
      return {
        status: 200,
        data: {
          stage: { number: 1, total: 2 },
          availability: "chat",
          interactionMode: "single",
          mode: "standard",
          audioMode: null,
          leiaName: "Elena",
          messages: [
            {
              id: "prev-1",
              text: "Message from Stage 1",
              isLeia: false,
              timestamp: "2026-11-24T10:00:00Z",
            },
          ],
        },
      };
    });

    render(
      <MemoryRouter initialEntries={["/chat/sess-2"]}>
        <Routes>
          <Route path="/chat/:sessionId" element={<Chat />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Start Stage 2" }, { timeout: 3000 }));

    const conversationButton = await screen.findByRole(
      "button",
      { name: "Conversation" },
      { timeout: 3000 },
    );
    fireEvent.click(conversationButton);

    expect(await screen.findByText("Message from Stage 1")).toBeTruthy();
  });

  test("Edit shows Conversation button only when availability is both and hides it when chat-only", async () => {
    const getSpy = vi.spyOn(axios, "get").mockResolvedValue({
      status: 200,
      data: {
        stage: { number: 1, total: 2 },
        availability: "both",
        interactionMode: "single",
        mode: "standard",
        audioMode: null,
        leiaName: "Elena",
        messages: [
          {
            id: "prev-1",
            text: "Earlier stage message in editor",
            isLeia: true,
            timestamp: "2026-11-24T10:00:00Z",
          },
        ],
      },
    });

    localStorage.setItem("sessionId", "sess-2");
    localStorage.setItem("exercise", JSON.stringify({ solutionFormat: "text" }));
    localStorage.setItem(
      "session",
      JSON.stringify({
        id: "sess-2",
        stage: { number: 2, total: 2, hasNext: false },
        previousConversation: {
          enabled: true,
          stageNumber: 1,
          availability: "chat",
        },
      }),
    );

    const { unmount } = render(
      <MemoryRouter>
        <Edit />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Conversation" })).toBeNull();
    unmount();

    localStorage.setItem(
      "session",
      JSON.stringify({
        id: "sess-2",
        stage: { number: 2, total: 2, hasNext: false },
        previousConversation: {
          enabled: true,
          stageNumber: 1,
          availability: "both",
        },
      }),
    );

    render(
      <MemoryRouter>
        <Edit />
      </MemoryRouter>,
    );

    const conversationButton = await screen.findByRole("button", {
      name: "Conversation",
    });
    fireEvent.click(conversationButton);

    expect(
      await screen.findByText("Earlier stage message in editor"),
    ).toBeTruthy();
    expect(getSpy).toHaveBeenCalledWith(
      "http://backend.test/api/v1/interactions/sess-2/previous-conversation",
      { params: { view: "editor" } },
    );
  });
});
