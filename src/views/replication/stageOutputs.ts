import type { ReplicationData } from "./types";

const SUBMITTED_SOLUTION_REF = /{{\s*previousStage\.outputs\.submitedSolution\s*}}/;

export function getDependentStagesForSubmittedSolution(
  experiment: ReplicationData["experiment"],
  stageId: string | undefined,
): number[] {
  const stages = experiment.stages;
  if (!stages?.length || !stageId) return [];
  const sourceIndex = stages.findIndex(({ id }) => id === stageId);
  if (sourceIndex === -1) return [];

  const dependents: number[] = [];
  stages.forEach((stage, index) => {
    if (index <= sourceIndex) return;
    const stageLeias = experiment.leias.filter((entry) => entry.stageId === stage.id);
    const usesSubmittedSolution = stageLeias.some((entry) =>
      SUBMITTED_SOLUTION_REF.test(entry.leia?.spec?.behaviour?.spec?.description ?? ""),
    );
    if (!usesSubmittedSolution) return;
    if (stage.outputSources?.submitedSolution === stageId) {
      dependents.push(index + 1);
    }
  });
  return dependents;
}
