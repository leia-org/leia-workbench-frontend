import React from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import CodeIcon from "@mui/icons-material/Code";
import SyntaxHighlighter from "react-syntax-highlighter";
import { docco } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { describeTestRun, triggerLabel, type TestRunRecord } from "../../lib/testRuns";
import { MONO, TEST_STATUS_STYLE, chipSx, neutralChipSx } from "./eventStyles";

// One test run of the code editor as the instructor sees it: when it
// happened, who started it, what failed and (on demand) the code that was
// tested. Loading the code is up to the list that renders the card.

export interface TestRunCardProps {
  run: TestRunRecord;
  /** Position among the session's runs, starting at 1. */
  number: number;
  formatDate: (s: string) => string;
  elementId?: string;
  highlighted?: boolean;
  codeOpen: boolean;
  onToggleCode: () => void;
  /** Code at the run; undefined until it has been loaded. */
  code: string | undefined;
  codeTruncated?: boolean;
  codeLoading?: boolean;
  codeError?: string | null;
  /** The code was asked for and none is stored for this run. */
  codeMissing?: boolean;
  onRetryCode: () => void;
}

export const TestRunCard: React.FC<TestRunCardProps> = ({
  run,
  number,
  formatDate,
  elementId,
  highlighted = false,
  codeOpen,
  onToggleCode,
  code,
  codeTruncated = false,
  codeLoading = false,
  codeError = null,
  codeMissing = false,
  onRetryCode,
}) => {
  const style = TEST_STATUS_STYLE[run.status] ?? TEST_STATUS_STYLE.error;
  const failed = run.results.filter((result) => !result.ok);
  const passed = run.results.filter((result) => result.ok);

  return (
    <Paper
      id={elementId}
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2,
        borderColor: highlighted ? "primary.main" : "divider",
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
        <Chip size="small" label={triggerLabel(run.trigger)} sx={neutralChipSx} />
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary" }}>
          Run {number}
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
        onClick={onToggleCode}
        sx={{ mt: 0.75, fontSize: 12, color: "text.secondary", textTransform: "none" }}
      >
        {codeOpen ? "Hide code" : "View code at this run"}
      </Button>
      <Collapse in={codeOpen} unmountOnExit>
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
              {codeTruncated && (
                <Typography sx={{ fontSize: 11, color: "text.disabled", px: 2, pb: 1 }}>
                  The code was longer than the stored limit and is cut here.
                </Typography>
              )}
            </>
          ) : (
            <Stack direction="row" alignItems="center" gap={1} sx={{ p: 2 }}>
              {codeLoading && <CircularProgress size={14} />}
              <Typography sx={{ fontSize: 12, color: codeError ? "error.main" : "text.secondary" }}>
                {codeError ?? (codeMissing ? "No code was stored for this run." : "Loading code…")}
              </Typography>
              {codeError && (
                <Button size="small" onClick={onRetryCode} sx={{ fontSize: 12 }}>
                  Retry
                </Button>
              )}
            </Stack>
          )}
        </Paper>
      </Collapse>
    </Paper>
  );
};

export default TestRunCard;
