import React, { useCallback, useEffect, useState } from "react";
import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { describeTestRun, type TestRunRecord } from "../../lib/testRuns";
import { TEST_STATUS_STYLE as STATUS_STYLE } from "./eventStyles";
import { TestRunCard } from "./TestRunCard";

// Instructor view of the code editor's test runs: when each one happened, who
// started it, what failed and (on demand) the code that was tested.

const testRunElementId = (runId: string) => `test-run-${runId}`;

/** Compact line shown inside a transcript at the moment a run happened. */
export const TestRunMarker: React.FC<{
  run: TestRunRecord;
  formatDate: (s: string) => string;
  onClick?: () => void;
}> = ({ run, formatDate, onClick }) => {
  const style = STATUS_STYLE[run.status] ?? STATUS_STYLE.error;
  return (
    <Box sx={{ display: "flex", justifyContent: "center" }}>
      <ButtonBase
        onClick={onClick}
        disabled={!onClick}
        title={onClick ? "Show this test run" : undefined}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          px: 1.25,
          py: 0.25,
          borderRadius: 999,
          border: "1px dashed",
          borderColor: "divider",
          fontSize: 11,
          color: "text.secondary",
          "&:hover": { bgcolor: "surfaces.hover" },
        }}
      >
        <PlayArrowRoundedIcon sx={{ fontSize: 14, color: style.color }} />
        <span>
          Tests run by {run.trigger === "leia" ? "LEIA" : "student"} ·{" "}
          <Box component="span" sx={{ color: style.color, fontWeight: 600 }}>
            {describeTestRun(run)}
          </Box>{" "}
          · {formatDate(run.createdAt)}
        </span>
      </ButtonBase>
    </Box>
  );
};

interface TestRunsSectionProps {
  runs: TestRunRecord[];
  /** Fetches the session's runs including their code. Called when a code
   *  snapshot is opened and the code is not loaded yet. */
  loadCode: () => Promise<TestRunRecord[]>;
  formatDate: (s: string) => string;
  /** Total number of runs when `runs` only holds the most recent ones. */
  totalCount?: number;
  /** Run to scroll to and highlight. `at` changes on every request so the
   *  same run can be focused again. */
  focus?: { id: string; at: number } | null;
}

export const TestRunsSection: React.FC<TestRunsSectionProps> = ({
  runs,
  loadCode,
  formatDate,
  totalCount,
  focus,
}) => {
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [codeById, setCodeById] = useState<Record<string, string>>({});
  const [truncatedById, setTruncatedById] = useState<Record<string, boolean>>({});
  const [loadingCode, setLoadingCode] = useState(false);
  const [codeLoaded, setCodeLoaded] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const fetchCode = useCallback(async () => {
    setLoadingCode(true);
    setCodeError(null);
    try {
      const full = await loadCode();
      const code: Record<string, string> = {};
      const truncated: Record<string, boolean> = {};
      for (const run of full) {
        code[run.id] = run.code ?? "";
        truncated[run.id] = run.codeTruncated === true;
      }
      setCodeById(code);
      setTruncatedById(truncated);
      setCodeLoaded(true);
    } catch {
      setCodeError("The code could not be loaded.");
    } finally {
      setLoadingCode(false);
    }
  }, [loadCode]);

  const toggleCode = (runId: string) => {
    const opening = !openIds[runId];
    setOpenIds((prev) => ({ ...prev, [runId]: opening }));
    // One request brings the code of every run of the session; a run that
    // arrived after that (live) triggers a new one.
    if (opening && codeById[runId] === undefined && !loadingCode) void fetchCode();
  };

  useEffect(() => {
    if (!focus) return;
    document
      .getElementById(testRunElementId(focus.id))
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(focus.id);
    const timer = window.setTimeout(() => setHighlightId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [focus]);

  if (runs.length === 0) return null;

  const total = Math.max(totalCount ?? 0, runs.length);
  const firstNumber = total - runs.length + 1;

  return (
    <>
      <Typography
        variant="overline"
        sx={{ display: "block", mb: 1.5, color: "text.disabled" }}
      >
        Test runs ({total})
      </Typography>
      {total > runs.length && (
        <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1.5 }}>
          Showing the latest {runs.length}. The Conversations page lists them all.
        </Typography>
      )}
      <Stack gap={1.5} sx={{ mb: 1 }}>
        {runs.map((run, index) => (
          <TestRunCard
            key={run.id}
            run={run}
            number={firstNumber + index}
            formatDate={formatDate}
            elementId={testRunElementId(run.id)}
            highlighted={highlightId === run.id}
            codeOpen={Boolean(openIds[run.id])}
            onToggleCode={() => toggleCode(run.id)}
            code={codeById[run.id]}
            codeTruncated={truncatedById[run.id]}
            codeLoading={loadingCode}
            codeError={codeError}
            codeMissing={codeLoaded && !loadingCode}
            onRetryCode={() => void fetchCode()}
          />
        ))}
      </Stack>
    </>
  );
};

export default TestRunsSection;
