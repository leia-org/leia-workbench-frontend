import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import axios, { AxiosRequestConfig } from "axios";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, Stack, Typography } from "@mui/material";
import { readReplicationName } from "../lib/replicationNames";
import { ToastContainer, toast } from "react-toastify";

import AdminLayout from "../components/admin/AdminLayout";
import { ReplicationSubSidebar, type SectionId } from "./replication/ReplicationSubSidebar";
import { GeneralSection } from "./replication/sections/GeneralSection";
import { LeiasSection } from "./replication/sections/LeiasSection";
import { SettingsSection } from "./replication/sections/SettingsSection";
import { ConversationsPlaceholder } from "./replication/sections/ConversationsPlaceholder";
import { LivePlaceholder } from "./replication/sections/LivePlaceholder";
import type { ReplicationData } from "./replication/types";
import { writeReplicationName } from "../lib/replicationNames";

const REPLICATION_TOKENS_KEY = "replicationTokens";
const DEFAULT_PROVIDER = "default";

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

const buildWorkbenchLink = (code: string, email?: string) => {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("code", code);
  if (email) {
    url.searchParams.set("email", email);
  }
  return url.toString();
};

export const Replication: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [replication, setReplication] = useState<ReplicationData | null>(null);
  const [localReplication, setLocalReplication] =
    useState<ReplicationData | null>(null);
  const [loading, setLoading] = useState(true);
  const adminSecret = localStorage.getItem("adminSecret");
  const isAdmin = Boolean(adminSecret);
  const [copied, setCopied] = useState<boolean>(false);
  const [replicationToken, setReplicationToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [copiedStudentLink, setCopiedStudentLink] = useState(false);
  const [copiedDemoLink, setCopiedDemoLink] = useState(false);
  const [startingSessionLeiaId, setStartingSessionLeiaId] = useState<
    string | null
  >(null);
  const [availableModels, setAvailableModels] = useState<Array<string>>([]);
  const [hasFetchedAvailableModels, setHasFetchedAvailableModels] =
    useState(false);
  const [isMissingProviderModalOpen, setIsMissingProviderModalOpen] =
    useState(false);

  // Section + active LEIA driven by URL query so things deep-link.
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const sectionFromQuery = (searchParams.get("section") || "general") as SectionId;
  const leiaFromQuery = searchParams.get("leia");

  const setSection = useCallback(
    (section: SectionId, leiaId?: string | null) => {
      const params = new URLSearchParams(location.search);
      params.set("section", section);
      if (leiaId !== undefined) {
        if (leiaId) params.set("leia", leiaId);
        else params.delete("leia");
      }
      navigate(
        { pathname: location.pathname, search: params.toString() },
        { replace: true }
      );
    },
    [navigate, location.pathname, location.search]
  );

  const isProviderValid = useCallback(
    (provider: string) =>
      provider === DEFAULT_PROVIDER || availableModels.includes(provider),
    [availableModels]
  );

  const unavailableLeiaProviders: Array<{
    leiaName: string;
    provider: string;
  }> =
    !localReplication || !hasFetchedAvailableModels
      ? []
      : localReplication.experiment.leias
          .filter(
            (leia) =>
              leia.runnerConfiguration.provider &&
              !isProviderValid(leia.runnerConfiguration.provider)
          )
          .map((leia) => ({
            leiaName: leia.leia.metadata?.name || "Unknown Leia",
            provider: leia.runnerConfiguration.provider,
          }));

  useEffect(() => {
    if (!id) return;
    setTokenReady(false);
    const tokens = readStoredReplicationTokens();
    const params = new URLSearchParams(location.search);
    const tokenFromQuery = params.get("token");

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
      if (adminSecret) {
        headers.Authorization = `Bearer ${adminSecret}`;
      }
      const params = { ...(config.params || {}) };
      if (replicationToken) {
        params.token = replicationToken;
      }
      const finalConfig: AxiosRequestConfig = { ...config };
      if (Object.keys(headers).length > 0) {
        finalConfig.headers = headers;
      }
      if (Object.keys(params).length > 0) {
        finalConfig.params = params;
      }
      return finalConfig;
    },
    [adminSecret, replicationToken]
  );

  useEffect(() => {
    if (!tokenReady || !id) return;
    const fetchReplication = async () => {
      try {
        const resp = await axios.get<ReplicationData>(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}`,
          buildRequestConfig()
        );
        setReplication(resp.data);
        setLocalReplication(structuredClone(resp.data));
        if (id && resp.data?.name) writeReplicationName(id, resp.data.name);
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          if (replicationToken) {
            toast.error("Invalid or expired replication token", {
              position: "bottom-right",
              autoClose: 5000,
            });
          } else {
            setTimeout(() => navigate("/login"), 2000);
          }
        } else {
          console.error("Load error:", err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchReplication();
  }, [id, navigate, replicationToken, tokenReady, buildRequestConfig]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const resp = await axios.get<{ models: string[] }>(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/runner/models`,
          buildRequestConfig()
        );
        setAvailableModels(
          Array.isArray(resp.data?.models) ? resp.data.models : []
        );
        setHasFetchedAvailableModels(true);
      } catch (err) {
        console.error("Error fetching available models:", err);
        setAvailableModels([]);
        setHasFetchedAvailableModels(false);
      }
    };
    fetchModels();
  }, [buildRequestConfig]);

  useEffect(() => {
    if (!hasFetchedAvailableModels) {
      setIsMissingProviderModalOpen(false);
      return;
    }
    const hasUnavailableProvider = Boolean(
      localReplication?.experiment.leias.some(
        (leia) =>
          leia.runnerConfiguration.provider &&
          !isProviderValid(leia.runnerConfiguration.provider)
      )
    );
    setIsMissingProviderModalOpen(hasUnavailableProvider);
  }, [hasFetchedAvailableModels, localReplication, isProviderValid]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(replication?.code || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 4000);
  };

  const handleCopyShareLink = () => {
    if (!replication?.shareToken || !id) return;
    const origin = window.location?.origin ?? "";
    const link = `${origin}/replications/${id}?token=${replication.shareToken}`;
    navigator.clipboard.writeText(link);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 4000);
  };

  const handleCopyStudentLink = () => {
    if (!replication?.code) return;
    navigator.clipboard.writeText(buildWorkbenchLink(replication.code));
    setCopiedStudentLink(true);
    setTimeout(() => setCopiedStudentLink(false), 4000);
  };

  const handleCopyDemoLink = () => {
    if (!replication?.code) return;
    navigator.clipboard.writeText(
      buildWorkbenchLink(replication.code, "_test_demo")
    );
    setCopiedDemoLink(true);
    setTimeout(() => setCopiedDemoLink(false), 4000);
  };

  const handleRename = async (newName: string) => {
    if (!replication || !newName) return;
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/name`,
        { name: newName },
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      toast.success("Replication renamed successfully", {
        position: "bottom-right",
        autoClose: 5000,
      });
    } catch (err) {
      toast.error("Error renaming replication", {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Rename error:", err);
    }
  };

  const handleChangeDuration = async (newDuration: number) => {
    if (!replication) return;
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/duration`,
        { duration: newDuration },
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      toast.success("Replication duration updated successfully", {
        position: "bottom-right",
        autoClose: 5000,
      });
    } catch (err) {
      toast.error("Error updating replication duration", {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Update error:", err);
    }
  };

  const handleDeleteDuration = async () => {
    if (!replication) return;
    try {
      const resp = await axios.delete(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/duration`,
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      toast.success("Replication duration removed successfully", {
        position: "bottom-right",
        autoClose: 5000,
      });
    } catch (err) {
      toast.error("Error removing replication duration", {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Delete error:", err);
    }
  };

  const handleChangeForm = async (newForm: string) => {
    if (!replication || !newForm) return;
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/form`,
        { form: newForm },
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      toast.success("Replication form updated successfully", {
        position: "bottom-right",
        autoClose: 5000,
      });
    } catch (err) {
      toast.error("Error updating replication form", {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Update error:", err);
    }
  };

  const handleDeleteForm = async () => {
    if (!replication) return;
    try {
      const resp = await axios.delete(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/form`,
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      toast.success("Replication form deleted successfully", {
        position: "bottom-right",
        autoClose: 5000,
      });
    } catch (err) {
      toast.error("Error deleting replication form", {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Delete error:", err);
    }
  };

  const regenerateCode = async () => {
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/regenerate-code`,
        {},
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      toast.success("Code regenerated successfully", {
        position: "bottom-right",
        autoClose: 5000,
      });
    } catch (err) {
      toast.error("Error regenerating code", {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Regenerate error:", err);
    }
  };

  const regenerateShareToken = async () => {
    if (!isAdmin) return;
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/regenerate-share-token`,
        {},
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      toast.success("Share token regenerated successfully", {
        position: "bottom-right",
        autoClose: 5000,
      });
    } catch (err) {
      toast.error("Error regenerating share token", {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Regenerate share token error:", err);
    }
  };

  const toggleActive = async () => {
    if (!replication) return;
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/toggle-active`,
        {},
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      toast.success(
        replication.isActive
          ? "Replication is now inactive"
          : "Replication is now active",
        { position: "bottom-right", autoClose: 5000 }
      );
    } catch (err) {
      toast.error("Error toggling active state", {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Update error:", err);
    }
  };

  const toggleRepeatable = async () => {
    if (!replication) return;
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/toggle-repeatable`,
        {},
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      toast.success(
        replication.isRepeatable
          ? "Replication is now non-repeatable"
          : "Replication is now repeatable",
        { position: "bottom-right", autoClose: 5000 }
      );
    } catch (err) {
      toast.error("Error toggling repeatable state", {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Update error:", err);
    }
  };

  const toggleShared = async () => {
    if (!replication || !isAdmin) return;
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/toggle-shared`,
        {},
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      toast.success(
        resp.data.isShared
          ? "Replication sharing enabled"
          : "Replication sharing disabled",
        { position: "bottom-right", autoClose: 5000 }
      );
    } catch (err) {
      toast.error("Error toggling shared access", {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Update error:", err);
    }
  };

  const toggleAskSolution = async (idx: number) => {
    if (!replication) return;
    const leiaId = replication.experiment.leias[idx].id;
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/leia/${leiaId}/toggle-ask-solution`,
        {},
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      toast.success("Leia configuration updated", {
        position: "bottom-right",
        autoClose: 5000,
      });
    } catch (err) {
      toast.error("Error toggling ask solution state", {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Update error:", err);
    }
  };

  const toggleEvaluateSolution = async (idx: number) => {
    if (!replication) return;
    const leiaId = replication.experiment.leias[idx].id;
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/leia/${leiaId}/toggle-evaluate-solution`,
        {},
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      toast.success("Leia configuration updated", {
        position: "bottom-right",
        autoClose: 5000,
      });
    } catch (err) {
      toast.error("Error toggling evaluate solution state", {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Update error:", err);
    }
  };

  const handleLocalLeiaChange = (idx: number, key: string, value: unknown) => {
    setLocalReplication((prev) => {
      if (!prev) return prev;
      const copy = structuredClone(prev) as ReplicationData & {
        // Loose any access for nested set-by-path.
        experiment: { leias: any[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
      };
      const keys = key.split(".");
      let property: any = copy.experiment.leias[idx]; // eslint-disable-line @typescript-eslint/no-explicit-any
      for (let i = 0; i < keys.length - 1; i++) {
        if (property[keys[i]] === undefined) {
          property[keys[i]] = {};
        }
        property = property[keys[i]];
      }
      const lastKey = keys.at(-1);
      if (lastKey) {
        property[lastKey] = value;
      }
      return copy;
    });
  };

  const handleLocalLeiaReset = (idx: number) => {
    if (localReplication && replication) {
      const localReplicationCopy = structuredClone(localReplication);
      localReplicationCopy.experiment.leias[idx] =
        replication.experiment.leias[idx];
      setLocalReplication(localReplicationCopy);
    }
  };

  const handleLeiaUpdate = async (idx: number) => {
    if (!replication || !localReplication) return;
    const replicationId = replication.id;
    const localLeiaId = localReplication.experiment.leias[idx].id;
    const localLeiaRunnerConfiguration =
      localReplication.experiment.leias[idx].runnerConfiguration;
    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${replicationId}/leia/${localLeiaId}/runner-configuration`,
        localLeiaRunnerConfiguration,
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      toast.success("Leia configuration updated successfully", {
        position: "bottom-right",
        autoClose: 5000,
      });
    } catch (err) {
      toast.error("Error updating leia configuration", {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Update error:", err);
    }
  };

  const startTestSession = async (leiaId: string, replicationId: string) => {
    if (loading || startingSessionLeiaId || !leiaId || !replicationId) return;
    setStartingSessionLeiaId(leiaId);
    try {
      const resp = await axios.post(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/test`,
        { leiaId, replicationId },
        buildRequestConfig()
      );
      const sessionId = resp.data.sessionId;
      navigate(`/chat/${sessionId}`);
    } catch (err) {
      toast.error("Error starting test session", {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Start test session error:", err);
    } finally {
      setStartingSessionLeiaId(null);
    }
  };

  if (loading || !replication || !localReplication) {
    // Use the cached name (if any) so share-token visitors see the
    // breadcrumb populated immediately instead of "Loading...".
    const cachedName = id ? readReplicationName(id) : null;
    return (
      <AdminLayout
        breadcrumbs={
          cachedName
            ? [
                { label: "Replications", to: "/administration" },
                { label: cachedName },
              ]
            : undefined
        }
        title={cachedName ? undefined : "Loading…"}
        flush
      >
        <ReplicationDetailSkeleton />
      </AdminLayout>
    );
  }

  const studentLink = buildWorkbenchLink(replication.code);
  const demoLink = buildWorkbenchLink(replication.code, "_test_demo");

  const breadcrumbs = [
    { label: "Replications", to: "/administration" },
    { label: replication.name },
  ];

  const renderSection = () => {
    switch (sectionFromQuery) {
      case "leias":
        return (
          <LeiasSection
            replication={replication}
            localReplication={localReplication}
            activeLeiaId={leiaFromQuery}
            onLeiaSelect={(leiaId) => setSection("leias", leiaId)}
            availableModels={availableModels}
            hasFetchedAvailableModels={hasFetchedAvailableModels}
            onLocalLeiaChange={handleLocalLeiaChange}
            onLocalLeiaReset={handleLocalLeiaReset}
            onLeiaUpdate={handleLeiaUpdate}
            onToggleAskSolution={toggleAskSolution}
            onToggleEvaluateSolution={toggleEvaluateSolution}
            onStartTestSession={startTestSession}
            startingSessionLeiaId={startingSessionLeiaId}
          />
        );
      case "settings":
        return (
          <SettingsSection
            replication={replication}
            onChangeForm={handleChangeForm}
            onDeleteForm={handleDeleteForm}
          />
        );
      case "conversations":
        return <ConversationsPlaceholder replicationId={replication.id} />;
      case "live":
        return <LivePlaceholder replicationId={replication.id} />;
      case "general":
      default:
        return (
          <GeneralSection
            replication={replication}
            isAdmin={isAdmin}
            onRename={handleRename}
            onChangeDuration={handleChangeDuration}
            onDeleteDuration={handleDeleteDuration}
            onRegenerateCode={regenerateCode}
            onToggleActive={toggleActive}
            onToggleRepeatable={toggleRepeatable}
            onToggleShared={toggleShared}
            onRegenerateShareToken={regenerateShareToken}
            onCopyCode={handleCopyCode}
            onCopyShareLink={handleCopyShareLink}
            onCopyStudentLink={handleCopyStudentLink}
            onCopyDemoLink={handleCopyDemoLink}
            copied={copied}
            copiedShareLink={copiedShareLink}
            copiedStudentLink={copiedStudentLink}
            copiedDemoLink={copiedDemoLink}
            studentLink={studentLink}
            demoLink={demoLink}
          />
        );
    }
  };

  return (
    <AdminLayout breadcrumbs={breadcrumbs} flush>
      <ToastContainer />
      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        <ReplicationSubSidebar
          activeSection={sectionFromQuery}
          onSectionChange={(section) => {
            if (section === "leias" && !leiaFromQuery) {
              const firstLeia = localReplication.experiment.leias[0]?.id;
              setSection("leias", firstLeia);
            } else {
              setSection(section);
            }
          }}
          leias={localReplication.experiment.leias.map((l) => ({
            id: l.id,
            name: l.leia.metadata.name,
          }))}
          activeLeiaId={leiaFromQuery}
          onLeiaSelect={(leiaId) => setSection("leias", leiaId)}
        />
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            p: 4,
            minHeight: 0,
          }}
        >
          {renderSection()}
        </Box>
      </Box>

      <Dialog
        open={isMissingProviderModalOpen && unavailableLeiaProviders.length > 0}
        onClose={() => setIsMissingProviderModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: "error.main" }}>
          Provider not available
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Some LEIAs have a provider configured that is no longer in the list
            of available models.
          </Typography>
          <Box
            sx={{
              border: "1px solid",
              borderColor: "error.main",
              bgcolor: "rgba(220, 38, 38, 0.04)",
              p: 1.5,
              borderRadius: 1,
              maxHeight: 224,
              overflow: "auto",
            }}
          >
            {unavailableLeiaProviders.map((item) => (
              <Typography
                key={`${item.leiaName}-${item.provider}`}
                variant="body2"
                sx={{ color: "error.main" }}
              >
                <strong>{item.leiaName}:</strong> {item.provider}
              </Typography>
            ))}
          </Box>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 2 }}>
            Change the provider to one that is available and save the
            configuration.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => setIsMissingProviderModalOpen(false)}
          >
            Understood
          </Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
};

// Skeleton that mimics the live layout while the replication is
// loading. Renders inside `AdminLayout`, so the sidebar + page header
// are already drawn — this only paints the inner sub-sidebar + section
// content.
const ReplicationDetailSkeleton: React.FC = () => (
  <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
    {/* Sub-sidebar skeleton */}
    <Box
      sx={{
        width: 240,
        flexShrink: 0,
        borderRight: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        p: 2,
      }}
    >
      <Skeleton variant="text" width="60%" height={18} sx={{ mb: 1.5 }} />
      <Stack gap={0.75}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Stack key={i} direction="row" alignItems="center" gap={1}>
            <Skeleton variant="rounded" width={18} height={18} />
            <Skeleton variant="text" width={`${50 + (i % 3) * 18}%`} height={16} />
          </Stack>
        ))}
      </Stack>
    </Box>

    {/* Section content skeleton — mimics the form-like General view */}
    <Box sx={{ flex: 1, overflowY: "auto", p: 4 }}>
      <Box sx={{ maxWidth: 880 }}>
        <Skeleton variant="text" width={160} height={28} sx={{ mb: 0.5 }} />
        <Skeleton variant="text" width={320} height={16} sx={{ mb: 4 }} />

        {Array.from({ length: 3 }).map((_, blockIdx) => (
          <Box key={blockIdx} sx={{ mb: 4 }}>
            <Skeleton variant="text" width={90} height={14} sx={{ mb: 1.5 }} />
            {Array.from({ length: 3 }).map((__, rowIdx) => (
              <Box
                key={rowIdx}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "180px 1fr",
                  alignItems: "center",
                  py: 1.5,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  gap: 2,
                }}
              >
                <Skeleton variant="text" width="70%" height={16} />
                <Skeleton variant="text" width={`${30 + (rowIdx * 18) % 50}%`} height={20} />
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  </Box>
);
