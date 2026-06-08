import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/useAuth";
import {
  Box,
  ButtonBase,
  Button,
  Stack,
  Typography,
  Skeleton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import AdminLayout from "../components/admin/AdminLayout";
import MasterDetailLayout, {
  MasterDetailEmptyState,
} from "../components/admin/MasterDetailLayout";
import StatusDot from "../components/admin/StatusDot";
import CodeChip from "../components/admin/CodeChip";
import { formatTimeAgo } from "../components/admin/RelativeTime";
import { writeReplicationName } from "../lib/replicationNames";
import FilterButton, {
  type FilterGroup,
  type FilterState,
  type SortOption,
  type SortState,
} from "../components/admin/FilterButton";

interface Replication {
  id: string;
  name: string;
  isActive: boolean;
  duration: number | null;
  isRepeatable: boolean;
  code: string;
  createdAt: string;
  updatedAt: string;
  experiment: { name: string };
}

const formatDuration = (seconds: number | null) => {
  if (!seconds) return "Untimed";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m && s) return `${m}m ${s}s`;
  if (m) return `${m}m`;
  return `${s}s`;
};

interface RowProps {
  item: Replication;
  selected: boolean;
  onClick: () => void;
  onCopyCode: () => void;
  copied: boolean;
}

const ReplicationRow: React.FC<RowProps> = ({
  item,
  selected,
  onClick,
  onCopyCode,
  copied,
}) => {
  return (
    <ButtonBase
      onClick={onClick}
      aria-current={selected ? "page" : undefined}
      sx={{
        width: "100%",
        minHeight: 64,
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
          <StatusDot color={item.isActive ? "success" : "neutral"} />
          <Typography
            variant="subtitle2"
            sx={{
              color: selected ? "primary.dark" : "text.primary",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.name}
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
          {item.experiment?.name ?? "—"}
          {" · "}
          {formatDuration(item.duration)}
          {" · "}
          {item.isRepeatable ? "Repeatable" : "Single-run"}
        </Typography>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 0.5,
          flexShrink: 0,
        }}
      >
        <Box
          // Stop click on the code chip from bubbling to the row selection.
          onClick={(e) => {
            e.stopPropagation();
            onCopyCode();
          }}
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
          title="Copy code"
        >
          <CodeChip onClick={onCopyCode}>{item.code}</CodeChip>
          {copied && (
            <Typography
              variant="caption"
              sx={{ color: "success.main", fontWeight: 600, fontSize: 10 }}
            >
              Copied
            </Typography>
          )}
        </Box>
        <Typography variant="caption" sx={{ color: "text.disabled" }}>
          {formatTimeAgo(item.updatedAt)}
        </Typography>
      </Box>
    </ButtonBase>
  );
};

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <Box sx={{ display: "flex", py: 1, alignItems: "flex-start" }}>
    <Typography
      sx={{
        width: 140,
        flexShrink: 0,
        fontSize: 13,
        color: "text.secondary",
      }}
    >
      {label}
    </Typography>
    <Box sx={{ flex: 1, fontSize: 14, color: "text.primary", minWidth: 0 }}>
      {children}
    </Box>
  </Box>
);

const ReplicationDetail: React.FC<{
  item: Replication;
  onOpen: () => void;
  onLive: () => void;
  onConversations: () => void;
  onCopyCode: () => void;
  copied: boolean;
}> = ({ item, onOpen, onLive, onConversations, onCopyCode, copied }) => {
  return (
    <Box sx={{ p: 4, maxWidth: 880 }}>
      <Typography
        sx={{
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "-0.015em",
          color: "text.primary",
        }}
      >
        {item.name}
      </Typography>
      <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            px: 1,
            py: 0.25,
            border: "1px solid",
            borderColor: item.isActive ? "success.main" : "divider",
            color: item.isActive ? "success.main" : "text.secondary",
            borderRadius: "999px",
            fontSize: 11,
            fontWeight: 500,
            bgcolor: item.isActive ? "rgba(22,163,74,0.06)" : "transparent",
          }}
        >
          <StatusDot color={item.isActive ? "success" : "neutral"} />
          {item.isActive ? "Active" : "Inactive"}
        </Box>
      </Box>

      <Box sx={{ mt: 4 }}>
        <DetailRow label="Code">
          <Stack direction="row" alignItems="center" gap={1}>
            <CodeChip onClick={onCopyCode} title="Copy code">
              {item.code}
            </CodeChip>
            {copied && (
              <Typography
                variant="caption"
                sx={{ color: "success.main", fontWeight: 600 }}
              >
                Copied!
              </Typography>
            )}
          </Stack>
        </DetailRow>
        <DetailRow label="Experiment">{item.experiment?.name ?? "—"}</DetailRow>
        <DetailRow label="Duration">{formatDuration(item.duration)}</DetailRow>
        <DetailRow label="Repeatable">
          {item.isRepeatable ? "Yes" : "No"}
        </DetailRow>
        <DetailRow label="Last updated">
          {formatTimeAgo(item.updatedAt)}
        </DetailRow>
        <DetailRow label="Created">
          {new Date(item.createdAt).toLocaleString()}
        </DetailRow>
      </Box>

      <Stack direction="row" gap={1} sx={{ mt: 4 }}>
        <Button
          variant="contained"
          startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
          onClick={onOpen}
        >
          Open
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<MonitorHeartOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={onLive}
          sx={{ borderColor: "divider", color: "text.primary" }}
        >
          Live
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<ForumOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={onConversations}
          sx={{ borderColor: "divider", color: "text.primary" }}
        >
          Conversations
        </Button>
      </Stack>
    </Box>
  );
};

export const Administration: React.FC = () => {
  const navigate = useNavigate();
  const [replications, setReplications] = useState<Replication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { token, isLoading } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>({});
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const handleCopyCode = (rep: Replication) => {
    navigator.clipboard.writeText(rep.code);
    setCopiedCodeId(rep.id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };
  const [sort, setSort] = useState<SortState>({ by: "updated", dir: "desc" });

  const sortOptions: SortOption[] = useMemo(
    () => [
      { id: "name", label: "Name" },
      { id: "updated", label: "Last updated" },
      { id: "created", label: "Created" },
      { id: "code", label: "Code" },
      { id: "status", label: "Status" },
    ],
    []
  );

  const filterGroups: FilterGroup[] = useMemo(
    () => [
      {
        id: "status",
        label: "Status",
        options: [
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ],
      },
      {
        id: "repeatable",
        label: "Repeatable",
        options: [
          { value: "yes", label: "Repeatable" },
          { value: "no", label: "Single-run" },
        ],
      },
      {
        id: "duration",
        label: "Duration",
        options: [
          { value: "timed", label: "Has time limit" },
          { value: "untimed", label: "Untimed" },
        ],
      },
    ],
    []
  );

  useEffect(() => {
    const fetchReplications = async () => {
      try {
        if (isLoading) return;
        const response = await axios.get<Replication[]>(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setReplications(response.data);
        // Seed the name cache so deep-linked breadcrumbs render the
        // replication name instantly the next time the user opens one.
        for (const r of response.data) {
          if (r.id && r.name) writeReplicationName(r.id, r.name);
        }
        if (response.data.length > 0) {
          setSelectedId(response.data[0].id);
        }
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          setTimeout(() => navigate("/login"), 2000);
        } else {
          console.error("Failed to load replications:", error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchReplications();
  }, [navigate, token, isLoading]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const statusFilter = filters.status ?? [];
    const repeatFilter = filters.repeatable ?? [];
    const durationFilter = filters.duration ?? [];
    const matched = replications.filter((r) => {
      if (
        q &&
        !(
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q)
        )
      ) {
        return false;
      }
      if (statusFilter.length > 0) {
        const wantsActive = statusFilter.includes("active");
        const wantsInactive = statusFilter.includes("inactive");
        if (!((r.isActive && wantsActive) || (!r.isActive && wantsInactive))) {
          return false;
        }
      }
      if (repeatFilter.length > 0) {
        const wantsYes = repeatFilter.includes("yes");
        const wantsNo = repeatFilter.includes("no");
        if (!((r.isRepeatable && wantsYes) || (!r.isRepeatable && wantsNo))) {
          return false;
        }
      }
      if (durationFilter.length > 0) {
        const hasDuration = Boolean(r.duration);
        const wantsTimed = durationFilter.includes("timed");
        const wantsUntimed = durationFilter.includes("untimed");
        if (!((hasDuration && wantsTimed) || (!hasDuration && wantsUntimed))) {
          return false;
        }
      }
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    const sorted = [...matched].sort((a, b) => {
      switch (sort.by) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "code":
          return a.code.localeCompare(b.code) * dir;
        case "created":
          return (
            (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
          );
        case "status":
          // Active first when desc, inactive first when asc.
          return ((a.isActive ? 1 : 0) - (b.isActive ? 1 : 0)) * dir;
        case "updated":
        default:
          return (
            (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * dir
          );
      }
    });
    return sorted;
  }, [replications, search, filters, sort]);

  const selected = useMemo(
    () => filtered.find((r) => r.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  // Route directly to the experiments list — same target the old
  // Navbar's "New Replication" link used. Renders as a real anchor
  // (right-click "open in new tab" works) but intercepts plain clicks
  // to keep navigation inside the SPA.
  const headerActions = (
    <Button
      component="a"
      href="/experiments"
      onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
        if (
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        ) {
          return;
        }
        e.preventDefault();
        navigate("/experiments");
      }}
      variant="contained"
      size="small"
      startIcon={<AddIcon sx={{ fontSize: 16 }} />}
    >
      New Replication
    </Button>
  );

  return (
    <AdminLayout title="Replications" actions={headerActions} flush>
      <MasterDetailLayout
        storageKey="adminMD:replications.width"
        searchPlaceholder="Search replications..."
        searchValue={search}
        onSearchChange={setSearch}
        listHeaderActions={
          <FilterButton
            groups={filterGroups}
            value={filters}
            onChange={setFilters}
            sortOptions={sortOptions}
            sortValue={sort}
            onSortChange={setSort}
            matchedCount={filtered.length}
          />
        }
        isListEmpty={!loading && filtered.length === 0}
        emptyListMessage={
          replications.length === 0
            ? "No replications yet."
            : "No replications match your search."
        }
        list={
          loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <ReplicationRowSkeleton key={i} />
              ))
            : filtered.map((rep) => (
                <ReplicationRow
                  key={rep.id}
                  item={rep}
                  selected={rep.id === selectedId}
                  onClick={() => setSelectedId(rep.id)}
                  onCopyCode={() => handleCopyCode(rep)}
                  copied={copiedCodeId === rep.id}
                />
              ))
        }
        detail={
          loading ? (
            <ReplicationDetailSkeleton />
          ) : selected ? (
            <ReplicationDetail
              item={selected}
              onOpen={() => navigate(`/replications/${selected.id}`)}
              onLive={() => navigate(`/replications/${selected.id}/live`)}
              onConversations={() =>
                navigate(`/replications/${selected.id}/conversations`)
              }
              onCopyCode={() => handleCopyCode(selected)}
              copied={copiedCodeId === selected.id}
            />
          ) : (
            <MasterDetailEmptyState
              icon={<LayersOutlinedIcon sx={{ fontSize: 32 }} />}
              message="Select a replication to see details"
            />
          )
        }
      />
    </AdminLayout>
  );
};

const ReplicationRowSkeleton: React.FC = () => (
  <Box
    sx={{
      minHeight: 64,
      px: 2,
      py: 1.5,
      display: "flex",
      justifyContent: "space-between",
      borderBottom: "1px solid",
      borderColor: "divider",
    }}
  >
    <Box sx={{ flex: 1, pr: 2 }}>
      <Skeleton variant="text" width="60%" height={18} />
      <Skeleton
        variant="text"
        width="80%"
        height={14}
        sx={{ mt: 0.5 }}
      />
    </Box>
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 0.5,
      }}
    >
      <Skeleton variant="rounded" width={60} height={18} />
      <Skeleton variant="text" width={50} height={12} />
    </Box>
  </Box>
);

const ReplicationDetailSkeleton: React.FC = () => (
  <Box sx={{ p: 4, maxWidth: 880 }}>
    <Skeleton variant="text" width={240} height={32} />
    <Skeleton
      variant="rounded"
      width={80}
      height={22}
      sx={{ mt: 1, borderRadius: 999 }}
    />
    <Box sx={{ mt: 4 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Box key={i} sx={{ display: "flex", py: 1 }}>
          <Skeleton variant="text" width={120} height={18} />
          <Skeleton
            variant="text"
            width="40%"
            height={18}
            sx={{ ml: 2 }}
          />
        </Box>
      ))}
    </Box>
    <Box sx={{ mt: 4, display: "flex", gap: 1 }}>
      <Skeleton variant="rounded" width={88} height={32} />
      <Skeleton variant="rounded" width={88} height={32} />
      <Skeleton variant="rounded" width={120} height={32} />
    </Box>
  </Box>
);
