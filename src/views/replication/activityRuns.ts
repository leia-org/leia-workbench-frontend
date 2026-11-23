export interface StageSessionLike {
  id: string;
  run?: string | null;
  runId?: string | null;
  stageId?: string | null;
  stageIndex?: number | null;
  stageNumber?: number | null;
  stageTotal?: number | null;
  leia?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  score?: number | null;
  user?: { email?: string; id?: string } | null;
}

export interface ActivityRunGroup<T extends StageSessionLike> {
  key: string;
  runId: string | null;
  sessions: T[];
  user: T["user"];
  startedAt: string;
  finishedAt: string | null;
  stageTotal: number | null;
  isStaged: boolean;
  isCompleted: boolean;
  hasActiveStage: boolean;
  currentSession: T;
}

export interface LeiaDisplayInfo {
  name: string;
  solutionFormat: string | null;
}

function stageOrder(session: StageSessionLike): number {
  if (typeof session.stageNumber === "number") return session.stageNumber;
  if (typeof session.stageIndex === "number") return session.stageIndex + 1;
  return Number.MAX_SAFE_INTEGER;
}

export function groupSessionsByRun<T extends StageSessionLike>(
  sessions: T[],
  fallbackStageTotal: number | null = null,
): ActivityRunGroup<T>[] {
  const buckets = new Map<string, { runId: string | null; items: T[] }>();

  for (const session of sessions) {
    const runId = session.runId || session.run || null;
    const key = runId ? `run:${runId}` : `session:${session.id}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(session);
    } else {
      buckets.set(key, { runId, items: [session] });
    }
  }

  const groups: ActivityRunGroup<T>[] = [];
  for (const [key, { runId, items }] of buckets.entries()) {
    const sorted = [...items].sort((a, b) => {
      const orderDiff = stageOrder(a) - stageOrder(b);
      if (orderDiff !== 0) return orderDiff;
      return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
    });

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const stageTotal =
      sorted.find((s) => typeof s.stageTotal === "number" && s.stageTotal > 0)?.stageTotal ??
      fallbackStageTotal;
    const isStaged = Boolean(
      runId ||
        sorted.some((s) => s.stageId || typeof s.stageNumber === "number") ||
        (stageTotal !== null && stageTotal > 1),
    );
    const hasActiveStage = sorted.some((s) => !s.finishedAt);
    const currentSession = sorted.find((s) => !s.finishedAt) ?? last;
    const reachedFinalStage =
      stageTotal === null ||
      sorted.length >= stageTotal ||
      (typeof last.stageNumber === "number" && last.stageNumber >= stageTotal);
    const isCompleted = !hasActiveStage && Boolean(last.finishedAt) && reachedFinalStage;

    groups.push({
      key,
      runId,
      sessions: sorted,
      user: first.user ?? last.user ?? null,
      startedAt: first.startedAt,
      finishedAt: isCompleted ? (last.finishedAt ?? null) : null,
      stageTotal,
      isStaged,
      isCompleted,
      hasActiveStage,
      currentSession,
    });
  }

  return groups.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

export function resolveSolutionFormatForLeia(
  leiaId: string | null | undefined,
  leiaInfoById: Record<string, LeiaDisplayInfo>,
  fallbackFormat: string | null,
): string | null {
  if (leiaId && leiaInfoById[leiaId]?.solutionFormat) {
    return leiaInfoById[leiaId].solutionFormat;
  }
  return fallbackFormat;
}
