import React, { useState } from "react";
import {
  Box,
  Button,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import LeiaPreviewDrawer, {
  type ParsedLeia,
} from "../../../components/admin/LeiaPreview";
import type { ReplicationData, ReplicationLeia } from "../types";

const VOICE_OPTIONS: Array<{ value: string; label: string; gender: string }> = [
  { value: "alloy", label: "Alloy - Female", gender: "female" },
  { value: "ash", label: "Ash - Male", gender: "male" },
  { value: "ballad", label: "Ballad - Male", gender: "male" },
  { value: "cedar", label: "Cedar - Male", gender: "male" },
  { value: "coral", label: "Coral - Female", gender: "female" },
  { value: "echo", label: "Echo - Male", gender: "male" },
  { value: "marin", label: "Marin - Female", gender: "female" },
  { value: "sage", label: "Sage - Female", gender: "female" },
  { value: "shimmer", label: "Shimmer - Female", gender: "female" },
  { value: "verse", label: "Verse - Male", gender: "male" },
];

const getFilteredVoiceOptions = (
  pronoun: string | undefined,
  all: boolean,
  selected: string
) => {
  if (!pronoun || all || (pronoun !== "he" && pronoun !== "she")) {
    return VOICE_OPTIONS;
  }
  if (pronoun === "he") {
    return VOICE_OPTIONS.filter(
      (option) => option.gender === "male" || option.value === selected
    );
  }
  return VOICE_OPTIONS.filter(
    (option) => option.gender === "female" || option.value === selected
  );
};

const DEFAULT_PROVIDER = "default";

interface LeiasSectionProps {
  replication: ReplicationData;
  localReplication: ReplicationData;
  activeLeiaId: string | null;
  onLeiaSelect: (leiaId: string) => void;
  availableModels: string[];
  hasFetchedAvailableModels: boolean;
  onLocalLeiaChange: (idx: number, key: string, value: unknown) => void;
  onLocalLeiaReset: (idx: number) => void;
  onLeiaUpdate: (idx: number) => Promise<void>;
  onToggleAskSolution: (idx: number) => Promise<void>;
  onToggleEvaluateSolution: (idx: number) => Promise<void>;
  onStartTestSession: (leiaId: string, replicationId: string) => Promise<void>;
  startingSessionLeiaId: string | null;
}

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    sx={{
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "text.disabled",
      mb: 1.5,
      mt: 3,
    }}
  >
    {children}
  </Typography>
);

const FieldRow: React.FC<{
  label: string;
  children: React.ReactNode;
  helper?: React.ReactNode;
}> = ({ label, children, helper }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: "200px 1fr",
      alignItems: "center",
      py: 1.25,
      borderBottom: "1px solid",
      borderColor: "divider",
      gap: 2,
      "&:last-of-type": { borderBottom: "none" },
    }}
  >
    <Box>
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
        {label}
      </Typography>
      {helper && (
        <Typography
          variant="caption"
          sx={{ display: "block", color: "text.disabled", mt: 0.25 }}
        >
          {helper}
        </Typography>
      )}
    </Box>
    <Box sx={{ minWidth: 0 }}>{children}</Box>
  </Box>
);

interface LeiaEditorProps {
  idx: number;
  item: ReplicationLeia;
  serverItem: ReplicationLeia;
  availableModels: string[];
  onLocalLeiaChange: (idx: number, key: string, value: unknown) => void;
  onLocalLeiaReset: (idx: number) => void;
  onLeiaUpdate: (idx: number) => Promise<void>;
  onToggleAskSolution: (idx: number) => Promise<void>;
  onToggleEvaluateSolution: (idx: number) => Promise<void>;
  onStartTestSession: (leiaId: string, replicationId: string) => Promise<void>;
  replicationId: string;
  startingSessionLeiaId: string | null;
}

const LeiaEditor: React.FC<LeiaEditorProps> = ({
  idx,
  item,
  serverItem,
  availableModels,
  onLocalLeiaChange,
  onLocalLeiaReset,
  onLeiaUpdate,
  onToggleAskSolution,
  onToggleEvaluateSolution,
  onStartTestSession,
  replicationId,
  startingSessionLeiaId,
}) => {
  const [showAllVoices, setShowAllVoices] = useState(false);
  const [contentOpen, setContentOpen] = useState(false);

  const currentProvider = item.runnerConfiguration.provider;
  const isProviderValid = (provider: string) =>
    provider === DEFAULT_PROVIDER || availableModels.includes(provider);
  const isCurrentProviderValid = isProviderValid(currentProvider);
  const baseOptions = [DEFAULT_PROVIDER, ...availableModels];
  const providerOptions = isCurrentProviderValid
    ? baseOptions
    : [currentProvider, ...baseOptions];

  const isStartingAny = Boolean(startingSessionLeiaId);
  const isStartingThis = startingSessionLeiaId === item.id;

  const isDirty =
    JSON.stringify(item) !== JSON.stringify(serverItem);

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 0.5 }}
      >
        <Typography
          sx={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          {item.leia.metadata.name}
        </Typography>
        <Stack direction="row" gap={1}>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<VisibilityOutlinedIcon sx={{ fontSize: 14 }} />}
            onClick={() => setContentOpen(true)}
            sx={{ borderColor: "divider", color: "text.primary" }}
          >
            View content
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            disabled={isStartingAny}
            startIcon={<ScienceOutlinedIcon sx={{ fontSize: 14 }} />}
            onClick={() => onStartTestSession(item.id, replicationId)}
            sx={{ borderColor: "divider", color: "text.primary" }}
          >
            {isStartingThis ? "Starting..." : "Test session"}
          </Button>
        </Stack>
      </Stack>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Mode: <strong>{item.configuration.mode}</strong> · Sessions:{" "}
        <strong>{item.sessionCount}</strong>
      </Typography>

      <SectionLabel>Conversation</SectionLabel>
      <FieldRow
        label="Ask for student solution"
        helper="Student writes a solution at the end."
      >
        <Switch
          size="small"
          checked={item.configuration.askSolution}
          onChange={() => onToggleAskSolution(idx)}
        />
      </FieldRow>
      <FieldRow
        label="Automatic evaluation"
        helper="Run automatic evaluation against the solution."
      >
        <Switch
          size="small"
          checked={item.configuration.evaluateSolution}
          onChange={() => onToggleEvaluateSolution(idx)}
        />
      </FieldRow>

      <SectionLabel>Runner</SectionLabel>
      <FieldRow label="Provider">
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <Select
            value={currentProvider}
            onChange={(e) =>
              onLocalLeiaChange(
                idx,
                "runnerConfiguration.provider",
                e.target.value
              )
            }
            sx={{
              fontSize: 13,
              ...(isCurrentProviderValid
                ? {}
                : {
                    color: "error.main",
                    "& fieldset": { borderColor: "error.main" },
                  }),
            }}
          >
            {providerOptions.map((opt) => (
              <MenuItem key={opt} value={opt} sx={{ fontSize: 13 }}>
                {opt === DEFAULT_PROVIDER
                  ? "default"
                  : isProviderValid(opt)
                  ? opt
                  : `${opt} (no disponible)`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </FieldRow>

      <FieldRow label="Audio mode">
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <Select
            value={item.runnerConfiguration.audioMode || "none"}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "none") {
                onLocalLeiaChange(idx, "runnerConfiguration.audioMode", null);
                onLocalLeiaChange(
                  idx,
                  "runnerConfiguration.hideAudioTranscription",
                  null
                );
              } else if (value === "realtime") {
                onLocalLeiaChange(
                  idx,
                  "runnerConfiguration.audioMode",
                  "realtime"
                );
                if (
                  item.runnerConfiguration.hideAudioTranscription === null ||
                  item.runnerConfiguration.hideAudioTranscription === undefined
                ) {
                  onLocalLeiaChange(
                    idx,
                    "runnerConfiguration.hideAudioTranscription",
                    false
                  );
                }
                if (!item.runnerConfiguration.realtimeConfig) {
                  onLocalLeiaChange(
                    idx,
                    "runnerConfiguration.realtimeConfig",
                    {
                      model: "gpt-4o-realtime-preview",
                      voice: "marin",
                      instructions: "",
                      turnDetection: {
                        type: "server_vad",
                        threshold: 0.5,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 500,
                      },
                    }
                  );
                }
              } else if (value === "luke") {
                onLocalLeiaChange(idx, "runnerConfiguration.audioMode", "luke");
                if (
                  item.runnerConfiguration.hideAudioTranscription === null ||
                  item.runnerConfiguration.hideAudioTranscription === undefined
                ) {
                  onLocalLeiaChange(
                    idx,
                    "runnerConfiguration.hideAudioTranscription",
                    false
                  );
                }
                if (!item.runnerConfiguration.lukeConfig) {
                  onLocalLeiaChange(idx, "runnerConfiguration.lukeConfig", {
                    provider: "gemini",
                    voice: "Puck",
                  });
                }
              }
            }}
            sx={{ fontSize: 13 }}
          >
            <MenuItem value="none" sx={{ fontSize: 13 }}>
              None
            </MenuItem>
            <MenuItem value="realtime" sx={{ fontSize: 13 }}>
              Legacy (OpenAI Realtime)
            </MenuItem>
            <MenuItem value="luke" sx={{ fontSize: 13 }}>
              Luke
            </MenuItem>
          </Select>
        </FormControl>
      </FieldRow>

      {item.runnerConfiguration.audioMode && (
        <FieldRow label="Hide audio transcription">
          <Switch
            size="small"
            checked={
              item.runnerConfiguration.hideAudioTranscription || false
            }
            onChange={(_, checked) =>
              onLocalLeiaChange(
                idx,
                "runnerConfiguration.hideAudioTranscription",
                checked
              )
            }
          />
        </FieldRow>
      )}

      {item.runnerConfiguration.audioMode === "realtime" && (
        <>
          <FieldRow label="Realtime voice">
            <Stack direction="row" alignItems="center" gap={1.5}>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <Select
                  value={
                    item.runnerConfiguration.realtimeConfig?.voice || "marin"
                  }
                  onChange={(e) =>
                    onLocalLeiaChange(
                      idx,
                      "runnerConfiguration.realtimeConfig.voice",
                      e.target.value
                    )
                  }
                  sx={{ fontSize: 13 }}
                >
                  {getFilteredVoiceOptions(
                    item.leia.spec?.persona?.spec?.subjectPronoum,
                    showAllVoices,
                    item.runnerConfiguration.realtimeConfig?.voice || "marin"
                  )?.map((voice) => (
                    <MenuItem
                      key={voice.value}
                      value={voice.value}
                      sx={{ fontSize: 13 }}
                    >
                      {voice.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Switch
                  size="small"
                  checked={showAllVoices}
                  onChange={() => setShowAllVoices(!showAllVoices)}
                />
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Show all voices
                </Typography>
              </Stack>
            </Stack>
          </FieldRow>
        </>
      )}

      {item.runnerConfiguration.audioMode === "luke" && (
        <>
          <FieldRow label="Luke provider">
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <Select
                value={
                  item.runnerConfiguration.lukeConfig?.provider || "gemini"
                }
                onChange={(e) => {
                  const provider = e.target.value;
                  onLocalLeiaChange(
                    idx,
                    "runnerConfiguration.lukeConfig.provider",
                    provider
                  );
                  const defaultVoice =
                    provider === "gemini" ? "Puck" : "alloy";
                  onLocalLeiaChange(
                    idx,
                    "runnerConfiguration.lukeConfig.voice",
                    defaultVoice
                  );
                }}
                sx={{ fontSize: 13 }}
              >
                <MenuItem value="openai" sx={{ fontSize: 13 }}>
                  OpenAI
                </MenuItem>
                <MenuItem value="gemini" sx={{ fontSize: 13 }}>
                  Gemini
                </MenuItem>
              </Select>
            </FormControl>
          </FieldRow>
          <FieldRow label="Luke voice">
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <Select
                value={
                  item.runnerConfiguration.lukeConfig?.voice ||
                  (item.runnerConfiguration.lukeConfig?.provider === "openai"
                    ? "alloy"
                    : "Puck")
                }
                onChange={(e) =>
                  onLocalLeiaChange(
                    idx,
                    "runnerConfiguration.lukeConfig.voice",
                    e.target.value
                  )
                }
                sx={{ fontSize: 13 }}
              >
                {item.runnerConfiguration.lukeConfig?.provider === "openai" ? (
                  [
                    "alloy",
                    "ash",
                    "ballad",
                    "coral",
                    "echo",
                    "sage",
                    "shimmer",
                    "verse",
                  ].map((v) => (
                    <MenuItem key={v} value={v} sx={{ fontSize: 13 }}>
                      {v}
                    </MenuItem>
                  ))
                ) : (
                  ["Puck", "Charon", "Kore", "Fenrir", "Aoede"].map((v) => (
                    <MenuItem key={v} value={v} sx={{ fontSize: 13 }}>
                      {v}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </FieldRow>
        </>
      )}

      <SectionLabel>Tool widgets</SectionLabel>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          color: "text.secondary",
          fontStyle: "italic",
          mt: 1,
        }}
      >
        Tool widgets and their tool functions are configured per activity in the
        problem definition (Designer). The workbench only selects the
        interaction mode here.
      </Typography>

      <Divider sx={{ mt: 4, mb: 3 }} />

      <Stack direction="row" gap={1} justifyContent="flex-end">
        <Button
          variant="outlined"
          color="inherit"
          onClick={() => onLocalLeiaReset(idx)}
          disabled={!isDirty}
          sx={{ borderColor: "divider", color: "text.primary" }}
        >
          Reset
        </Button>
        <Button
          variant="contained"
          disabled={!isDirty}
          onClick={() => onLeiaUpdate(idx)}
        >
          Save
        </Button>
      </Stack>

      <LeiaPreviewDrawer
        leia={contentOpen ? (item.leia as ParsedLeia) : null}
        onClose={() => setContentOpen(false)}
      />
    </Box>
  );
};

export const LeiasSection: React.FC<LeiasSectionProps> = ({
  replication,
  localReplication,
  activeLeiaId,
  onLeiaSelect,
  availableModels,
  onLocalLeiaChange,
  onLocalLeiaReset,
  onLeiaUpdate,
  onToggleAskSolution,
  onToggleEvaluateSolution,
  onStartTestSession,
  startingSessionLeiaId,
}) => {
  const leias = localReplication.experiment.leias;

  // Auto-select first leia if none selected.
  React.useEffect(() => {
    if (!activeLeiaId && leias.length > 0) {
      onLeiaSelect(leias[0].id);
    }
  }, [activeLeiaId, leias, onLeiaSelect]);

  if (leias.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        No LEIAs in this replication.
      </Typography>
    );
  }

  const idx = leias.findIndex((l) => l.id === activeLeiaId);
  const effectiveIdx = idx === -1 ? 0 : idx;
  const item = leias[effectiveIdx];
  const serverItem = replication.experiment.leias[effectiveIdx];

  return (
    <Box sx={{ maxWidth: 880 }}>
      <LeiaEditor
        idx={effectiveIdx}
        item={item}
        serverItem={serverItem}
        availableModels={availableModels}
        onLocalLeiaChange={onLocalLeiaChange}
        onLocalLeiaReset={onLocalLeiaReset}
        onLeiaUpdate={onLeiaUpdate}
        onToggleAskSolution={onToggleAskSolution}
        onToggleEvaluateSolution={onToggleEvaluateSolution}
        onStartTestSession={onStartTestSession}
        replicationId={replication.id}
        startingSessionLeiaId={startingSessionLeiaId}
      />
    </Box>
  );
};

export default LeiasSection;

// Silence unused warnings for fields we keep in props for future use.
void InputLabel;
