import React from "react";
import ReactMarkdown from "react-markdown";
import {
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

export interface RubricEvaluatedCriterion {
  name: string;
  selectedLevel: string;
  selectedLevelIndex: number;
  score: number;
  justification: string;
}

export interface RubricEvaluatedSection {
  title: string;
  weight: number;
  score: number;
  weightedScore?: number;
  levels: string[];
  criteria: RubricEvaluatedCriterion[];
}

export interface RubricEvaluationResult {
  rubricName: string;
  scale: number;
  totalScore: number;
  summary: string;
  sections: RubricEvaluatedSection[];
}

const formatWeight = (weight: number) =>
  Number.isInteger(weight) ? String(weight) : weight.toFixed(1);

export const RubricEvaluationView: React.FC<{
  rubricEvaluation: RubricEvaluationResult;
  compact?: boolean;
}> = ({ rubricEvaluation, compact = false }) => {
  return (
    <Stack spacing={compact ? 1.5 : 2.5}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography
            variant={compact ? "subtitle2" : "subtitle1"}
            fontWeight={700}
            color="text.primary"
          >
            {rubricEvaluation.rubricName || "Rubric Evaluation"}
          </Typography>
          <Chip
            size="small"
            label="Rubric"
            sx={{
              height: 20,
              fontSize: 11,
              fontWeight: 600,
              bgcolor: "rgba(217, 119, 6, 0.12)",
              color: "#B45309",
            }}
          />
        </Stack>
        <Chip
          size="small"
          color="primary"
          label={`${rubricEvaluation.totalScore} / ${rubricEvaluation.scale || 10}`}
          sx={{ fontWeight: 700, fontSize: 12 }}
        />
      </Stack>

      {rubricEvaluation.summary && (
        <Paper
          variant="outlined"
          sx={{
            p: compact ? 1.5 : 2,
            borderRadius: 1.5,
            bgcolor: "surfaces.subtle",
            "& p": { fontSize: 13, lineHeight: 1.55, my: 0.75 },
            "& p:first-of-type": { mt: 0 },
            "& p:last-of-type": { mb: 0 },
          }}
        >
          <ReactMarkdown>{rubricEvaluation.summary}</ReactMarkdown>
        </Paper>
      )}

      {rubricEvaluation.sections.map((section, sectionIdx) => (
        <Paper
          key={`${section.title}-${sectionIdx}`}
          variant="outlined"
          sx={{ borderRadius: 1.5, overflow: "hidden" }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1.5}
            sx={{
              px: 2,
              py: 1,
              bgcolor: "surfaces.subtle",
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="subtitle2" fontWeight={700}>
              {section.title}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                variant="outlined"
                label={`${formatWeight(section.weight)}%`}
                sx={{ height: 20, fontSize: 11 }}
              />
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={`${section.score} / 10`}
                sx={{ height: 20, fontSize: 11, fontWeight: 600 }}
              />
            </Stack>
          </Stack>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" aria-label={`${section.title} evaluation breakdown`}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Criterion</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Level</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }} align="right">
                    Score
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Justification</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {section.criteria.map((criterion, critIdx) => {
                  const levelsCount = Array.isArray(section.levels)
                    ? section.levels.length
                    : 0;
                  const ratio =
                    levelsCount > 1
                      ? criterion.selectedLevelIndex / (levelsCount - 1)
                      : 1;
                  const levelBg =
                    ratio >= 0.75
                      ? "rgba(22, 163, 74, 0.12)"
                      : ratio >= 0.4
                        ? "rgba(217, 119, 6, 0.12)"
                        : "rgba(220, 38, 38, 0.10)";
                  const levelColor =
                    ratio >= 0.75 ? "#15803D" : ratio >= 0.4 ? "#B45309" : "#B91C1C";
                  return (
                    <TableRow key={`${criterion.name}-${critIdx}`}>
                      <TableCell sx={{ verticalAlign: "top", fontWeight: 600, fontSize: 13 }}>
                        {criterion.name}
                      </TableCell>
                      <TableCell sx={{ verticalAlign: "top" }}>
                        <Box>
                          <Chip
                            size="small"
                            label={criterion.selectedLevel}
                            sx={{
                              height: 22,
                              fontSize: 11,
                              fontWeight: 600,
                              bgcolor: levelBg,
                              color: levelColor,
                            }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          verticalAlign: "top",
                          fontSize: 12,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {criterion.score} / 10
                      </TableCell>
                      <TableCell
                        sx={{
                          verticalAlign: "top",
                          fontSize: 13,
                          whiteSpace: "pre-wrap",
                          color: "text.secondary",
                        }}
                      >
                        {criterion.justification || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ))}
    </Stack>
  );
};

export default RubricEvaluationView;
