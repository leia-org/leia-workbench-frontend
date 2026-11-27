import type { TestRunStatus } from "../../lib/testRuns";

// Look shared by the instructor's cards for test runs and session events.

export const TEST_STATUS_STYLE: Record<TestRunStatus, { color: string; bgcolor: string }> = {
  passed: { color: "success.main", bgcolor: "rgba(22,163,74,0.08)" },
  failed: { color: "warning.main", bgcolor: "rgba(217,119,6,0.08)" },
  error: { color: "error.main", bgcolor: "rgba(211,47,47,0.08)" },
};

export const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";

export const chipSx = { height: 18, fontSize: 10, textTransform: "uppercase" } as const;

export const neutralChipSx = { ...chipSx, bgcolor: "surfaces.subtle", color: "text.secondary" } as const;
