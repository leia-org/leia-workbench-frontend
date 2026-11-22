import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import { LeiasSection } from "../../src/views/replication/sections/LeiasSection";
import RubricEvaluationView from "../../src/components/RubricEvaluationView";
import type { ReplicationData } from "../../src/views/replication/types";

const sampleRubric = {
  apiVersion: "v1",
  metadata: { name: "interview-rubric" },
  spec: {
    evaluationPrompt: "Evaluate {{currentStage.outputs.conversation}}",
    sections: [
      {
        title: "Communication",
        weight: 100,
        levels: ["Initial", "Proficient"],
        criteria: [
          {
            name: "Clarity",
            descriptors: [
              { level: "Initial", description: "Unclear answers" },
              { level: "Proficient", description: "Clear and concise" },
            ],
          },
        ],
      },
    ],
  },
};

const makeReplication = (options: {
  solution?: string;
  rubric?: typeof sampleRubric | null;
  askSolution?: boolean;
  evaluationMode?: "none" | "classic" | "rubric";
  evaluateSolution?: boolean;
}): ReplicationData => ({
  id: "rep-eval",
  name: "Evaluation Replication",
  isActive: false,
  duration: null,
  isRepeatable: false,
  isShared: false,
  code: "EVAL01",
  createdAt: "",
  updatedAt: "",
  form: null,
  language: "en",
  experiment: {
    name: "Evaluation Experiment",
    leias: [
      {
        id: "l1",
        configuration: {
          mode: "standard",
          askSolution: options.askSolution ?? true,
          evaluateSolution: options.evaluateSolution ?? false,
          evaluationMode: options.evaluationMode ?? "none",
          showSolution: true,
        },
        runnerConfiguration: {
          modelName: "gpt-4.1",
          apiKeyId: "key-1",
          audioMode: null,
        },
        sessionCount: 0,
        leia: {
          id: "l1",
          metadata: { name: "LEIA Eval" },
          spec: {
            behaviour: { spec: { description: "Ask questions." } },
            problem: {
              spec: options.solution ? { solution: options.solution } : {},
            },
            persona: { spec: {} },
            ...(options.rubric ? { rubric: options.rubric } : {}),
          },
        },
      },
    ],
  },
});

const baseProps = {
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

describe("LeiasSection exclusive evaluation mode", () => {
  test("enables only available evaluation modes and calls onUpdateEvaluationMode", () => {
    const onUpdateEvaluationMode = vi.fn().mockResolvedValue(undefined);
    const rep = makeReplication({
      solution: "",
      rubric: sampleRubric,
      evaluationMode: "none",
    });

    render(
      <MemoryRouter>
        <LeiasSection
          {...baseProps}
          replication={rep}
          localReplication={rep}
          activeLeiaId="l1"
          onUpdateEvaluationMode={onUpdateEvaluationMode}
        />
      </MemoryRouter>,
    );

    const classicBtn = screen.getByRole("button", { name: "Classic" }) as HTMLButtonElement;
    const rubricBtn = screen.getByRole("button", { name: "Rubric" }) as HTMLButtonElement;
    expect(classicBtn.disabled).toBe(true);
    expect(rubricBtn.disabled).toBe(false);

    fireEvent.click(rubricBtn);
    expect(onUpdateEvaluationMode).toHaveBeenCalledWith(0, "rubric");
  });

  test("locks Ask for student solution when rubric references currentStage.outputs.submitedSolution", () => {
    const rep = makeReplication({
      solution: "ref solution",
      rubric: {
        ...sampleRubric,
        spec: {
          ...sampleRubric.spec,
          evaluationPrompt:
            "Compare {{currentStage.outputs.submitedSolution}} against rubric.",
        },
      },
      askSolution: true,
      evaluationMode: "rubric",
      evaluateSolution: true,
    });

    render(
      <MemoryRouter>
        <LeiasSection
          {...baseProps}
          replication={rep}
          localReplication={rep}
          activeLeiaId="l1"
          onUpdateEvaluationMode={vi.fn().mockResolvedValue(undefined)}
        />
      </MemoryRouter>,
    );

    const askSolutionSwitch = screen.getAllByRole("switch")[0] as HTMLInputElement;
    expect(askSolutionSwitch.checked).toBe(true);
    expect(askSolutionSwitch.disabled).toBe(true);
    expect(
      screen.getByText(/currentStage\.outputs\.submitedSolution/),
    ).toBeTruthy();
  });
});

describe("RubricEvaluationView", () => {
  test("renders overall score, sections, criteria, level and justification", () => {
    render(
      <RubricEvaluationView
        rubricEvaluation={{
          rubricName: "interview-rubric",
          scale: 10,
          totalScore: 8.5,
          summary: "Solid performance overall.",
          sections: [
            {
              title: "Communication",
              weight: 100,
              score: 8.5,
              levels: ["Initial", "Proficient"],
              criteria: [
                {
                  name: "Clarity",
                  selectedLevel: "Proficient",
                  selectedLevelIndex: 1,
                  score: 8.5,
                  justification: "Clear explanations throughout the interview.",
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText("8.5 / 10").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Communication")).toBeTruthy();
    expect(screen.getByText("Clarity")).toBeTruthy();
    expect(screen.getByText("Proficient")).toBeTruthy();
    expect(
      screen.getByText("Clear explanations throughout the interview."),
    ).toBeTruthy();
  });
});
