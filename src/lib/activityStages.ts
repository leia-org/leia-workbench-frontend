import type {
  StageOutput,
  StageOutputSources,
  StagePreviousConversationConfig,
  StagePreviousResourceConfig,
} from "../views/replication/types";

export interface ActivityOrchestration {
  mode: "single" | "multi";
  maxInternalTurns?: number;
  openingLeiaId?: string | null;
  problemLeiaId?: string | null;
  sharedTask?: string;
}

export interface ActivityStage {
  id: string;
  outputSources?: StageOutputSources;
  previousConversation?: StagePreviousConversationConfig;
  previousSubmittedSolution?: StagePreviousResourceConfig;
  orchestration?: ActivityOrchestration;
}

export interface ActivityLeiaRef {
  id?: string;
  stageId?: string;
  configuration?: {
    mode?: string;
  };
  leia?:
    | {
        id?: string;
        metadata?: { name?: string };
        spec?: {
          behaviour?: { spec?: { description?: string } };
          rubric?: { spec?: { evaluationPrompt?: string } };
        };
      }
    | string
    | null;
}

export interface ReplicableExperiment {
  leias?: ActivityLeiaRef[];
  orchestration?: ActivityOrchestration;
  stages?: ActivityStage[];
}

const ANY_PREVIOUS_STAGE_REF = /{{\s*previousStage\b([^{}]*)}}/g;
const STAGE_OUTPUT_KEYS: ReadonlyArray<StageOutput> = [
  "conversation",
  "submitedSolution",
  "problem",
];
const PREVIOUS_STAGE_PROBLEM_FIELDS = [
  "description",
  "details",
  "personaBackground",
  "solution",
  "initialSolution",
  "solutionFormat",
  "evaluationPrompt",
  "process",
] as const;
const SUPPORTED_OUTPUTS = new Map<string, StageOutput>([
  [".outputs.conversation", "conversation"],
  [".outputs.submitedSolution", "submitedSolution"],
  ...PREVIOUS_STAGE_PROBLEM_FIELDS.map(
    (field): [string, StageOutput] => [`.leia.problem.${field}`, "problem"],
  ),
]);
const OUTPUT_LABELS: Record<StageOutput, string> = {
  conversation: "conversation",
  submitedSolution: "submitted solution",
  problem: "problem",
};

function getStageOutputSource(stage: ActivityStage, output: StageOutput): string | null {
  return stage.outputSources?.[output] ?? null;
}

function getLeiaTemplates(leia: ActivityLeiaRef["leia"]): string[] {
  if (!leia || typeof leia !== "object") return [];
  return [
    leia.spec?.behaviour?.spec?.description ?? "",
    leia.spec?.rubric?.spec?.evaluationPrompt ?? "",
  ];
}

export function getActivityReplicationBlocker(
  experiment: ReplicableExperiment | null | undefined,
): string | null {
  if (!experiment) return "Experiment not found";
  const leias = experiment.leias ?? [];
  const stages = experiment.stages;

  if (!stages) {
    if (!leias.length) {
      return "Add at least one LEIA before replicating";
    }
    if (experiment.orchestration?.mode === "multi") {
      if (leias.length < 2) {
        return "MultiLEIA requires at least two LEIAs";
      }
      if (leias.some((entry) => entry.configuration?.mode === "transcription")) {
        return "MultiLEIA currently supports standard text mode only";
      }
    }
    return null;
  }

  const positions = new Map(stages.map(({ id }, index) => [id, index]));
  if (!stages.length || positions.size !== stages.length) {
    return "An activity requires at least one stage and unique stage IDs";
  }
  if (leias.some((entry) => !entry.stageId || !positions.has(entry.stageId))) {
    return "Invalid activity stages";
  }

  for (const [index, stage] of stages.entries()) {
    const number = index + 1;
    const entries = leias.filter((entry) => entry.stageId === stage.id);
    if (!entries.length) {
      return `Stage ${number} requires at least one LEIA`;
    }
    if (entries.some((entry) => !entry.leia)) {
      return `Stage ${number} requires valid LEIAs`;
    }

    const referencedOutputs = new Set<StageOutput>();
    for (const entry of entries) {
      const entryRefs = new Set<StageOutput>();
      for (const template of getLeiaTemplates(entry.leia)) {
        for (const match of template.matchAll(ANY_PREVIOUS_STAGE_REF)) {
          const output = SUPPORTED_OUTPUTS.get(match[1].trimEnd());
          if (!output) {
            return `Stage ${number} contains an unsupported previous stage output`;
          }
          entryRefs.add(output);
        }
      }
      if (entryRefs.size > 0 && entry.configuration?.mode === "transcription") {
        return `Stage ${number} cannot use transcription mode because it uses outputs from an earlier stage`;
      }
      for (const output of entryRefs) {
        referencedOutputs.add(output);
      }
    }

    if (referencedOutputs.size > 0 && index === 0) {
      return "The first stage cannot use previous stage references";
    }

    for (const output of STAGE_OUTPUT_KEYS) {
      const sourceId = getStageOutputSource(stage, output);
      if (sourceId) {
        const sourcePosition = positions.get(sourceId);
        if (sourcePosition === undefined || !(sourcePosition < index)) {
          return `The source of stage ${number} must be an earlier stage`;
        }
      }
      if (referencedOutputs.has(output) && !sourceId) {
        return `Select an earlier stage for ${OUTPUT_LABELS[output]} in stage ${number}`;
      }
    }

    const conversationSourceId = getStageOutputSource(stage, "conversation");
    if (referencedOutputs.has("conversation") && conversationSourceId) {
      const sourceIndex = positions.get(conversationSourceId);
      const sourceHasTranscription = leias.some(
        (entry) =>
          entry.stageId === conversationSourceId &&
          entry.configuration?.mode === "transcription",
      );
      if (sourceIndex !== undefined && sourceHasTranscription) {
        return `Stage ${sourceIndex + 1} cannot use transcription mode because stage ${number} uses its conversation`;
      }
    }

    if (stage.orchestration?.mode === "multi") {
      if (entries.length < 2) {
        return `Stage ${number} requires at least two LEIAs for MultiLEIA`;
      }
      if (entries.some((entry) => entry.configuration?.mode === "transcription")) {
        return "MultiLEIA currently supports standard text mode only";
      }
    }
  }

  return null;
}
