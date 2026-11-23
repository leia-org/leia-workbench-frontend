import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Collapse,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import CodeIcon from "@mui/icons-material/Code";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import SyntaxHighlighter from "react-syntax-highlighter";
import { docco } from "react-syntax-highlighter/dist/esm/styles/hljs";
import {
  describeTestRun,
  triggerLabel,
  type TestRunRecord,
  type TestRunStatus,
} from "../../lib/testRuns";

// Instructor view of the code editor's test runs: when each one happened, who
// started it, what failed and (on demand) the code that was tested.

const STATUS_STYLE: Record<TestRunStatus, { color: string; bgcolor: string }> = {
  passed: { color: "success.main", bgcolor: "rgba(22,163,74,0.08)" },
  failed: { color: "warning.main", bgcolor: "rgba(217,119,6,0.08)" },
  error: { color: "error.main", bgcolor: "rgba(211,47,47,0.08)" },
};

const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";

const chipSx = { height: 18, fontSize: 10, textTransform: "uppercase" } as const;

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
        {runs.map((run, index) => {
          const style = STATUS_STYLE[run.status] ?? STATUS_STYLE.error;
          const failed = run.results.filter((result) => !result.ok);
          const passed = run.results.filter((result) => result.ok);
          const open = Boolean(openIds[run.id]);
          const code = codeById[run.id];

          return (
            <Paper
              key={run.id}
              id={testRunElementId(run.id)}
              variant="outlined"
              sx={{
                p: 1.5,
                borderRadius: 2,
                borderColor: highlightId === run.id ? "primary.main" : "divider",
                transition: "border-color 0.3s",
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                gap={1}
                flexWrap="wrap"
                sx={{ mb: 0.5 }}
              >
                <Chip
                  size="small"
                  label={describeTestRun(run)}
                  sx={{ ...chipSx, bgcolor: style.bgcolor, color: style.color }}
                />
                <Chip
                  size="small"
                  label={triggerLabel(run.trigger)}
                  sx={{ ...chipSx, bgcolor: "surfaces.subtle", color: "text.secondary" }}
                />
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary" }}>
                  Run {firstNumber + index}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "text.disabled" }}>
                  {formatDate(run.createdAt)} · {run.durationMs} ms
                </Typography>
              </Stack>

              {run.error && (
                <Typography
                  component="pre"
                  sx={{
                    m: 0,
                    mt: 0.5,
                    fontFamily: MONO,
                    fontSize: 12,
                    color: "error.main",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {run.error}
                </Typography>
              )}

              {failed.length > 0 && (
                <Box sx={{ mt: 0.5 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.primary" }}>
                    Failed ({failed.length})
                  </Typography>
                  <Stack component="ul" gap={0.25} sx={{ m: 0, mt: 0.25, pl: 2 }}>
                    {failed.map((result, i) => (
                      <Typography
                        component="li"
                        key={`${result.name}-${i}`}
                        sx={{ fontSize: 12, color: "text.primary", wordBreak: "break-word" }}
                      >
                        {result.name || "(unnamed test)"}
                        <Box component="span" sx={{ color: "text.secondary", fontFamily: MONO, fontSize: 11 }}>
                          {result.error
                            ? ` — ${result.error}`
                            : ` — expected ${result.expected ?? ""}, got ${result.actual ?? ""}`}
                        </Box>
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              )}

              {passed.length > 0 && (
                <Typography sx={{ fontSize: 12, color: "text.disabled", mt: 0.5, wordBreak: "break-word" }}>
                  Passed ({passed.length}): {passed.map((result) => result.name).join(", ")}
                </Typography>
              )}

              {run.trigger === "student" && run.reportedToLeiaAt && (
                <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.5 }}>
                  Result passed to LEIA with the student's next message ({formatDate(run.reportedToLeiaAt)})
                </Typography>
              )}

              <Button
                size="small"
                color="inherit"
                startIcon={<CodeIcon sx={{ fontSize: 14 }} />}
                onClick={() => toggleCode(run.id)}
                sx={{ mt: 0.75, fontSize: 12, color: "text.secondary", textTransform: "none" }}
              >
                {open ? "Hide code" : "View code at this run"}
              </Button>
              <Collapse in={open} unmountOnExit>
                <Paper
                  variant="outlined"
                  sx={{
                    mt: 0.5,
                    borderRadius: 2,
                    bgcolor: "surfaces.subtle",
                    maxHeight: 420,
                    overflow: "auto",
                  }}
                >
                  {code !== undefined ? (
                    <>
                      <SyntaxHighlighter
                        language={run.language}
                        style={docco}
                        showLineNumbers
                        customStyle={{
                          background: "transparent",
                          margin: 0,
                          padding: "12px 16px",
                          fontSize: 12,
                          fontFamily: MONO,
                        }}
                      >
                        {code || " "}
                      </SyntaxHighlighter>
                      {truncatedById[run.id] && (
                        <Typography sx={{ fontSize: 11, color: "text.disabled", px: 2, pb: 1 }}>
                          The code was longer than the stored limit and is cut here.
                        </Typography>
                      )}
                    </>
                  ) : (
                    <Stack direction="row" alignItems="center" gap={1} sx={{ p: 2 }}>
                      {loadingCode && <CircularProgress size={14} />}
                      <Typography sx={{ fontSize: 12, color: codeError ? "error.main" : "text.secondary" }}>
                        {codeError ?? (codeLoaded && !loadingCode ? "No code was stored for this run." : "Loading code…")}
                      </Typography>
                      {codeError && (
                        <Button size="small" onClick={() => void fetchCode()} sx={{ fontSize: 12 }}>
                          Retry
                        </Button>
                      )}
                    </Stack>
                  )}
                </Paper>
              </Collapse>
            </Paper>
          );
        })}
      </Stack>
    </>
  );
};

export default TestRunsSection;
