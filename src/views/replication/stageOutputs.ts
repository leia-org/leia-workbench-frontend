import type {
  ReplicationData,
  ReplicationLeia,
  StagePreviousResourceConfig,
} from "./types";

const SUBMITTED_SOLUTION_REF = /{{\s*previousStage\.outputs\.submitedSolution\s*}}/;
const CURRENT_STAGE_SUBMITTED_SOLUTION_REF = /{{\s*currentStage\.outputs\.submitedSolution\s*}}/;

export function rubricRequiresSubmittedSolution(
  leia: ReplicationLeia["leia"] | undefined,
): boolean {
  const prompt = leia?.spec?.rubric?.spec?.evaluationPrompt;
  return typeof prompt === "string" && CURRENT_STAGE_SUBMITTED_SOLUTION_REF.test(prompt);
}

export function getStageProblemLeia(
  experiment: ReplicationData["experiment"],
  stageId: string | undefined,
): ReplicationLeia | null {
  if (!stageId) return null;
  const stage = experiment.stages?.find(({ id }) => id === stageId);
  const stageEntries = experiment.leias.filter((entry) => entry.stageId === stageId);
  if (!stageEntries.length) return null;
  const problemLeiaId =
    stage?.orchestration?.problemLeiaId ||
    stage?.orchestration?.openingLeiaId ||
    stageEntries[0]?.id;
  return (
    stageEntries.find((entry) => String(entry.id) === String(problemLeiaId)) ??
    stageEntries[0] ??
    null
  );
}

export function getEffectiveLeiaPreviousResourceConfig(
  experiment: ReplicationData["experiment"],
  stageId: string | undefined,
  leia: ReplicationLeia | undefined,
  resourceKey: "previousConversation" | "previousSubmittedSolution",
): StagePreviousResourceConfig | undefined {
  if (!stageId) return undefined;
  const stage = experiment.stages?.find(({ id }) => id === stageId);
  if (!stage) return undefined;
  const targetLeia =
    stage.orchestration?.mode === "multi"
      ? getStageProblemLeia(experiment, stageId)
      : leia;
  const leiaConfig = targetLeia?.configuration?.[resourceKey];
  if (leiaConfig !== undefined) return leiaConfig;
  return stage[resourceKey];
}

export function stageHasAskSolutionEnabled(
  experiment: ReplicationData["experiment"],
  stageId: string | undefined,
): boolean {
  if (!stageId) return false;
  const stage = experiment.stages?.find(({ id }) => id === stageId);
  const stageEntries = experiment.leias.filter((entry) => entry.stageId === stageId);
  if (!stageEntries.length) return false;
  if (stage?.orchestration?.mode === "multi") {
    const problemLeia = getStageProblemLeia(experiment, stageId);
    return Boolean(problemLeia && problemLeia.configuration?.askSolution !== false);
  }
  return stageEntries.every((entry) => entry.configuration?.askSolution !== false);
}

export function getDependentStagesForSubmittedSolution(
  experiment: ReplicationData["experiment"],
  stageId: string | undefined,
): number[] {
  const stages = experiment.stages;
  if (!stages?.length || !stageId) return [];
  const sourceIndex = stages.findIndex(({ id }) => id === stageId);
  if (sourceIndex === -1) return [];

  const dependents = new Set<number>();
  stages.forEach((stage, index) => {
    if (index <= sourceIndex) return;
    const stageLeias = experiment.leias.filter((entry) => entry.stageId === stage.id);
    const usesSubmittedSolutionInPrompt = stageLeias.some(
      (entry) =>
        SUBMITTED_SOLUTION_REF.test(entry.leia?.spec?.behaviour?.spec?.description ?? "") ||
        SUBMITTED_SOLUTION_REF.test(entry.leia?.spec?.rubric?.spec?.evaluationPrompt ?? ""),
    );
    if (usesSubmittedSolutionInPrompt && stage.outputSources?.submitedSolution === stageId) {
      dependents.add(index + 1);
    }

    const targetLeias =
      stage.orchestration?.mode === "multi"
        ? [getStageProblemLeia(experiment, stage.id)].filter(
            (entry): entry is ReplicationLeia => Boolean(entry),
          )
        : stageLeias;
    const usesSubmittedSolutionViewer = targetLeias.some((entry) => {
      const config = getEffectiveLeiaPreviousResourceConfig(
        experiment,
        stage.id,
        entry,
        "previousSubmittedSolution",
      );
      return Boolean(config?.enabled && config.sourceStageId === stageId);
    });
    if (usesSubmittedSolutionViewer) {
      dependents.add(index + 1);
    }
  });
  return [...dependents].sort((a, b) => a - b);
}
