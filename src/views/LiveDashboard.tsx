import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios, { AxiosRequestConfig } from "axios";
import { io } from "socket.io-client";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AdminLayout from "../components/admin/AdminLayout";
import {
  MasterDetailLayout,
  MasterDetailEmptyState,
} from "../components/admin/MasterDetailLayout";
import StatusDot from "../components/admin/StatusDot";
import { formatTimeAgo } from "../components/admin/RelativeTime";
import LeiaPreviewDrawer from "../components/admin/LeiaPreview";
import { writeReplicationName } from "../lib/replicationNames";
import { useAuth } from "../context/useAuth";

interface SupervisorFlag {
  category: string;
  severity: "low" | "medium" | "high";
  note: string;
  quote?: string | null;
  at?: string;
}

interface LiveSession {
  id: string;
  user: { email: string; id: string };
  leia: string;
  startedAt: string;
  finishedAt?: string | null;
  isActive: boolean;
  messageCount: number;
  lastMessage?: {
    text: string;
    isLeia: boolean;
    timestamp: string;
  } | null;
  supervisorFlags?: SupervisorFlag[];
  supervisorFlagCount?: number;
}

// Loose typing for the parsed LEIA spec returned by the workbench-backend.
// We only care about a handful of fields for display; the rest is shown
// as raw JSON in the drawer.
interface ParsedLeia {
  id?: string;
  metadata?: { name?: string; version?: string };
  spec?: Record<string, unknown>;
  [key: string]: unknown;
}

const REPLICATION_TOKENS_KEY = "replicationTokens";

const ShareLinkDialog: React.FC<{
  open: boolean;
  url: string;
  onClose: () => void;
}> = ({ open, url, onClose }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: { sx: { borderRadius: 2 } },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 18,
          fontWeight: 600,
          py: 2.5,
          px: 3,
        }}
      >
        Spectate link
        <IconButton size="small" onClick={onClose}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 3 }}>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>
          Share this link to spectate the session live (valid for 1 hour).
        </Typography>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1.5,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "surfaces.subtle",
            mb: 2,
          }}
        >
          <Typography
            sx={{
              fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
              fontSize: 12,
              wordBreak: "break-all",
              color: "text.primary",
            }}
          >
            {url}
          </Typography>
        </Box>
        <Button
          fullWidth
          variant="contained"
          startIcon={
            copied ? (
              <CheckCircleIcon sx={{ fontSize: 16 }} />
            ) : (
              <ContentCopyIcon sx={{ fontSize: 16 }} />
            )
          }
          onClick={handleCopy}
          sx={{
            bgcolor: copied ? "success.main" : "primary.main",
            "&:hover": {
              bgcolor: copied ? "success.main" : "primary.dark",
            },
          }}
        >
          {copied ? "Copied" : "Copy to clipboard"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export const LiveDashboard = () => {
  const { id: replicationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "finished">("active");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replicationName, setReplicationName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leiasById, setLeiasById] = useState<Record<string, ParsedLeia>>({});
  const [leiaDrawerId, setLeiaDrawerId] = useState<string | null>(null);
  const [shareDialog, setShareDialog] = useState<{ open: boolean; url: string }>({
    open: false,
    url: "",
  });
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [replicationToken, setReplicationToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (!replicationId) return;
    setTokenReady(false);
    const tokensRaw = localStorage.getItem(REPLICATION_TOKENS_KEY);
    let tokens: Record<string, string> = {};
    if (tokensRaw) {
      try {
        const parsed = JSON.parse(tokensRaw);
        if (parsed && typeof parsed === "object") tokens = parsed;
      } catch {
        /* ignore */
      }
    }
    const searchParams = new URLSearchParams(location.search);
    const tokenFromQuery = searchParams.get("token");
    if (tokenFromQuery) {
      tokens[replicationId] = tokenFromQuery;
      localStorage.setItem(REPLICATION_TOKENS_KEY, JSON.stringify(tokens));
      setReplicationToken(tokenFromQuery);
    } else {
      setReplicationToken(tokens[replicationId] || null);
    }
    setTokenReady(true);
  }, [location.search, replicationId]);

  const buildRequestConfig = useCallback(
    (config: AxiosRequestConfig = {}) => {
      const headers = { ...(config.headers || {}) };
      if (token && isAdmin) {
        headers.Authorization = `Bearer ${token}`;
      }
      const params = { ...(config.params || {}) };
      if (replicationToken) params.token = replicationToken;
      const final: AxiosRequestConfig = { ...config };
      if (Object.keys(headers).length > 0) final.headers = headers;
      if (Object.keys(params).length > 0) final.params = params;
      return final;
    },
    [token, isAdmin, replicationToken]
  );

  const fetchSessions = useCallback(async () => {
    if (!replicationId) return;
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/spectator/replications/${replicationId}/sessions`,
        buildRequestConfig()
      );
      setSessions(response.data.sessions);
      setLoading(false);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        if (replicationToken) setError("Invalid or expired replication token");
        else navigate("/login");
      } else {
        const msg =
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : "Failed to load sessions";
        setError(msg);
      }
      setLoading(false);
    }
  }, [replicationId, buildRequestConfig, replicationToken, navigate]);

  useEffect(() => {
    if (!tokenReady || !replicationId) return;
    const fetchRep = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${replicationId}`,
          buildRequestConfig()
        );
        setReplicationName(response.data.name);
        if (replicationId && response.data.name) {
          writeReplicationName(replicationId, response.data.name);
        }
        // Build LEIA-slot-id → parsed LEIA map. The session's `leia`
        // field points to the LEIA-slot id within experiment.leias
        // (i.e. `entry.id`), NOT the underlying LEIA document id
        // (`entry.leia.id`). Index by every possible key so older
        // replication shapes still resolve.
        const expLeias: Array<{
          id?: string;
          leia: ParsedLeia & { _id?: string };
        }> = response.data?.experiment?.leias ?? [];
        const map: Record<string, ParsedLeia> = {};
        for (const entry of expLeias) {
          const l = entry?.leia;
          if (!l) continue;
          const slotId = entry?.id;
          const leiaId = (l.id as string) || (l._id as string) || "";
          if (slotId) map[slotId] = l;
          if (leiaId) map[leiaId] = l;
        }
        setLeiasById(map);
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          if (replicationToken) setError("Invalid or expired replication token");
          else navigate("/login");
        }
      }
    };
    fetchRep();
  }, [
    replicationId,
    buildRequestConfig,
    tokenReady,
    replicationToken,
    navigate,
  ]);

  useEffect(() => {
    if (!tokenReady) return;
    fetchSessions();
  }, [fetchSessions, tokenReady]);

  // WebSocket: live updates on new messages and session-finished events.
  useEffect(() => {
    if (!tokenReady || !replicationId) return;
    const authPayload: Record<string, string> = {};
    if (token && isAdmin) {
      authPayload.token = token;
    } else if (replicationToken) {
      authPayload.shareToken = replicationToken;
    } else {
      return;
    }

    const newSocket = io(import.meta.env.VITE_APP_BACKEND, {
      auth: authPayload,
    });

    newSocket.on("connect", () => {
      newSocket.emit("dashboard:join", replicationId);
    });
    newSocket.on(
      "session:message",
      (data: { sessionId: string; message: LiveSession["lastMessage"] }) => {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === data.sessionId
              ? {
                  ...s,
                  messageCount: s.messageCount + 1,
                  lastMessage: data.message,
                }
              : s
          )
        );
      }
    );
    newSocket.on(
      "session:finished",
      (data: { sessionId: string; finishedAt: string }) => {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === data.sessionId
              ? { ...s, finishedAt: data.finishedAt, isActive: false }
              : s
          )
        );
      }
    );
    newSocket.on(
      "session:supervisorFlag",
      (data: {
        sessionId: string;
        flags?: SupervisorFlag[];
        flagCount?: number;
      }) => {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === data.sessionId
              ? {
                  ...s,
                  supervisorFlags: [
                    ...(s.supervisorFlags || []),
                    ...(data.flags || []),
                  ],
                  supervisorFlagCount:
                    data.flagCount ??
                    (s.supervisorFlagCount || 0) + (data.flags?.length || 0),
                }
              : s
          )
        );
      }
    );
    newSocket.on("dashboard:error", (payload: { message?: string }) => {
      setError(payload.message || "Real-time access denied");
    });
    newSocket.on("connect_error", (socketError) => {
      setError(socketError.message || "WebSocket connection error");
    });

    return () => {
      newSocket.emit("dashboard:leave", replicationId);
      newSocket.disconnect();
    };
  }, [token, isAdmin, replicationId, replicationToken, tokenReady]);

  const handleShareLink = async (sessionId: string, open: boolean = true) => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/spectator/sessions/${sessionId}/token`,
        { expiresIn: 3600 },
        buildRequestConfig()
      );
      if (!open) return response.data.spectateUrl;
      setShareDialog({ open: true, url: response.data.spectateUrl });
    } catch (err) {
      alert("Failed to generate spectate link");
      console.error(err);
    }
  };

  const handleWatch = async (sessionId: string) => {
    try {
      const link = await handleShareLink(sessionId, false);
      window.open(link, "_blank");
    } catch (err) {
      console.error("Failed to open watch link:", err);
    }
  };

  // Apply filter + search; keep active sessions first within "all".
  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchSearch = (s: LiveSession) =>
      !q || (s.user?.email ?? "").toLowerCase().includes(q);
    const matchFilter = (s: LiveSession) =>
      filter === "all" ? true : filter === "active" ? s.isActive : !s.isActive;
    return sessions
      .filter((s) => matchFilter(s) && matchSearch(s))
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return (
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );
      });
  }, [sessions, search, filter]);

  const activeCount = sessions.filter((s) => s.isActive).length;
  const finishedCount = sessions.length - activeCount;

  const selected = useMemo(
    () => filteredSessions.find((s) => s.id === selectedId) ?? null,
    [filteredSessions, selectedId]
  );

  // Auto-select first session when the list changes and current selection
  // disappears.
  useEffect(() => {
    if (filteredSessions.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!filteredSessions.some((s) => s.id === selectedId)) {
      setSelectedId(filteredSessions[0].id);
    }
  }, [filteredSessions, selectedId]);

  const headerActions = (
    <Stack direction="row" gap={1}>
      <Button
        variant="outlined"
        color="inherit"
        size="small"
        startIcon={<ForumOutlinedIcon sx={{ fontSize: 16 }} />}
        onClick={() => navigate(`/replications/${replicationId}/conversations`)}
        sx={{ borderColor: "divider", color: "text.primary" }}
      >
        Conversations
      </Button>
      <Button
        variant="outlined"
        size="small"
        startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
        onClick={fetchSessions}
      >
        Refresh
      </Button>
    </Stack>
  );

  return (
    <AdminLayout
      breadcrumbs={[
        { label: "Replications", to: "/administration" },
        {
          label: replicationName || "Replication",
          to: `/replications/${replicationId}`,
        },
        { label: "Live" },
      ]}
      actions={headerActions}
      flush
    >
      <Box
        sx={{
          px: 4,
          pt: 2.5,
          pb: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.default",
        }}
      >
        <Tabs
          value={filter}
          onChange={(_, v) => setFilter(v)}
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
          <Tab
            value="active"
            label={
              <Stack direction="row" gap={0.75} alignItems="center">
                <StatusDot color="success" pulse />
                Active
                <Box
                  sx={{
                    px: 0.75,
                    py: 0.1,
                    borderRadius: 1,
                    bgcolor: "surfaces.subtle",
                    fontSize: 11,
                    color: "text.secondary",
                    fontWeight: 500,
                  }}
                >
                  {activeCount}
                </Box>
              </Stack>
            }
          />
          <Tab
            value="finished"
            label={`Finished (${finishedCount})`}
          />
          <Tab value="all" label={`All (${sessions.length})`} />
        </Tabs>
      </Box>

      <MasterDetailLayout
        storageKey="adminMD:live.width"
        defaultWidth={380}
        searchPlaceholder="Search by email..."
        searchValue={search}
        onSearchChange={setSearch}
        isListEmpty={!loading && filteredSessions.length === 0 && !error}
        emptyListMessage={
          sessions.length === 0
            ? "No sessions yet."
            : "No sessions match the current filter."
        }
        list={
          loading ? (
            <>
              {Array.from({ length: 6 }).map((_, i) => (
                <SessionRowSkeleton key={i} />
              ))}
            </>
          ) : error ? (
            <Box sx={{ p: 4 }}>
              <Typography variant="body2" sx={{ color: "error.main" }}>
                {error}
              </Typography>
            </Box>
          ) : (
            filteredSessions.map((s) => (
              <SessionRow
                key={s.id}
                item={s}
                selected={s.id === selectedId}
                onClick={() => setSelectedId(s.id)}
              />
            ))
          )
        }
        detail={
          loading ? (
            <SessionDetailSkeleton />
          ) : selected ? (
            <SessionDetail
              item={selected}
              replicationName={replicationName}
              leia={leiasById[selected.leia]}
              onOpenLeia={
                leiasById[selected.leia] ? () => setLeiaDrawerId(selected.leia) : undefined
              }
              onWatch={() => handleWatch(selected.id)}
              onShare={() => handleShareLink(selected.id, true)}
            />
          ) : (
            <MasterDetailEmptyState
              icon={<MonitorHeartOutlinedIcon sx={{ fontSize: 32 }} />}
              message="Select a session to see live details"
            />
          )
        }
      />

      <ShareLinkDialog
        open={shareDialog.open}
        url={shareDialog.url}
        onClose={() => setShareDialog({ open: false, url: "" })}
      />

      <LeiaPreviewDrawer
        leia={leiaDrawerId ? leiasById[leiaDrawerId] || null : null}
        onClose={() => setLeiaDrawerId(null)}
      />
    </AdminLayout>
  );
};

// — Row + Detail components --------------------------------------------

const SessionRow: React.FC<{
  item: LiveSession;
  selected: boolean;
  onClick: () => void;
}> = ({ item, selected, onClick }) => {
  return (
    <ButtonBase
      onClick={onClick}
      aria-current={selected ? "page" : undefined}
      sx={{
        width: "100%",
        minHeight: 72,
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
          <StatusDot color={item.isActive ? "success" : "neutral"} pulse={item.isActive} />
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
          {item.messageCount} message{item.messageCount === 1 ? "" : "s"}
          {item.lastMessage ? ` · "${item.lastMessage.text}"` : ""}
        </Typography>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <Typography variant="caption" sx={{ color: "text.disabled" }}>
          {formatTimeAgo(item.startedAt)}
        </Typography>
        {item.supervisorFlagCount ? (
          <Chip
            size="small"
            label={`⚑ ${item.supervisorFlagCount}`}
            sx={{
              height: 20,
              fontSize: 11,
              fontWeight: 600,
              mt: 0.5,
              bgcolor: "rgba(211,47,47,0.08)",
              color: "error.main",
            }}
          />
        ) : null}
      </Box>
    </ButtonBase>
  );
};

const SessionRowSkeleton: React.FC = () => (
  <Box
    sx={{
      minHeight: 72,
      px: 2,
      py: 1.5,
      borderBottom: "1px solid",
      borderColor: "divider",
    }}
  >
    <Skeleton variant="text" width="55%" height={18} />
    <Skeleton variant="text" width="80%" height={14} sx={{ mt: 0.5 }} />
  </Box>
);

const SessionDetail: React.FC<{
  item: LiveSession;
  replicationName: string;
  leia?: ParsedLeia | null;
  onOpenLeia?: () => void;
  onWatch: () => void;
  onShare: () => void;
}> = ({ item, replicationName, leia, onOpenLeia, onWatch, onShare }) => {
  const duration = useMemo(() => {
    const start = new Date(item.startedAt).getTime();
    const end = item.finishedAt ? new Date(item.finishedAt).getTime() : Date.now();
    const secs = Math.max(0, Math.floor((end - start) / 1000));
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }, [item.startedAt, item.finishedAt]);

  return (
    <Box sx={{ p: 4, maxWidth: 720 }}>
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1 }}>
        <StatusDot color={item.isActive ? "success" : "neutral"} pulse={item.isActive} />
        <Typography
          sx={{
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            color: "text.primary",
          }}
        >
          {item.user?.email || "Anonymous"}
        </Typography>
      </Stack>

      <Stack direction="row" gap={1} sx={{ mb: 4 }}>
        <Chip
          size="small"
          variant="outlined"
          label={item.isActive ? "Active" : "Finished"}
          sx={{
            height: 22,
            fontSize: 11,
            borderColor: item.isActive ? "success.main" : "divider",
            color: item.isActive ? "success.main" : "text.secondary",
            bgcolor: item.isActive ? "rgba(22,163,74,0.06)" : "transparent",
          }}
        />
        <Chip
          size="small"
          variant="outlined"
          label={`Replication · ${replicationName || "—"}`}
          sx={{ height: 22, fontSize: 11, borderColor: "divider" }}
        />
      </Stack>

      <Paper
        variant="outlined"
        sx={{ p: 2.5, borderRadius: 2, mb: 3 }}
      >
        <Typography
          variant="overline"
          sx={{ display: "block", color: "text.disabled", mb: 1 }}
        >
          Last message
        </Typography>
        {item.lastMessage ? (
          <>
            <Typography
              sx={{
                fontSize: 14,
                color: "text.primary",
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
              }}
            >
              {item.lastMessage.text}
            </Typography>
            <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 1 }}>
              {item.lastMessage.isLeia ? "LEIA" : "User"} ·{" "}
              {new Date(item.lastMessage.timestamp).toLocaleTimeString()}
            </Typography>
          </>
        ) : (
          <Typography
            sx={{ fontSize: 13, color: "text.disabled", fontStyle: "italic" }}
          >
            No messages yet.
          </Typography>
        )}
      </Paper>

      {item.supervisorFlags && item.supervisorFlags.length > 0 && (
        <Paper
          variant="outlined"
          sx={{ p: 2.5, borderRadius: 2, mb: 3, borderColor: "error.light" }}
        >
          <Typography
            variant="overline"
            sx={{ display: "block", color: "error.main", mb: 1 }}
          >
            Supervisor flags ({item.supervisorFlags.length})
          </Typography>
          <Stack gap={1}>
            {item.supervisorFlags.map((flag, idx) => (
              <Box
                key={idx}
                sx={{
                  px: 1.5,
                  py: 1,
                  borderRadius: 1.5,
                  bgcolor: "rgba(211,47,47,0.05)",
                  borderColor:
                    flag.severity === "high"
                      ? "error.main"
                      : flag.severity === "medium"
                        ? "warning.main"
                        : "divider",
                }}
              >
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: "text.secondary", textTransform: "uppercase" }}>
                  {flag.category} · {flag.severity}
                </Typography>
                <Typography sx={{ fontSize: 13, color: "text.primary", mt: 0.25 }}>
                  {flag.note}
                </Typography>
                {flag.quote ? (
                  <Typography sx={{ fontSize: 12, color: "text.disabled", fontStyle: "italic", mt: 0.25 }}>
                    “{flag.quote}”
                  </Typography>
                ) : null}
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      <Box sx={{ mb: 4 }}>
        <DetailRow label="Started">
          {new Date(item.startedAt).toLocaleString()}
        </DetailRow>
        {item.finishedAt && (
          <DetailRow label="Finished">
            {new Date(item.finishedAt).toLocaleString()}
          </DetailRow>
        )}
        <DetailRow label="Duration">{duration}</DetailRow>
        <DetailRow label="Messages">{item.messageCount}</DetailRow>
        <DetailRow label="LEIA">
          {leia ? (
            <ButtonBase
              onClick={onOpenLeia}
              sx={{
                fontSize: 13,
                color: "primary.main",
                fontWeight: 500,
                borderRadius: "4px",
                px: 0.5,
                py: 0.25,
                mx: -0.5,
                "&:hover": {
                  bgcolor: "surfaces.accent",
                  textDecoration: "underline",
                },
              }}
            >
              {leia.metadata?.name || item.leia}
            </ButtonBase>
          ) : (
            <Typography
              sx={{
                fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
                fontSize: 12,
                color: "text.secondary",
              }}
            >
              {item.leia}
            </Typography>
          )}
        </DetailRow>
      </Box>

      <Stack direction="row" gap={1}>
        <Button
          variant="contained"
          startIcon={<VisibilityOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={onWatch}
        >
          Watch live
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<ShareOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={onShare}
          sx={{ borderColor: "divider", color: "text.primary" }}
        >
          Share link
        </Button>
      </Stack>
    </Box>
  );
};

const SessionDetailSkeleton: React.FC = () => (
  <Box sx={{ p: 4, maxWidth: 720 }}>
    <Skeleton variant="text" width={280} height={32} />
    <Skeleton
      variant="rounded"
      width={120}
      height={22}
      sx={{ mt: 1, borderRadius: 999 }}
    />
    <Skeleton
      variant="rounded"
      width={"100%"}
      height={88}
      sx={{ mt: 3, borderRadius: 2 }}
    />
    {Array.from({ length: 4 }).map((_, i) => (
      <Box key={i} sx={{ display: "flex", py: 1, mt: i === 0 ? 3 : 0 }}>
        <Skeleton variant="text" width={120} height={18} />
        <Skeleton variant="text" width="40%" height={18} sx={{ ml: 2 }} />
      </Box>
    ))}
    <Stack direction="row" gap={1} sx={{ mt: 3 }}>
      <Skeleton variant="rounded" width={120} height={32} />
      <Skeleton variant="rounded" width={110} height={32} />
    </Stack>
  </Box>
);

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <Box sx={{ display: "flex", py: 1, alignItems: "flex-start" }}>
    <Typography
      sx={{ width: 140, flexShrink: 0, fontSize: 13, color: "text.secondary" }}
    >
      {label}
    </Typography>
    <Box sx={{ flex: 1, fontSize: 14, color: "text.primary", minWidth: 0 }}>
      {children}
    </Box>
  </Box>
);

export default LiveDashboard;
