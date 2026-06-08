import React, { useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import TheaterComedyOutlinedIcon from "@mui/icons-material/TheaterComedyOutlined";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import SyntaxHighlighter from "react-syntax-highlighter";
import { docco } from "react-syntax-highlighter/dist/esm/styles/hljs";

// Loose parsed LEIA shape. The drawer only reads from a known set of
// fields and surfaces the rest in the raw-JSON tab — keeping the UI
// tolerant to LEIAs authored with extra metadata.
export interface ParsedLeia {
  id?: string;
  metadata?: { name?: string; version?: string };
  spec?: {
    persona?: {
      metadata?: { name?: string };
      spec?: Record<string, unknown>;
    };
    behaviour?: {
      metadata?: { name?: string };
      spec?: Record<string, unknown>;
    };
    problem?: {
      metadata?: { name?: string };
      spec?: Record<string, unknown>;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface LeiaPreviewDrawerProps {
  leia: ParsedLeia | null;
  onClose: () => void;
}

const initialsOf = (name?: string | null) => {
  if (!name) return "L";
  const cleaned = name.replace(/[^A-Za-zÀ-ÿ\s]/g, "").trim();
  if (!cleaned) return name.charAt(0).toUpperCase();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const LeiaPreviewDrawer: React.FC<LeiaPreviewDrawerProps> = ({
  leia,
  onClose,
}) => {
  const [tab, setTab] = useState<"overview" | "raw">("overview");

  // Reset back to overview each time a new LEIA is opened.
  React.useEffect(() => {
    if (leia) setTab("overview");
  }, [leia]);

  const persona = leia?.spec?.persona?.spec as
    | Record<string, unknown>
    | undefined;
  const behaviour = leia?.spec?.behaviour?.spec as
    | Record<string, unknown>
    | undefined;
  const problem = leia?.spec?.problem?.spec as
    | Record<string, unknown>
    | undefined;

  const displayName = useMemo(() => {
    const personaName = (persona?.fullName as string) || (persona?.firstName as string);
    return personaName || leia?.metadata?.name || "LEIA";
  }, [persona, leia]);

  return (
    <Drawer
      anchor="right"
      open={Boolean(leia)}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: 680,
            maxWidth: "94vw",
            borderLeft: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          },
        },
      }}
    >
      {leia && (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Header */}
          <Box
            sx={{
              p: 3,
              borderBottom: "1px solid",
              borderColor: "divider",
              display: "flex",
              alignItems: "flex-start",
              gap: 2,
            }}
          >
            <Avatar
              sx={{
                width: 52,
                height: 52,
                bgcolor: "primary.main",
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              {initialsOf(displayName)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: "-0.015em",
                  color: "text.primary",
                  wordBreak: "break-word",
                }}
              >
                {displayName}
              </Typography>
              <Stack
                direction="row"
                gap={1}
                alignItems="center"
                flexWrap="wrap"
                sx={{ mt: 0.5 }}
              >
                {leia.metadata?.name && (
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: "text.secondary",
                      fontFamily:
                        "'JetBrains Mono Variable', ui-monospace, monospace",
                    }}
                  >
                    {leia.metadata.name}
                  </Typography>
                )}
                {leia.metadata?.version && (
                  <Chip
                    size="small"
                    label={`v${leia.metadata.version}`}
                    sx={{
                      height: 18,
                      fontSize: 10,
                      bgcolor: "surfaces.subtle",
                      color: "text.secondary",
                    }}
                  />
                )}
                {leia.id && (
                  <Typography
                    sx={{
                      fontSize: 10,
                      color: "text.disabled",
                      fontFamily:
                        "'JetBrains Mono Variable', ui-monospace, monospace",
                    }}
                  >
                    {leia.id}
                  </Typography>
                )}
              </Stack>
            </Box>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>

          {/* Tab switcher */}
          <Box
            sx={{
              px: 3,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              sx={{
                minHeight: 36,
                "& .MuiTab-root": {
                  minHeight: 36,
                  textTransform: "none",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "text.secondary",
                  "&.Mui-selected": { color: "text.primary", fontWeight: 600 },
                },
                "& .MuiTabs-indicator": { height: 2 },
              }}
            >
              <Tab value="overview" label="Overview" />
              <Tab value="raw" label="Raw JSON" />
            </Tabs>
          </Box>

          {/* Body */}
          <Box sx={{ flex: 1, overflow: "auto" }}>
            {tab === "overview" ? (
              <Stack gap={2} sx={{ p: 3 }}>
                {persona && (
                  <SectionCard
                    icon={<PersonOutlineIcon sx={{ fontSize: 18 }} />}
                    accent="#7C3AED"
                    title="Persona"
                    subtitle={
                      (leia.spec?.persona?.metadata?.name as string) || undefined
                    }
                  >
                    <PersonaSection persona={persona} />
                  </SectionCard>
                )}

                {behaviour && (
                  <SectionCard
                    icon={<TheaterComedyOutlinedIcon sx={{ fontSize: 18 }} />}
                    accent="#0EA5E9"
                    title="Behaviour"
                    subtitle={
                      (leia.spec?.behaviour?.metadata?.name as string) || undefined
                    }
                  >
                    <BehaviourSection behaviour={behaviour} />
                  </SectionCard>
                )}

                {problem && (
                  <SectionCard
                    icon={<ExtensionOutlinedIcon sx={{ fontSize: 18 }} />}
                    accent="#16A34A"
                    title="Problem"
                    subtitle={
                      (leia.spec?.problem?.metadata?.name as string) || undefined
                    }
                  >
                    <ProblemSection problem={problem} />
                  </SectionCard>
                )}

                {!persona && !behaviour && !problem && (
                  <Typography
                    variant="body2"
                    sx={{ color: "text.disabled", fontStyle: "italic" }}
                  >
                    No persona, behaviour or problem found on this LEIA. Open
                    the Raw JSON tab to inspect the spec.
                  </Typography>
                )}
              </Stack>
            ) : (
              <SyntaxHighlighter
                language="json"
                style={docco}
                wrapLongLines
                showLineNumbers
                customStyle={{
                  background: "transparent",
                  margin: 0,
                  padding: "16px 24px",
                  fontSize: 12,
                  fontFamily:
                    "'JetBrains Mono Variable', ui-monospace, monospace",
                }}
              >
                {JSON.stringify(leia, null, 2)}
              </SyntaxHighlighter>
            )}
          </Box>
        </Box>
      )}
    </Drawer>
  );
};

// — SectionCard with colored icon chip ---------------------------------

const SectionCard: React.FC<{
  icon: React.ReactNode;
  accent: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ icon, accent, title, subtitle, children }) => (
  <Paper variant="outlined" sx={{ p: 0, borderRadius: 2, overflow: "hidden" }}>
    <Stack
      direction="row"
      alignItems="center"
      gap={1.5}
      sx={{
        px: 2.5,
        py: 1.5,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "surfaces.subtle",
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: accent,
          color: "white",
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          sx={{
            fontSize: 14,
            fontWeight: 600,
            color: "text.primary",
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography
            sx={{
              fontSize: 11,
              color: "text.disabled",
              fontFamily:
                "'JetBrains Mono Variable', ui-monospace, monospace",
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
    </Stack>
    <Box sx={{ p: 2.5 }}>{children}</Box>
  </Paper>
);

// — Definition list row, used by every section -------------------------

const DefRow: React.FC<{
  label: string;
  children?: React.ReactNode;
  full?: boolean;
}> = ({ label, children, full = false }) =>
  full ? (
    <Box sx={{ mt: 1.5 }}>
      <Typography
        variant="overline"
        sx={{
          color: "text.disabled",
          display: "block",
          lineHeight: 1.2,
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Box sx={{ fontSize: 13, color: "text.primary", lineHeight: 1.6 }}>
        {children ?? <em style={{ color: "var(--mui-palette-text-disabled)" }}>—</em>}
      </Box>
    </Box>
  ) : (
    <Box sx={{ display: "flex", py: 0.75, alignItems: "flex-start" }}>
      <Typography
        sx={{
          width: 140,
          flexShrink: 0,
          fontSize: 12,
          color: "text.secondary",
        }}
      >
        {label}
      </Typography>
      <Box sx={{ flex: 1, fontSize: 13, color: "text.primary", minWidth: 0 }}>
        {children ?? (
          <em style={{ color: "var(--mui-palette-text-disabled)" }}>—</em>
        )}
      </Box>
    </Box>
  );

// — Persona / Behaviour / Problem renderers ----------------------------

const PersonaSection: React.FC<{ persona: Record<string, unknown> }> = ({
  persona,
}) => {
  const s = persona as Record<string, string | undefined>;
  return (
    <>
      <DefRow label="Full name">{s.fullName}</DefRow>
      {s.age && <DefRow label="Age">{s.age}</DefRow>}
      {s.personality && (
        <DefRow label="Personality">{s.personality}</DefRow>
      )}
      {(s.subjectPronoum || s.objectPronoum || s.possesivePronoum) && (
        <DefRow label="Pronouns">
          {[s.subjectPronoum, s.objectPronoum, s.possesivePronoum]
            .filter(Boolean)
            .join(" / ")}
        </DefRow>
      )}
      {s.description && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <DefRow label="Description" full>
            <Typography
              sx={{
                fontSize: 13,
                color: "text.primary",
                whiteSpace: "pre-wrap",
                lineHeight: 1.55,
              }}
            >
              {s.description}
            </Typography>
          </DefRow>
        </>
      )}
    </>
  );
};

const BehaviourSection: React.FC<{ behaviour: Record<string, unknown> }> = ({
  behaviour,
}) => {
  const role = behaviour.role as string | undefined;
  const character = behaviour.character as string | undefined;
  const process = behaviour.process as string[] | undefined;
  const tooltip = behaviour.tooltip as string | undefined;
  const description = behaviour.description as string | undefined;
  return (
    <>
      {role && <DefRow label="Role">{role}</DefRow>}
      {character && <DefRow label="Character">{character}</DefRow>}
      {Array.isArray(process) && process.length > 0 && (
        <DefRow label="Process">
          <Stack direction="row" gap={0.5} flexWrap="wrap">
            {process.map((p) => (
              <Chip
                key={p}
                size="small"
                label={p}
                sx={{
                  height: 20,
                  fontSize: 11,
                  bgcolor: "surfaces.subtle",
                  color: "text.primary",
                }}
              />
            ))}
          </Stack>
        </DefRow>
      )}
      {tooltip && <DefRow label="Tooltip">{tooltip}</DefRow>}
      {description && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <DefRow label="Description" full>
            <Typography
              sx={{
                fontSize: 13,
                color: "text.primary",
                whiteSpace: "pre-wrap",
                lineHeight: 1.55,
              }}
            >
              {description}
            </Typography>
          </DefRow>
        </>
      )}
    </>
  );
};

const ProblemSection: React.FC<{ problem: Record<string, unknown> }> = ({
  problem,
}) => {
  const solutionFormat = problem.solutionFormat as string | undefined;
  const description = problem.description as string | undefined;
  const details = problem.details as string | undefined;
  const personaBackground = problem.personaBackground as string | undefined;
  const processSteps = problem.process as string[] | undefined;
  return (
    <>
      {solutionFormat && (
        <DefRow label="Solution format">
          <Chip
            size="small"
            label={solutionFormat}
            sx={{
              height: 20,
              fontSize: 11,
              bgcolor: "surfaces.accent",
              color: "primary.dark",
            }}
          />
        </DefRow>
      )}
      {Array.isArray(processSteps) && processSteps.length > 0 && (
        <DefRow label="Process">
          <Stack direction="row" gap={0.5} flexWrap="wrap">
            {processSteps.map((p) => (
              <Chip
                key={p}
                size="small"
                label={p}
                sx={{
                  height: 20,
                  fontSize: 11,
                  bgcolor: "surfaces.subtle",
                  color: "text.primary",
                }}
              />
            ))}
          </Stack>
        </DefRow>
      )}
      {personaBackground && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <DefRow label="Persona background" full>
            <Typography
              sx={{
                fontSize: 13,
                color: "text.primary",
                whiteSpace: "pre-wrap",
                lineHeight: 1.55,
              }}
            >
              {personaBackground}
            </Typography>
          </DefRow>
        </>
      )}
      {description && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <DefRow label="Description" full>
            <Typography
              sx={{
                fontSize: 13,
                color: "text.primary",
                whiteSpace: "pre-wrap",
                lineHeight: 1.55,
              }}
            >
              {description}
            </Typography>
          </DefRow>
        </>
      )}
      {details && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <DefRow label="Details" full>
            <Typography
              sx={{
                fontSize: 13,
                color: "text.primary",
                whiteSpace: "pre-wrap",
                lineHeight: 1.55,
              }}
            >
              {details}
            </Typography>
          </DefRow>
        </>
      )}
    </>
  );
};

export default LeiaPreviewDrawer;
