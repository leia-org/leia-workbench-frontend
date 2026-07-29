import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Button,
  Divider,
  FormControl,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import LeiaPreviewDrawer, {
  type ParsedLeia,
} from "../../../components/admin/LeiaPreview";
import InfographicViewer, {
  type InfographicViewerHandle,
} from "../../../components/InfographicViewer";
import {
  buildLeiaInfographicPaths,
  buildStoredImageCandidateSources,
} from "../../../lib/avatar";
import type { ReplicationData, ReplicationLeia } from "../types";
import type { ApiKey } from "../../../models/ApiKeys";
import openAiIcon from "../../../assets/providers/openai.svg";
import geminiIcon from "../../../assets/providers/gemini.svg";
import ollamaIcon from "../../../assets/providers/ollama.svg";

const providerIcons: Record<string, string> = {
  openai: openAiIcon,
  gemini: geminiIcon,
  ollama: ollamaIcon,
};

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

// API keys whose provider can serve the currently selected model. When no
// model is selected, every key is valid.
const getValidApiKeys = (
  modelName: string | null | undefined,
  apiKeys: ApiKey[],
  apiKeyProvidersMapped: Record<string, string[]>
): ApiKey[] => {
  const activeApiKeys = apiKeys.filter((key) => key.isActive !== false);
  if (!modelName) return activeApiKeys;

  const validProviders = Object.entries(apiKeyProvidersMapped)
    .filter(([, models]) => models.includes(modelName))
    .map(([provider]) => provider);

  return activeApiKeys.filter((key) => validProviders.includes(key.provider));
};

interface LeiasSectionProps {
  replication: ReplicationData;
  localReplication: ReplicationData;
  activeLeiaId: string | null;
  onLeiaSelect: (leiaId: string) => void;
  availableModels: string[];
  hasFetchedAvailableModels: boolean;
  apiKeys: ApiKey[];
  apiKeyProvidersMapped: Record<string, string[]>;
  providerProviderModuleMap: Record<string, string>;
  userRole?: string;
  onLocalLeiaChange: (idx: number, key: string, value: unknown) => void;
  onLocalLeiaReset: (idx: number) => void;
  onLeiaUpdate: (idx: number) => Promise<boolean>;
  onToggleAskSolution: (idx: number) => Promise<void>;
  onToggleEvaluateSolution: (idx: number) => Promise<void>;
  onStartTestSession: (
    leiaId: string,
    replicationId: string,
    idx: number
  ) => void;
  startingSessionLeiaId: string | null;
  // Campos inválidos por Leia (clave: leiaId) devueltos por el backend.
  invalidLeiaFields: Record<string, string[]>;
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

const ImageAvailabilityProbe: React.FC<{
  sources: string[];
  onAvailableChange: (available: boolean | null) => void;
}> = ({ sources, onAvailableChange }) => {
  const [idx, setIdx] = React.useState(0);
  const src = sources[idx] || "";

  React.useEffect(() => {
    setIdx(0);
    onAvailableChange(sources.length > 0 ? null : false);
  }, [onAvailableChange, sources]);

  if (!src) return null;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: "none",
      }}
      onLoad={() => onAvailableChange(true)}
      onError={() => {
        const nextIdx = idx + 1;
        if (nextIdx < sources.length) {
          setIdx(nextIdx);
        } else {
          onAvailableChange(false);
        }
      }}
    />
  );
};

interface LeiaEditorProps {
  idx: number;
  item: ReplicationLeia;
  serverItem: ReplicationLeia;
  apiKeys: ApiKey[];
  apiKeyProvidersMapped: Record<string, string[]>;
  providerProviderModuleMap: Record<string, string>;
  userRole?: string;
  onLocalLeiaChange: (idx: number, key: string, value: unknown) => void;
  onLocalLeiaReset: (idx: number) => void;
  onLeiaUpdate: (idx: number) => Promise<boolean>;
  onToggleAskSolution: (idx: number) => Promise<void>;
  onToggleEvaluateSolution: (idx: number) => Promise<void>;
  onStartTestSession: (
    leiaId: string,
    replicationId: string,
    idx: number
  ) => void;
  replicationId: string;
  startingSessionLeiaId: string | null;
  // Campos que el backend marcó como inválidos para esta Leia.
  invalidFields: string[];
}

const LeiaEditor: React.FC<LeiaEditorProps> = ({
  idx,
  item,
  serverItem,
  apiKeys,
  apiKeyProvidersMapped,
  providerProviderModuleMap,
  userRole,
  onLocalLeiaChange,
  onLocalLeiaReset,
  onLeiaUpdate,
  onToggleAskSolution,
  onToggleEvaluateSolution,
  onStartTestSession,
  replicationId,
  startingSessionLeiaId,
  invalidFields,
}) => {
  const [showAllVoices, setShowAllVoices] = useState(false);
  const [contentOpen, setContentOpen] = useState(false);
  const [studentInfographicAvailable, setStudentInfographicAvailable] =
    useState<boolean | null>(null);
  const [solutionInfographicAvailable, setSolutionInfographicAvailable] =
    useState<boolean | null>(null);
  const solutionViewerRef = React.useRef<InfographicViewerHandle | null>(null);

  // BYOK: model + API key for this LEIA.
  const currentApiKeyId = item.runnerConfiguration.apiKeyId;
  const currentModelName = item.runnerConfiguration.modelName ?? "";
  const problemWidgets = item.leia.spec?.problem?.spec?.widgets;
  const requiresTools =
    Array.isArray(problemWidgets) && problemWidgets.length > 0;
  const toolCapableProviders = React.useMemo(
    () =>
      new Set(
        Object.entries(providerProviderModuleMap)
          .filter(([, moduleName]) => moduleName === "openai-responses")
          .map(([provider]) => provider)
      ),
    [providerProviderModuleMap]
  );

  const currentApiKeyObj = apiKeys.find((k) => k.id === currentApiKeyId);
  const compatibleApiKeys = React.useMemo(
    () => {
      const matchingKeys = getValidApiKeys(
        currentModelName,
        apiKeys,
        apiKeyProvidersMapped
      );
      return requiresTools
        ? matchingKeys.filter((key) => toolCapableProviders.has(key.provider))
        : matchingKeys;
    },
    [
      apiKeyProvidersMapped,
      apiKeys,
      currentModelName,
      requiresTools,
      toolCapableProviders,
    ]
  );

  React.useEffect(() => {
    if (!currentModelName) return;

    const currentKeyStillMatches = compatibleApiKeys.some(
      (key) => key.id === currentApiKeyId
    );
    if (currentKeyStillMatches) return;

    const nextKey =
      compatibleApiKeys.find((key) => key.isDefault) || compatibleApiKeys[0];
    const nextApiKeyId = nextKey?.id ?? null;
    if ((currentApiKeyId ?? null) === nextApiKeyId) return;

    onLocalLeiaChange(
      idx,
      "runnerConfiguration.apiKeyId",
      nextApiKeyId
    );
  }, [
    compatibleApiKeys,
    currentApiKeyId,
    currentModelName,
    idx,
    onLocalLeiaChange,
  ]);

  const providersWithApiKeys = new Set(
    apiKeys
      .filter((key) => key.isActive !== false)
      .map((key) => key.provider)
  );
  const validModelsForLeia = Array.from(
    new Set(
      Object.entries(apiKeyProvidersMapped)
        .filter(
          ([provider]) =>
            providersWithApiKeys.has(provider) &&
            (!requiresTools || toolCapableProviders.has(provider))
        )
        .flatMap(([, models]) => models)
    )
  );

  const isCurrentModelValid =
    currentModelName === "" ||
    validModelsForLeia.includes(currentModelName);

  // Marcas de error devueltas por el backend en el último intento de guardar/activar.
  const isModelMissing = invalidFields.includes("modelName");
  const showDashboardLink = Boolean(
    currentApiKeyObj &&
      (!currentApiKeyObj.isSystemApiKey || userRole === "admin") &&
      currentApiKeyObj.managementUrl
  );

  const isStartingAny = Boolean(startingSessionLeiaId);
  const isStartingThis = startingSessionLeiaId === item.id;
  const leiaResourceId = String(item.leia.id || item.id || "");
  const infographicSrc =
    typeof item.leia.spec?.infographic === "string" &&
    item.leia.spec.infographic.trim()
      ? item.leia.spec.infographic
      : "";
  const infographicFallbackSources = React.useMemo(
    () => buildLeiaInfographicPaths(leiaResourceId, "infographic"),
    [leiaResourceId]
  );
  const infographicCandidates = React.useMemo(
    () =>
      buildStoredImageCandidateSources(
        infographicSrc,
        ...infographicFallbackSources
      ),
    [infographicFallbackSources, infographicSrc]
  );
  const solutionInfographicSrc =
    typeof item.leia.spec?.infographicSolution === "string" &&
    item.leia.spec.infographicSolution.trim()
      ? item.leia.spec.infographicSolution
      : "";
  const solutionInfographicFallbackSources = React.useMemo(
    () => buildLeiaInfographicPaths(leiaResourceId, "infographicSolution"),
    [leiaResourceId]
  );
  const solutionInfographicCandidates = React.useMemo(
    () =>
      buildStoredImageCandidateSources(
        solutionInfographicSrc,
        ...solutionInfographicFallbackSources
      ),
    [solutionInfographicFallbackSources, solutionInfographicSrc]
  );
  const hasAnyInfographic =
    studentInfographicAvailable === true ||
    solutionInfographicAvailable === true;
  const infographicConfig = item.runnerConfiguration.infographic || {};
  const showInfographicToStudent = Boolean(
    studentInfographicAvailable === true && infographicConfig.showToStudent
  );

  const isDirty =
    JSON.stringify(item) !== JSON.stringify(serverItem);

  return (
    <Box>
      <ImageAvailabilityProbe
        sources={infographicCandidates}
        onAvailableChange={setStudentInfographicAvailable}
      />
      <ImageAvailabilityProbe
        sources={solutionInfographicCandidates}
        onAvailableChange={setSolutionInfographicAvailable}
      />
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
            onClick={() => onStartTestSession(item.id, replicationId, idx)}
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

      <SectionLabel>Infographics</SectionLabel>
      {studentInfographicAvailable === null ||
      solutionInfographicAvailable === null ? (
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            bgcolor: "surfaces.subtle",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            px: 2,
            py: 1.5,
            mb: 1,
          }}
        >
          Checking generated infographic assets...
        </Typography>
      ) : !hasAnyInfographic ? (
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            bgcolor: "surfaces.subtle",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            px: 2,
            py: 1.5,
            mb: 1,
          }}
        >
          No infographic is available for this LEIA. Open it in Designer and
          generate the infographic assets before configuring them here.
        </Typography>
      ) : null}
      {studentInfographicAvailable === false && hasAnyInfographic && (
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            bgcolor: "surfaces.subtle",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            px: 2,
            py: 1.5,
            mb: 1,
          }}
        >
          The student infographic is not available. Open this LEIA in Designer
          and generate it before enabling student access.
        </Typography>
      )}
      <FieldRow
        label="Show during exercise"
        helper="Student can open the infographic during the exercise."
      >
        <Switch
          size="small"
          checked={showInfographicToStudent}
          disabled={studentInfographicAvailable !== true}
          onChange={(_, checked) => {
            onLocalLeiaChange(
              idx,
              "runnerConfiguration.infographic.showToStudent",
              checked
            );
          }}
        />
      </FieldRow>
      <FieldRow
        label="Instructor solution"
        helper="Only visible here in the workbench."
      >
        <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            disabled={solutionInfographicAvailable !== true}
            startIcon={<ImageOutlinedIcon sx={{ fontSize: 16 }} />}
            onClick={() => solutionViewerRef.current?.open()}
            sx={{ borderColor: "divider", color: "text.primary" }}
          >
            View solution
          </Button>
          {solutionInfographicAvailable === false && (
            <Typography variant="caption" sx={{ color: "text.disabled" }}>
              Generate the solution infographic in Designer first.
            </Typography>
          )}
        </Stack>
      </FieldRow>

      <SectionLabel>Runner</SectionLabel>
      {requiresTools && (
        <Box
          sx={{
            mb: 2,
            border: "1px solid",
            borderColor: "warning.light",
            bgcolor: "warning.50",
            borderRadius: 1,
            px: 1.5,
            py: 1,
          }}
        >
          <Typography variant="caption" sx={{ color: "warning.dark" }}>
            This activity uses widgets, so its tool functions require a
            tool-capable provider. Currently, only OpenAI models are available.
          </Typography>
        </Box>
      )}
      <FieldRow
        label="Model"
        helper="Model used by this LEIA's runner."
      >
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <Select
            displayEmpty
            value={currentModelName}
            onChange={(e) => {
              const modelName = e.target.value;
              onLocalLeiaChange(
                idx,
                "runnerConfiguration.modelName",
                modelName
              );
              const matchingKeys = getValidApiKeys(
                modelName,
                apiKeys,
                apiKeyProvidersMapped
              ).filter(
                (key) =>
                  !requiresTools || toolCapableProviders.has(key.provider)
              );
              const currentKeyStillMatches = matchingKeys.some((key) => key.id === currentApiKeyId);
              if (!currentKeyStillMatches) {
                const nextKey = matchingKeys.find((key) => key.isDefault) || matchingKeys[0];
                onLocalLeiaChange(idx, "runnerConfiguration.apiKeyId", nextKey?.id ?? null);
              }
            }}
            renderValue={(selected) => {
              if (!selected) return <em>-- Select Model --</em>;
              const provider = Object.entries(apiKeyProvidersMapped).find(([, models]) =>
                models.includes(selected as string)
              )?.[0];
              return (
                <Stack direction="row" alignItems="center" spacing={1}>
                  {provider && providerIcons[provider] && (
                    <Box component="img" src={providerIcons[provider]} alt="" sx={{ width: 20, height: 20, objectFit: "contain" }} />
                  )}
                  <span>{selected as string}</span>
                </Stack>
              );
            }}
            sx={{
              fontSize: 13,
              ...(isCurrentModelValid && !isModelMissing
                ? {}
                : {
                    color: "error.main",
                    "& fieldset": { borderColor: "error.main" },
                  }),
            }}
          >
            <MenuItem value="" sx={{ fontSize: 13 }}>
              <em>-- Select Model --</em>
            </MenuItem>
            {!isCurrentModelValid && currentModelName !== "" && (() => {
              const provider = Object.entries(apiKeyProvidersMapped).find(([, models]) =>
                models.includes(currentModelName)
              )?.[0];
              return (
                <MenuItem value={currentModelName} disabled sx={{ fontSize: 13, gap: 1 }}>
                  {provider && providerIcons[provider] && (
                    <Box component="img" src={providerIcons[provider]} alt="" sx={{ width: 20, height: 20, objectFit: "contain" }} />
                  )}
                  {`${currentModelName} (no disponible)`}
                </MenuItem>
              );
            })()}
            {validModelsForLeia.map((model) => {
              const provider = Object.entries(apiKeyProvidersMapped).find(([, models]) => models.includes(model))?.[0];
              return (
              <MenuItem key={model} value={model} sx={{ fontSize: 13, gap: 1 }}>
                {provider && providerIcons[provider] && (
                  <Box component="img" src={providerIcons[provider]} alt="" sx={{ width: 20, height: 20, objectFit: "contain" }} />
                )}
                {model}
              </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <Stack direction="row" alignItems="center" gap={1.5}>
          {showDashboardLink && (
            <MuiLink
              href={currentApiKeyObj?.managementUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={currentApiKeyObj?.managementUrl}
              underline="hover"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <OpenInNewOutlinedIcon sx={{ fontSize: 16 }} />
              Dashboard
            </MuiLink>
          )}

          <MuiLink
            component={Link}
            to="/administration/api-keys"
            underline="hover"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <VpnKeyOutlinedIcon sx={{ fontSize: 16 }} />
            Manage Keys
          </MuiLink>
        </Stack>
      </FieldRow>

      {compatibleApiKeys.length > 1 && (
        <FieldRow
          label="API key"
          helper="API key used by this LEIA's runner."
        >
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <Select
              value={
                compatibleApiKeys.some((key) => key.id === currentApiKeyId)
                  ? currentApiKeyId
                  : ""
              }
              displayEmpty
              onChange={(e) =>
                onLocalLeiaChange(
                  idx,
                  "runnerConfiguration.apiKeyId",
                  e.target.value
                )
              }
              sx={{ fontSize: 13 }}
            >
              <MenuItem value="" disabled sx={{ fontSize: 13 }}>
                <em>-- Select API key --</em>
              </MenuItem>
              {compatibleApiKeys.map((apiKey) => (
                <MenuItem
                  key={apiKey.id}
                  value={apiKey.id}
                  sx={{ fontSize: 13 }}
                >
                  {apiKey.description || apiKey.provider}
                  {apiKey.isDefault ? " (Default)" : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </FieldRow>
      )}

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
                renderValue={(selected) => (
                  <Stack direction="row" alignItems="center" spacing={1}>
                    {providerIcons[selected as string] && (
                      <Box component="img" src={providerIcons[selected as string]} alt="" sx={{ width: 20, height: 20, objectFit: "contain" }} />
                    )}
                    <span>{selected === "openai" ? "OpenAI" : "Gemini"}</span>
                  </Stack>
                )}
                sx={{ fontSize: 13 }}
              >
                <MenuItem value="openai" sx={{ fontSize: 13, gap: 1 }}>
                  <Box component="img" src={providerIcons.openai} alt="" sx={{ width: 20, height: 20, objectFit: "contain" }} />
                  OpenAI
                </MenuItem>
                <MenuItem value="gemini" sx={{ fontSize: 13, gap: 1 }}>
                  <Box component="img" src={providerIcons.gemini} alt="" sx={{ width: 20, height: 20, objectFit: "contain" }} />
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
      {solutionInfographicAvailable === true && (
        <InfographicViewer
          ref={solutionViewerRef}
          candidateSources={solutionInfographicCandidates}
          title="Solution infographic"
          hidden
        />
      )}
    </Box>
  );
};

export const LeiasSection: React.FC<LeiasSectionProps> = ({
  replication,
  localReplication,
  activeLeiaId,
  onLeiaSelect,
  apiKeys,
  apiKeyProvidersMapped,
  providerProviderModuleMap,
  userRole,
  onLocalLeiaChange,
  onLocalLeiaReset,
  onLeiaUpdate,
  onToggleAskSolution,
  onToggleEvaluateSolution,
  onStartTestSession,
  startingSessionLeiaId,
  invalidLeiaFields,
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
        apiKeys={apiKeys}
        apiKeyProvidersMapped={apiKeyProvidersMapped}
        providerProviderModuleMap={providerProviderModuleMap}
        userRole={userRole}
        onLocalLeiaChange={onLocalLeiaChange}
        onLocalLeiaReset={onLocalLeiaReset}
        onLeiaUpdate={onLeiaUpdate}
        onToggleAskSolution={onToggleAskSolution}
        onToggleEvaluateSolution={onToggleEvaluateSolution}
        onStartTestSession={onStartTestSession}
        replicationId={replication.id}
        startingSessionLeiaId={startingSessionLeiaId}
        invalidFields={invalidLeiaFields[item.id] ?? []}
      />
    </Box>
  );
};

export default LeiasSection;

// Silence unused warnings for fields we keep in props for future use.
void InputLabel;
