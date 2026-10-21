import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import axios, { AxiosRequestConfig } from "axios";
import ReactMarkdown from "react-markdown";
import mermaid from "mermaid";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  Divider,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import PrivacyTipOutlinedIcon from "@mui/icons-material/PrivacyTipOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import AdminLayout from "../components/admin/AdminLayout";
import {
  MasterDetailLayout,
  MasterDetailEmptyState,
} from "../components/admin/MasterDetailLayout";
import StatusDot from "../components/admin/StatusDot";
import { formatTimeAgo } from "../components/admin/RelativeTime";
import { writeReplicationName } from "../lib/replicationNames";
import { useAuth } from "../context";

interface Message {
  id: string;
  text: string;
  isLeia: boolean;
  timestamp: string;
}

interface SupervisorFlag {
  category: string;
  severity: "low" | "medium" | "high";
  note: string;
  quote?: string | null;
  at?: string;
}

interface Session {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  result: string | null;
  evaluation: string | null;
  score: number | null;
  messages: Message[];
  user: { email: string } | null;
  supervisorFlags?: SupervisorFlag[] | null;
  replicationConfig?: unknown | null;
  dataUsage?: {
    config: {
      dataUsageConsentRequired: boolean;
      dataUsageConsentMessage: string;
      conversationAutomatedRemoval: boolean;
    };
    consentStatus: "pending" | "accepted" | "declined" | "not_required";
    decidedAt: string | null;
    automatedRemovalApplied: boolean;
  } | null;
}

const REPLICATION_TOKENS_KEY = "replicationTokens";

// Initialise mermaid once. `securityLevel: 'loose'` lets it render user
// content without sanitising too aggressively — same setting Edit.tsx
// uses for the in-app diagram editor.
let mermaidInitialised = false;
const ensureMermaid = () => {
  if (mermaidInitialised) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "loose",
    suppressErrorRendering: true,
  });
  mermaidInitialised = true;
};

const cleanupMermaidRenderArtifacts = (id: string) => {
  document.getElementById(id)?.remove();
  document.getElementById(`d${id}`)?.remove();
  document.getElementById(`i${id}`)?.remove();
};

// Heuristic detection for content that looks like mermaid even when the
// LEIA spec didn't declare a solutionFormat. Matches the first non-empty
// line against the common mermaid diagram keywords.
const looksLikeMermaid = (text: string): boolean => {
  const first = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!first) return false;
  return /^(graph |flowchart |sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|requirementDiagram|gitGraph|mindmap|timeline|quadrantChart|sankey)/i
    .test(first);
};

const formatDataUsageConsent = (
  status?: "pending" | "accepted" | "declined" | "not_required"
) => {
  if (status === "accepted") return "Consent accepted";
  if (status === "declined") return "Consent declined";
  if (status === "pending") return "Pending";
  return "Consent not required";
};

const hasConversationAutomatedRemoval = (session: Session): boolean =>
  Boolean(
    session.dataUsage?.automatedRemovalApplied &&
      session.dataUsage?.consentStatus === "declined" &&
      session.dataUsage?.config.dataUsageConsentRequired &&
      session.dataUsage?.config.conversationAutomatedRemoval
  );

const readStoredReplicationTokens = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(REPLICATION_TOKENS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const Conversations: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [conversations, setConversations] = useState<Session[]>([]);
  const [replicationName, setReplicationName] = useState<string>("");
  const [solutionFormat, setSolutionFormat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingScore, setEditingScore] = useState(false);
  const [scoreValue, setScoreValue] = useState<string>("");
  const { token, user } = useAuth(); // cambiado
  const isAdmin = user?.role === "admin";
  const [replicationToken, setReplicationToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (!id) return;
    setTokenReady(false);
    const tokens = readStoredReplicationTokens();
    const searchParams = new URLSearchParams(location.search);
    const tokenFromQuery = searchParams.get("token");
    if (tokenFromQuery) {
      tokens[id] = tokenFromQuery;
      localStorage.setItem(REPLICATION_TOKENS_KEY, JSON.stringify(tokens));
      setReplicationToken(tokenFromQuery);
    } else {
      setReplicationToken(tokens[id] || null);
    }
    setTokenReady(true);
  }, [id, location.search]);

  const buildRequestConfig = useCallback(
    (config: AxiosRequestConfig = {}): AxiosRequestConfig => {
      const headers = { ...(config.headers || {}) };
      if (token) headers.Authorization = `Bearer ${token}`;
      const params = { ...(config.params || {}) };
      if (replicationToken) params.token = replicationToken;
      const final: AxiosRequestConfig = { ...config };
      if (Object.keys(headers).length > 0) final.headers = headers;
      if (Object.keys(params).length > 0) final.params = params;
      return final;
    },
    [token, replicationToken]
  );

  useEffect(() => {
    if (!tokenReady || !id) return;
    const fetch = async () => {
      try {
        const repResp = await axios.get(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}`,
          buildRequestConfig()
        );
        setReplicationName(repResp.data.name);
        if (id && repResp.data.name) writeReplicationName(id, repResp.data.name);
        // Solution format lives on each LEIA's problem spec. We pick
        // the first leia's format — single-LEIA replications are the
        // common case, and on multi-LEIA replications all leias
        // typically share a format.
        const firstLeia = repResp.data?.experiment?.leias?.[0]?.leia;
        const fmt = firstLeia?.spec?.problem?.spec?.solutionFormat;
        if (typeof fmt === "string" && fmt.length > 0) {
          setSolutionFormat(fmt);
        }

        const convResp = await axios.get<Session[]>(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/conversations`,
          buildRequestConfig()
        );
        setConversations(convResp.data);
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          if (replicationToken) alert("Invalid or expired replication token");
          else navigate("/login");
        } else {
          console.error("Load error:", err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id, navigate, replicationToken, tokenReady, buildRequestConfig]);

  const handleDownloadCSV = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/conversations/csv`,
        buildRequestConfig({ responseType: "blob" })
      );
      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${replicationName.replace(/\s+/g, "_")}_conversations.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
    }
  };

  const handleSaveScore = async (sessionId: string) => {
    try {
      const score = parseFloat(scoreValue);
      if (isNaN(score) || score < 0 || score > 100) {
        alert("Please enter a valid score between 0 and 100");
        return;
      }
      await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/sessions/${sessionId}/score`,
        { score },
        buildRequestConfig()
      );
      setConversations((prev) =>
        prev.map((c) => (c.id === sessionId ? { ...c, score } : c))
      );
      setEditingScore(false);
      setScoreValue("");
    } catch (err) {
      console.error("Error updating score:", err);
      alert("Failed to update score");
    }
  };

  const formatDate = (s: string) => new Date(s).toLocaleString();

  // KPI strip stats — same numbers the old card-based view showed at
  // the top of the page.
  const stats = useMemo(() => {
    const completed = conversations.filter((c) => c.finishedAt).length;
    const scored = conversations.filter((c) => c.score !== null);
    const avg =
      scored.length > 0
        ? scored.reduce((acc, c) => acc + (c.score ?? 0), 0) / scored.length
        : null;
    return { total: conversations.length, completed, avg };
  }, [conversations]);

  // Apply search; completed sessions surface their score in the secondary
  // line so users can scan scores from the list alone.
  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (!q) return true;
      const email = c.user?.email?.toLowerCase() ?? "";
      return email.includes(q);
    });
  }, [conversations, search]);

  const selected = useMemo(
    () => filteredSessions.find((c) => c.id === selectedId) ?? null,
    [filteredSessions, selectedId]
  );

  // Auto-select the first row whenever the list changes and current
  // selection drops out.
  useEffect(() => {
    if (filteredSessions.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!filteredSessions.some((s) => s.id === selectedId)) {
      setSelectedId(filteredSessions[0].id);
    }
  }, [filteredSessions, selectedId]);

  // Closing the editor when switching session keeps the inline-edit UI
  // from leaking across rows.
  useEffect(() => {
    setEditingScore(false);
    setScoreValue("");
  }, [selectedId]);

  const headerActions = (
    <Stack direction="row" gap={1}>
      <Button
        variant="outlined"
        color="inherit"
        size="small"
        startIcon={<MonitorHeartOutlinedIcon sx={{ fontSize: 16 }} />}
        onClick={() => navigate(`/replications/${id}/live`)}
        sx={{ borderColor: "divider", color: "text.primary" }}
      >
        Live
      </Button>
      <Button
        variant="contained"
        size="small"
        startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
        onClick={handleDownloadCSV}
      >
        Download CSV
      </Button>
    </Stack>
  );

  return (
    <AdminLayout
      breadcrumbs={[
          { label: user?.role === "admin" ? "All the replications" : "My replications"},
          {
          label: replicationName || "Replication",
          to: `/replications/${id}`,
        },
        { label: "Conversations" },
      ]}
      actions={headerActions}
      flush
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 1.5,
          px: 4,
          pt: 2,
          pb: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.default",
        }}
      >
        <KpiCard
          label="Total sessions"
          value={loading ? null : stats.total}
        />
        <KpiCard
          label="Completed"
          value={loading ? null : stats.completed}
        />
        <KpiCard
          label="Avg score"
          value={loading ? null : stats.avg == null ? "—" : stats.avg.toFixed(1)}
        />
      </Box>
      <MasterDetailLayout
        storageKey="adminMD:conversations.width"
        defaultWidth={380}
        searchPlaceholder="Search by email..."
        searchValue={search}
        onSearchChange={setSearch}
        isListEmpty={!loading && filteredSessions.length === 0}
        emptyListMessage={
          conversations.length === 0
            ? "No conversations yet."
            : "No sessions match your search."
        }
        list={
          loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <SessionRowSkeleton key={i} />
              ))
            : filteredSessions.map((s) => (
                <SessionRow
                  key={s.id}
                  item={s}
                  selected={s.id === selectedId}
                  onClick={() => setSelectedId(s.id)}
                />
              ))
        }
        detail={
          loading ? (
            <SessionDetailSkeleton />
          ) : selected ? (
            <SessionDetail
              session={selected}
              isAdmin={isAdmin}
              solutionFormat={solutionFormat}
              editingScore={editingScore}
              scoreValue={scoreValue}
              onStartEditScore={() => {
                setEditingScore(true);
                setScoreValue(selected.score?.toString() || "");
              }}
              onChangeScore={setScoreValue}
              onSaveScore={() => handleSaveScore(selected.id)}
              onCancelEditScore={() => {
                setEditingScore(false);
                setScoreValue("");
              }}
              formatDate={formatDate}
            />
          ) : (
            <MasterDetailEmptyState
              icon={<ForumOutlinedIcon sx={{ fontSize: 32 }} />}
              message="Select a session to see the conversation"
            />
          )
        }
      />
    </AdminLayout>
  );
};

// — list row -----------------------------------------------------------

const SessionRow: React.FC<{
  item: Session;
  selected: boolean;
  onClick: () => void;
}> = ({ item, selected, onClick }) => (
  <ButtonBase
    onClick={onClick}
    aria-current={selected ? "page" : undefined}
    sx={{
      width: "100%",
      minHeight: 68,
      px: 2,
      py: 1.5,
      textAlign: "left",
      display: "flex",
      alignItems: "stretch",
      justifyContent: "space-between",
      borderBottom: "1px solid",
      borderColor: "divider",
      position: "relative",
      bgcolor: selected ? "surfaces.selected" : "transparent",
      "&:hover": {
        bgcolor: selected ? "surfaces.selected" : "surfaces.hover",
      },
      "&::before": selected
        ? {
            content: '""',
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: "primary.main",
          }
        : {},
    }}
  >
    <Box sx={{ minWidth: 0, flex: 1, pr: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <StatusDot color={item.finishedAt ? "success" : "warning"} />
        <Typography
          variant="subtitle2"
          sx={{
            color: selected ? "primary.dark" : "text.primary",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.user?.email || "Anonymous"}
        </Typography>
      </Box>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          color: "text.secondary",
          mt: 0.5,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {item.finishedAt ? "Completed" : "In progress"}
        {" · "}
        {item.messages.length} msg
        {item.score != null ? ` · Score ${item.score}` : ""}
      </Typography>
    </Box>
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        justifyContent: "space-between",
        flexShrink: 0,
        gap: 0.5,
      }}
    >
      <Typography variant="caption" sx={{ color: "text.disabled" }}>
        {formatTimeAgo(item.startedAt)}
      </Typography>
    </Box>
  </ButtonBase>
);

const SessionRowSkeleton: React.FC = () => (
  <Box
    sx={{
      minHeight: 68,
      px: 2,
      py: 1.5,
      borderBottom: "1px solid",
      borderColor: "divider",
    }}
  >
    <Skeleton variant="text" width="55%" height={18} />
    <Skeleton variant="text" width="75%" height={14} sx={{ mt: 0.5 }} />
  </Box>
);

// — detail panel -------------------------------------------------------

const SessionDetail: React.FC<{
  session: Session;
  isAdmin: boolean;
  solutionFormat: string | null;
  editingScore: boolean;
  scoreValue: string;
  onStartEditScore: () => void;
  onChangeScore: (v: string) => void;
  onSaveScore: () => void;
  onCancelEditScore: () => void;
  formatDate: (s: string) => string;
}> = ({
  session,
  isAdmin,
  solutionFormat,
  editingScore,
  scoreValue,
  onStartEditScore,
  onChangeScore,
  onSaveScore,
  onCancelEditScore,
  formatDate,
}) => {
  const [detailView, setDetailView] = useState<"conversation" | "configuration" | "dataUsage">("conversation");
  const resultIsMermaid =
    Boolean(session.result) &&
    (solutionFormat === "mermaid" || looksLikeMermaid(session.result ?? ""));
  const conversationWasRemoved = hasConversationAutomatedRemoval(session);

  useEffect(() => {
    setDetailView("conversation");
  }, [session.id]);

  return (
    <Box sx={{ p: 4, maxWidth: 880 }}>
      <Stack direction="row" gap={1.5} alignItems="center" sx={{ mb: 1 }}>
        <StatusDot
          color={session.finishedAt ? "success" : "warning"}
        />
        <Typography
          sx={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            color: "text.primary",
            wordBreak: "break-all",
          }}
        >
          {session.user?.email || "Anonymous"}
        </Typography>
      </Stack>
      <Typography
        sx={{ fontSize: 12, color: "text.secondary", mb: 2 }}
      >
        Started {formatDate(session.startedAt)}
        {session.finishedAt &&
          ` · Finished ${formatDate(session.finishedAt)}`}
      </Typography>

      <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 4 }}>
        <Button
          size="small"
          variant={detailView === "conversation" ? "contained" : "outlined"}
          startIcon={<ForumOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={() => setDetailView("conversation")}
        >
          Conversation
        </Button>
        <Button
          size="small"
          variant={detailView === "configuration" ? "contained" : "outlined"}
          startIcon={<SettingsOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={() => setDetailView("configuration")}
        >
          Configuration
        </Button>
        <Button
          size="small"
          variant={detailView === "dataUsage" ? "contained" : "outlined"}
          startIcon={<PrivacyTipOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={() => setDetailView("dataUsage")}
        >
          Data Usage
        </Button>
        <Chip
          size="small"
          variant="outlined"
          label={session.finishedAt ? "Completed" : "In progress"}
          sx={{
            height: 22,
            fontSize: 11,
            borderColor: session.finishedAt ? "success.main" : "warning.main",
            color: session.finishedAt ? "success.main" : "warning.main",
            bgcolor: session.finishedAt
              ? "rgba(22,163,74,0.06)"
              : "rgba(217,119,6,0.06)",
          }}
        />
        {editingScore ? (
          <Stack direction="row" gap={0.5} alignItems="center">
            <TextField
              size="small"
              type="number"
              value={scoreValue}
              onChange={(e) => onChangeScore(e.target.value)}
              inputProps={{
                min: 0,
                max: 100,
                step: 0.1,
                style: { fontSize: 12, padding: "4px 8px", width: 60 },
              }}
              autoFocus
            />
            <IconButton
              size="small"
              onClick={onSaveScore}
              sx={{ color: "primary.main" }}
            >
              <CheckIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <IconButton size="small" onClick={onCancelEditScore}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Stack>
        ) : (
          <Chip
            size="small"
            label={`Score: ${session.score ?? "—"}`}
            onClick={isAdmin ? onStartEditScore : undefined}
            onDelete={isAdmin ? onStartEditScore : undefined}
            deleteIcon={<EditOutlinedIcon sx={{ fontSize: 14 }} />}
            sx={{
              height: 22,
              fontSize: 11,
              bgcolor: "surfaces.accent",
              color: "primary.dark",
              cursor: isAdmin ? "pointer" : "default",
              "& .MuiChip-deleteIcon": { color: "primary.main" },
            }}
          />
        )}
      </Stack>

      {detailView === "configuration" ? (
        <ReplicationConfigPanel config={session.replicationConfig} />
      ) : detailView === "dataUsage" ? (
        <DataUsagePanel
          dataUsage={session.dataUsage}
        />
      ) : (
        <>
      <Typography
        variant="overline"
        sx={{ display: "block", mb: 1.5, color: "text.disabled" }}
      >
        Conversation
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: "background.paper",
          mb: 3,
        }}
      >
        {session.messages.length === 0 ? (
          <Typography
            variant="body2"
            sx={{ color: "text.disabled", fontStyle: "italic" }}
          >
            {conversationWasRemoved
              ? "No conversation is available because the participant did not consent to data usage and automated conversation removal was enabled."
              : "No messages yet."}
          </Typography>
        ) : (
          <Stack gap={1.25}>
            {session.messages.map((m) => (
              <Box
                key={m.id}
                sx={{
                  display: "flex",
                  justifyContent: m.isLeia ? "flex-start" : "flex-end",
                }}
              >
                <Box
                  sx={{
                    maxWidth: "82%",
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: m.isLeia
                      ? "surfaces.subtle"
                      : "primary.main",
                    color: m.isLeia
                      ? "text.primary"
                      : "primary.contrastText",
                  }}
                >
                  <Typography
                    sx={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5 }}
                  >
                    {m.text}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 10,
                      mt: 0.5,
                      color: m.isLeia
                        ? "text.disabled"
                        : "rgba(255,255,255,0.7)",
                    }}
                  >
                    {formatDate(m.timestamp)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      {session.evaluation && (
        <>
          <Typography
            variant="overline"
            sx={{ display: "block", mb: 1.5, color: "text.disabled" }}
          >
            Evaluation
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: 2,
              bgcolor: "surfaces.accent",
              borderColor: "primary.main",
              borderStyle: "solid",
              borderWidth: 1,
              "& p": { fontSize: 14, lineHeight: 1.6, my: 1.25 },
              "& p:first-of-type": { mt: 0 },
              "& p:last-of-type": { mb: 0 },
              "& h1, & h2, & h3, & h4": {
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: "text.primary",
                mt: 2,
                mb: 1,
              },
              "& h1": { fontSize: 20 },
              "& h2": { fontSize: 17 },
              "& h3": { fontSize: 15 },
              "& h4": { fontSize: 14 },
              "& ul, & ol": { pl: 3, my: 1.25 },
              "& li": { fontSize: 14, lineHeight: 1.6, mb: 0.5 },
              "& code": {
                fontFamily:
                  "'JetBrains Mono Variable', ui-monospace, monospace",
                fontSize: 12,
                bgcolor: "surfaces.subtle",
                px: 0.6,
                py: 0.2,
                borderRadius: 0.75,
                color: "text.primary",
              },
              "& pre": {
                bgcolor: "surfaces.subtle",
                border: "1px solid",
                borderColor: "divider",
                p: 1.5,
                borderRadius: 1.5,
                overflowX: "auto",
                my: 1.5,
              },
              "& pre code": {
                bgcolor: "transparent",
                p: 0,
                borderRadius: 0,
                fontSize: 12,
              },
              "& blockquote": {
                borderLeft: "3px solid",
                borderColor: "primary.main",
                pl: 2,
                py: 0.25,
                my: 1.5,
                color: "text.secondary",
                fontStyle: "italic",
              },
              "& a": {
                color: "primary.main",
                textDecoration: "underline",
              },
              "& hr": {
                border: "none",
                borderTop: "1px solid",
                borderColor: "divider",
                my: 2,
              },
              "& table": {
                width: "100%",
                borderCollapse: "collapse",
                my: 1.5,
                fontSize: 13,
              },
              "& th, & td": {
                border: "1px solid",
                borderColor: "divider",
                px: 1,
                py: 0.5,
                textAlign: "left",
              },
              "& th": {
                bgcolor: "surfaces.subtle",
                fontWeight: 600,
              },
            }}
          >
            <ReactMarkdown>{session.evaluation}</ReactMarkdown>
          </Paper>
        </>
      )}

      {session.supervisorFlags && session.supervisorFlags.length > 0 && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography
            variant="overline"
            sx={{ display: "block", mb: 1.5, color: "error.main" }}
          >
            Supervisor flags ({session.supervisorFlags.length})
          </Typography>
          <Stack gap={1.5} sx={{ mb: 1 }}>
            {session.supervisorFlags.map((flag, idx) => (
              <Paper
                key={idx}
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  borderColor:
                    flag.severity === "high"
                      ? "error.main"
                      : flag.severity === "medium"
                        ? "warning.main"
                        : "divider",
                }}
              >
                <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
                  <Chip
                    size="small"
                    label={flag.severity}
                    sx={{
                      height: 18,
                      fontSize: 10,
                      textTransform: "uppercase",
                      bgcolor:
                        flag.severity === "high"
                          ? "rgba(211,47,47,0.1)"
                          : flag.severity === "medium"
                            ? "rgba(237,108,2,0.1)"
                            : "surfaces.subtle",
                      color:
                        flag.severity === "high"
                          ? "error.main"
                          : flag.severity === "medium"
                            ? "warning.main"
                            : "text.secondary",
                    }}
                  />
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary" }}>
                    {flag.category}
                  </Typography>
                </Stack>
                <Typography sx={{ fontSize: 13, color: "text.primary" }}>
                  {flag.note}
                </Typography>
                {flag.quote ? (
                  <Typography
                    sx={{ fontSize: 12, color: "text.disabled", fontStyle: "italic", mt: 0.5 }}
                  >
                    “{flag.quote}”
                  </Typography>
                ) : null}
              </Paper>
            ))}
          </Stack>
        </>
      )}

      {session.result && (
        <>
          <Divider sx={{ my: 3 }} />
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1.5 }}
          >
            <Typography
              variant="overline"
              sx={{ color: "text.disabled" }}
            >
              Submitted result
            </Typography>
            {resultIsMermaid && (
              <Chip
                size="small"
                label="mermaid"
                sx={{
                  height: 20,
                  fontSize: 10,
                  bgcolor: "surfaces.accent",
                  color: "primary.dark",
                }}
              />
            )}
          </Stack>
          {resultIsMermaid ? (
            <MermaidPreview
              code={session.result}
              sessionId={session.id}
            />
          ) : (
            <Paper
              variant="outlined"
              sx={{ p: 2, borderRadius: 2, bgcolor: "surfaces.subtle" }}
            >
              <Typography
                component="pre"
                sx={{
                  fontSize: 12,
                  fontFamily:
                    "'JetBrains Mono Variable', ui-monospace, monospace",
                  color: "text.primary",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  m: 0,
                }}
              >
                {session.result}
              </Typography>
            </Paper>
          )}
        </>
      )}
        </>
      )}
    </Box>
  );
};

const ReplicationConfigPanel: React.FC<{
  config?: unknown | null;
}> = ({ config }) => {
  const sections = useMemo(() => getReplicationConfigSections(config), [config]);

  if (!config) {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 3, borderRadius: 2, bgcolor: "background.paper" }}
      >
        <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
          No replication configuration was stored for this conversation.
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack gap={3}>
      {sections.map((section) => (
        <ConfigSectionCard
          key={section.title}
          title={section.title}
          items={section.items}
        />
      ))}
    </Stack>
  );
};

const DataUsagePanel: React.FC<{
  dataUsage?: Session["dataUsage"];
}> = ({ dataUsage }) => {
  if (!dataUsage) {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 3, borderRadius: 2, bgcolor: "background.paper" }}
      >
        <Typography sx={{ fontSize: 14, color: "text.secondary" }}>
          No data usage configuration was stored for this conversation.
        </Typography>
      </Paper>
    );
  }

  const { config } = dataUsage;

  return (
    <ConfigSectionCard
      title="Data Usage"
      items={[
        {
          label: "Consent acceptance",
          value: config.dataUsageConsentRequired ? "Enabled" : "Disabled",
        },
        {
          label: "Consent status",
          value: formatDataUsageConsent(dataUsage.consentStatus),
        },
        {
          label: "Consent decided at",
          value: dataUsage.decidedAt
            ? new Date(dataUsage.decidedAt).toLocaleString()
            : "—",
        },
        {
          label: "Automated removal",
          value: config.conversationAutomatedRemoval ? "Enabled" : "Disabled",
        },
        {
          label: "Removal applied",
          value: dataUsage.automatedRemovalApplied ? "Yes" : "No",
        },
        {
          label: "Message",
          value: asDisplayValue(config.dataUsageConsentMessage),
        },
      ]}
    />
  );
};

interface ConfigSection {
  title: string;
  items: Array<{ label: string; value: string }>;
}

const ConfigSectionCard: React.FC<ConfigSection> = ({ title, items }) => (
  <Box>
    <Typography
      variant="overline"
      sx={{ display: "block", mb: 1.5, color: "text.disabled" }}
    >
      {title}
    </Typography>
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 1.5,
        }}
      >
        {items.map((item) => (
          <Box key={item.label}>
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "text.disabled",
              }}
            >
              {item.label}
            </Typography>
            <Typography
              sx={{
                fontSize: 13,
                color: "text.primary",
                mt: 0.25,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {item.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  </Box>
);

const getReplicationConfigSections = (config: unknown): ConfigSection[] => {
  const data = config && typeof config === "object" ? config as Record<string, unknown> : {};
  const replication = data.replication && typeof data.replication === "object"
    ? data.replication as Record<string, unknown>
    : {};
  const selectedLeia = getSnapshotLeia(data);
  const selectedConfiguration = selectedLeia?.configuration && typeof selectedLeia.configuration === "object"
    ? selectedLeia.configuration as Record<string, unknown>
    : {};
  const runnerConfiguration = selectedLeia?.runnerConfiguration && typeof selectedLeia.runnerConfiguration === "object"
    ? selectedLeia.runnerConfiguration as Record<string, unknown>
    : {};
  const nestedLeia = selectedLeia?.leia && typeof selectedLeia.leia === "object"
    ? selectedLeia.leia as Record<string, unknown>
    : {};
  const nestedMetadata = nestedLeia.metadata && typeof nestedLeia.metadata === "object"
    ? nestedLeia.metadata as Record<string, unknown>
    : {};
  const activity = selectedLeia?.activity && typeof selectedLeia.activity === "object"
    ? selectedLeia.activity as Record<string, unknown>
    : {};
  const lukeConfig = runnerConfiguration.lukeConfig && typeof runnerConfiguration.lukeConfig === "object"
    ? runnerConfiguration.lukeConfig as Record<string, unknown>
    : null;
  const realtimeConfig = runnerConfiguration.realtimeConfig && typeof runnerConfiguration.realtimeConfig === "object"
    ? runnerConfiguration.realtimeConfig as Record<string, unknown>
    : null;

  const capturedAt = typeof data.capturedAt === "string"
    ? new Date(data.capturedAt).toLocaleString()
    : "Unknown";
  const leiaId = asDisplayValue(selectedLeia?.id || data.leiaId);
  const modeData = selectedConfiguration.data;

  const sections: ConfigSection[] = config ? [
    {
      title: "Snapshot",
      items: [
        { label: "Captured at", value: capturedAt },
        { label: "LEIA", value: asDisplayValue(nestedMetadata.name || selectedLeia?.name || selectedLeia?.title || leiaId) },
      ],
    },
    {
      title: "Replication",
      items: [
        { label: "Name", value: asDisplayValue(replication.name) },
        { label: "Duration", value: formatDurationValue(replication.duration) },
        { label: "Repeatable", value: replication.isRepeatable ? "Yes" : "No" },
        { label: "Form", value: asDisplayValue(replication.form) },
      ],
    },
    {
      title: "Conversation",
      items: [
        { label: "Mode", value: asDisplayValue(selectedConfiguration.mode) },
        { label: "Ask solution", value: selectedConfiguration.askSolution ? "Yes" : "No" },
        { label: "Evaluate solution", value: selectedConfiguration.evaluateSolution ? "Yes" : "No" },
        { label: "Solution format", value: asDisplayValue(activity.solutionFormat) },
      ],
    },
    {
      title: "Model",
      items: [
        { label: "Provider", value: asDisplayValue(runnerConfiguration.provider) },
        { label: "Model", value: asDisplayValue(runnerConfiguration.modelName) },
        { label: "Audio mode", value: asDisplayValue(runnerConfiguration.audioMode) },
        { label: "Hide transcription", value: runnerConfiguration.hideAudioTranscription ? "Yes" : "No" },
      ],
    },
  ] : [];

  if (modeData && typeof modeData === "object") {
    sections.push({
      title: "Mode data",
      items: objectToConfigItems(modeData as Record<string, unknown>),
    });
  }

  if (realtimeConfig) {
    sections.push({
      title: "Realtime",
      items: objectToConfigItems(realtimeConfig),
    });
  }

  if (lukeConfig) {
    sections.push({
      title: "Luke",
      items: objectToConfigItems(lukeConfig),
    });
  }

  // Widgets 
  // if (Array.isArray(activity.widgets) && activity.widgets.length > 0) {
  //   sections.push({
  //     title: "Activity tools",
  //     items: [{ label: "Widgets", value: formatComplexValue(activity.widgets) }],
  //   });
  // }

  return sections;
};

const getSnapshotLeia = (data: Record<string, unknown>): Record<string, unknown> | undefined => {
  if (data.leia && typeof data.leia === "object") {
    return data.leia as Record<string, unknown>;
  }

  const experiment = data.experiment && typeof data.experiment === "object"
    ? data.experiment as Record<string, unknown>
    : {};
  const leias = Array.isArray(experiment.leias) ? experiment.leias : [];
  const leiaId = typeof data.leiaId === "string" ? data.leiaId : "";

  return leias.find((item) => {
    if (!item || typeof item !== "object") return false;
    const leia = item as Record<string, unknown>;
    return leia.id === leiaId || leia._id === leiaId;
  }) as Record<string, unknown> | undefined;
};

const asDisplayValue = (value: unknown): string => {
  if (value == null || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return formatComplexValue(value);
};

const formatDurationValue = (value: unknown): string => {
  if (typeof value !== "number" || value <= 0) return "No limit";
  const minutes = value / 60;
  return Number.isInteger(minutes) ? `${minutes} min` : `${value} sec`;
};

const objectToConfigItems = (value: Record<string, unknown>): Array<{ label: string; value: string }> => (
  Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== "")
    .map(([key, entryValue]) => ({
      label: labelizeKey(key),
      value: asDisplayValue(entryValue),
    }))
);

const labelizeKey = (value: string): string => (
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
);

const formatComplexValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value.map((item) => formatComplexValue(item)).join("\n");
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== "")
      .map(([key, entryValue]) => `${labelizeKey(key)}: ${asDisplayValue(entryValue)}`)
      .join("\n") || "—";
  }
  return String(value);
};

// Render a mermaid diagram into a Paper. Falls back to a raw code block
// if the diagram fails to parse so the admin can still inspect what the
// student submitted.
const MermaidPreview: React.FC<{ code: string; sessionId: string }> = ({
  code,
  sessionId,
}) => {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef<string>(`mermaid-conv-${sessionId}`);

  useEffect(() => {
    idRef.current = `mermaid-conv-${sessionId}-${Date.now()}`;
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    ensureMermaid();
    const render = async () => {
      try {
        cleanupMermaidRenderArtifacts(idRef.current);
        const { svg: rendered } = await mermaid.render(idRef.current, code);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setSvg(null);
          setError(err instanceof Error ? err.message : "Render error");
        }
      }
    };
    render();
    return () => {
      cancelled = true;
      cleanupMermaidRenderArtifacts(idRef.current);
    };
  }, [code, sessionId]);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        borderRadius: 2,
        bgcolor: "background.paper",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 220,
        overflow: "auto",
        "& svg": { maxWidth: "100%", height: "auto" },
      }}
    >
      {svg ? (
        <Box
          sx={{ width: "100%", textAlign: "center" }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : error ? (
        <Box sx={{ width: "100%" }}>
          <Typography
            variant="caption"
            sx={{ color: "error.main", display: "block", mb: 1 }}
          >
            Diagram could not be rendered: {error}
          </Typography>
          <Typography
            component="pre"
            sx={{
              fontSize: 12,
              fontFamily:
                "'JetBrains Mono Variable', ui-monospace, monospace",
              color: "text.primary",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              m: 0,
            }}
          >
            {code}
          </Typography>
        </Box>
      ) : (
        <Typography variant="caption" sx={{ color: "text.disabled" }}>
          Rendering diagram…
        </Typography>
      )}
    </Paper>
  );
};

const SessionDetailSkeleton: React.FC = () => (
  <Box sx={{ p: 4, maxWidth: 880 }}>
    <Skeleton variant="text" width={260} height={32} />
    <Skeleton variant="text" width={320} height={14} sx={{ mt: 0.5 }} />
    <Stack direction="row" gap={1} sx={{ mt: 2, mb: 4 }}>
      <Skeleton variant="rounded" width={88} height={22} sx={{ borderRadius: 999 }} />
      <Skeleton variant="rounded" width={84} height={22} sx={{ borderRadius: 999 }} />
    </Stack>
    <Skeleton variant="text" width={120} height={12} sx={{ mb: 1 }} />
    <Skeleton variant="rounded" width="100%" height={160} sx={{ borderRadius: 2 }} />
    <Skeleton variant="text" width={120} height={12} sx={{ mt: 3, mb: 1 }} />
    <Skeleton variant="rounded" width="100%" height={120} sx={{ borderRadius: 2 }} />
  </Box>
);

const KpiCard: React.FC<{
  label: string;
  value: number | string | null;
}> = ({ label, value }) => (
  <Paper
    variant="outlined"
    sx={{
      px: 2,
      py: 1.25,
      borderRadius: 2,
      display: "flex",
      flexDirection: "column",
      gap: 0.25,
    }}
  >
    <Typography
      sx={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "text.disabled",
      }}
    >
      {label}
    </Typography>
    {value === null ? (
      <Skeleton variant="text" width={64} height={26} />
    ) : (
      <Typography
        sx={{
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "-0.015em",
          color: "text.primary",
        }}
      >
        {value}
      </Typography>
    )}
  </Paper>
);

export default Conversations;
