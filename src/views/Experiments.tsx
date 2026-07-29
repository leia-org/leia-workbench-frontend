import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Box,
  ButtonBase,
  Button,
  Stack,
  Typography,
  Skeleton,
  Chip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import { useAuth } from "../context";
import AdminLayout from "../components/admin/AdminLayout";
import MasterDetailLayout, {
  MasterDetailEmptyState,
} from "../components/admin/MasterDetailLayout";
import StatusDot from "../components/admin/StatusDot";
import { formatTimeAgo } from "../components/admin/RelativeTime";
import FilterButton, {
  type FilterGroup,
  type FilterState,
  type SortOption,
  type SortState,
} from "../components/admin/FilterButton";

interface ExperimentLeia {
  configuration: { mode: string };
  leia: string;
}

interface Experiment {
  id: string;
  isPublished: boolean;
  name: string;
  leias: ExperimentLeia[];
  createdAt: string;
  updatedAt: string;
  user?: {
    name?: string;
    email?: string;
    id?: string;
  } | null;
}

const getExperimentUserLabel = (experiment: Experiment) => {
  const owner = experiment.user ;
  return owner?.email ??  "";
};

interface RowProps {
  item: Experiment;
  selected: boolean;
  onClick: () => void;
  showUser: boolean;
}

const ExperimentRow: React.FC<RowProps> = ({
  item,
  selected,
  onClick,
  showUser,
}) => {
  const modes = useMemo(
    () => [...new Set(item.leias.map((l) => l.configuration.mode))].join(", "),
    [item.leias]
  );
  const userLabel = getExperimentUserLabel(item);
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
          <StatusDot color={item.isPublished ? "success" : "neutral"} />
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
          {showUser && userLabel && (
            <Chip
              size="small"
              label={userLabel}
              sx={{
                height: 20,
                maxWidth: 160,
                flexShrink: 1,
                bgcolor: "surfaces.subtle",
                color: "text.secondary",
                borderRadius: 1,
                "& .MuiChip-label": {
                  px: 0.75,
                  fontSize: 11,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                },
              }}
            />
          )}
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
          {item.leias.length} LEIA{item.leias.length === 1 ? "" : "s"}
          {modes ? ` · ${modes}` : ""}
        </Typography>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "flex-end",
          gap: 0.5,
          flexShrink: 0,
        }}
      >
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

const ExperimentDetail: React.FC<{
  item: Experiment;
  onOpen: () => void;
  showUser: boolean;
}> = ({ item, onOpen, showUser }) => {
  const modes = [
    ...new Set(item.leias.map((l) => l.configuration.mode)),
  ].join(", ");
  const userLabel = getExperimentUserLabel(item);
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
            borderColor: item.isPublished ? "success.main" : "divider",
            color: item.isPublished ? "success.main" : "text.secondary",
            borderRadius: "999px",
            fontSize: 11,
            fontWeight: 500,
            bgcolor: item.isPublished
              ? "rgba(22,163,74,0.06)"
              : "transparent",
          }}
        >
          <StatusDot color={item.isPublished ? "success" : "neutral"} />
          {item.isPublished ? "Published" : "Unpublished"}
        </Box>
      </Box>

      <Box sx={{ mt: 4 }}>
        {showUser && userLabel && <DetailRow label="User">{userLabel}</DetailRow>}
        <DetailRow label="# LEIAs">{item.leias.length}</DetailRow>
        <DetailRow label="Modes">{modes || "—"}</DetailRow>
        <DetailRow label="Last updated">
          {formatTimeAgo(item.updatedAt)}
        </DetailRow>
        <DetailRow label="Created">
          {new Date(item.createdAt).toLocaleString()}
        </DetailRow>
      </Box>

      <Stack direction="column" gap={0.75} sx={{ mt: 4 }} alignItems="flex-start">
        <Button
          variant="contained"
          startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          onClick={onOpen}
        >
          Create Replication from this Experiment
        </Button>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          opens the experiment preview to confirm and create
        </Typography>
      </Stack>
    </Box>
  );
};

export const Experiments: React.FC = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>({});
  const [sort, setSort] = useState<SortState>({ by: "updated", dir: "desc" });

  const sortOptions: SortOption[] = useMemo(
    () => [
      { id: "name", label: "Name" },
      { id: "updated", label: "Last updated" },
      { id: "created", label: "Created" },
      { id: "leias", label: "# LEIAs" },
      { id: "status", label: "Status" },
    ],
    []
  );

  // Build mode options from the actual experiments so the dropdown
  // only ever lists modes that exist in the data.
  const filterGroups: FilterGroup[] = useMemo(() => {
    const modeSet = new Set<string>();
    for (const exp of experiments) {
      for (const leia of exp.leias) {
        if (leia.configuration?.mode) modeSet.add(leia.configuration.mode);
      }
    }
    const modeOptions = [...modeSet].sort().map((m) => ({
      value: m,
      label: m,
    }));
    const groups: FilterGroup[] = [
      {
        id: "published",
        label: "Status",
        options: [
          { value: "published", label: "Published" },
          { value: "unpublished", label: "Unpublished" },
        ],
      },
    ];
    if (modeOptions.length > 0) {
      groups.push({ id: "modes", label: "Modes", options: modeOptions });
    }
    return groups;
  }, [experiments]);

  useEffect(() => {
    const fetchExperiments = async () => {
      try {
        const response = await axios.get<Experiment[]>(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/manager/experiments`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setExperiments(response.data);
        if (response.data.length > 0) {
          setSelectedId(response.data[0].id);
        }
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          setTimeout(() => navigate("/login"), 2000);
        } else {
          console.error("Failed to load experiments:", error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchExperiments();
  }, [navigate, token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const publishedFilter = filters.published ?? [];
    const modesFilter = filters.modes ?? [];
    const matched = experiments.filter((e) => {
      const experimentUser = isAdmin
        ? getExperimentUserLabel(e).toLowerCase()
        : "";
      if (
        q &&
        !e.name.toLowerCase().includes(q) &&
        !experimentUser.includes(q)
      ) {
        return false;
      }
      if (publishedFilter.length > 0) {
        const wantsPub = publishedFilter.includes("published");
        const wantsUnpub = publishedFilter.includes("unpublished");
        if (!((e.isPublished && wantsPub) || (!e.isPublished && wantsUnpub))) {
          return false;
        }
      }
      if (modesFilter.length > 0) {
        const expModes = new Set(e.leias.map((l) => l.configuration?.mode));
        const intersects = modesFilter.some((m) => expModes.has(m));
        if (!intersects) return false;
      }
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...matched].sort((a, b) => {
      switch (sort.by) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "created":
          return (
            (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
          );
        case "leias":
          return (a.leias.length - b.leias.length) * dir;
        case "status":
          return ((a.isPublished ? 1 : 0) - (b.isPublished ? 1 : 0)) * dir;
        case "updated":
        default:
          return (
            (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * dir
          );
      }
    });
  }, [experiments, search, filters, sort, isAdmin]);

  const selected = useMemo(
    () => filtered.find((e) => e.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  return (
    <AdminLayout title={isAdmin ? "All the experiments" : "My experiments"} flush>
      <MasterDetailLayout
        storageKey="adminMD:experiments.width"
        searchPlaceholder="Search experiments..."
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
          experiments.length === 0
            ? "No experiments yet."
            : "No experiments match your search."
        }
        list={
          loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <ExperimentRowSkeleton key={i} />
              ))
            : filtered.map((exp) => (
                <ExperimentRow
                  key={exp.id}
                  item={exp}
                  selected={exp.id === selectedId}
                  onClick={() => setSelectedId(exp.id)}
                  showUser={isAdmin}
                />
              ))
        }
        detail={
          loading ? (
            <ExperimentDetailSkeleton />
          ) : selected ? (
            <ExperimentDetail
              item={selected}
              onOpen={() => navigate(`/experiments/${selected.id}`)}
              showUser={isAdmin}
            />
          ) : (
            <MasterDetailEmptyState
              icon={<ScienceOutlinedIcon sx={{ fontSize: 32 }} />}
              message="Pick an experiment on the left to create a new replication from it"
            />
          )
        }
      />
    </AdminLayout>
  );
};

const ExperimentRowSkeleton: React.FC = () => (
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
      <Skeleton variant="text" width="55%" height={18} />
      <Skeleton
        variant="text"
        width="70%"
        height={14}
        sx={{ mt: 0.5 }}
      />
    </Box>
    <Skeleton variant="text" width={50} height={14} />
  </Box>
);

const ExperimentDetailSkeleton: React.FC = () => (
  <Box sx={{ p: 4, maxWidth: 880 }}>
    <Skeleton variant="text" width={260} height={32} />
    <Skeleton
      variant="rounded"
      width={92}
      height={22}
      sx={{ mt: 1, borderRadius: 999 }}
    />
    <Box sx={{ mt: 4 }}>
      {Array.from({ length: 4 }).map((_, i) => (
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
    <Box sx={{ mt: 4 }}>
      <Skeleton variant="rounded" width={88} height={32} />
    </Box>
  </Box>
);
