import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import axios, { AxiosRequestConfig } from "axios";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, Stack, Typography } from "@mui/material";
import { readReplicationName } from "../lib/replicationNames";
import { ToastContainer, toast } from "react-toastify";

import AdminLayout from "../components/admin/AdminLayout";
import { useAuth } from "../context/useAuth";
import { useApiKeys } from "../hooks/useApiKeys";
import { useProviders } from "../hooks/useProviders";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import { UnsavedChangesModal } from "../components/UnsavedChangesModal";
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

// Pull the most descriptive message available out of an axios error so the
// toast surfaces the backend's validation/error text when present.
const getErrorMessage = (err: unknown, fallbackMessage: string): string => {
  if (axios.isAxiosError(err) && err.response?.data) {
    const data = err.response.data as { message?: string; error?: string };
    return data.message || data.error || fallbackMessage;
  }
  return fallbackMessage;
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
  const { token, user } = useAuth();
  // Replications can be administered by admins and advanced users alike.
  const isAuthorised = user?.role === "admin" || user?.role === "advanced";
  const [replication, setReplication] = useState<ReplicationData | null>(null);
  const [localReplication, setLocalReplication] =
    useState<ReplicationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [replicationToken, setReplicationToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [copiedStudentLink, setCopiedStudentLink] = useState(false);
  const [copiedDemoLink, setCopiedDemoLink] = useState(false);
  const [startingSessionLeiaId, setStartingSessionLeiaId] = useState<
    string | null
  >(null);
  const [isMissingProviderModalOpen, setIsMissingProviderModalOpen] =
    useState(false);

  // BYOK: API keys + provider/model catalogue.
  const { apiKeys, getDefaultKey } = useApiKeys();
  const { apiKeyProvidersMapped, isLoading: isProvidersLoading } =
    useProviders();
  const defaultKey = getDefaultKey();

  // Flattened list of every model the available API keys can serve.
  const availableModels = useMemo(
    () => Object.values(apiKeyProvidersMapped).flat(),
    [apiKeyProvidersMapped]
  );
  const hasProviderData = availableModels.length > 0;

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

  const isModelAvailable = useCallback(
    (model: string) =>
      model === DEFAULT_PROVIDER || availableModels.includes(model),
    [availableModels]
  );

  const unavailableLeiaProviders: Array<{
    leiaName: string;
    provider: string;
  }> =
    !localReplication || isProvidersLoading || !hasProviderData
      ? []
      : localReplication.experiment.leias
          .map((leia) => {
            const currentValue = leia.runnerConfiguration.modelName ?? "";
            return {
              leiaName: leia.leia.metadata?.name || "Unknown Leia",
              provider: currentValue,
              isValid: currentValue === "" || isModelAvailable(currentValue),
            };
          })
          .filter((item) => !item.isValid)
          .map(({ leiaName, provider }) => ({ leiaName, provider }));

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
      if (token) {
        headers.Authorization = `Bearer ${token}`;
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
    [token, replicationToken]
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
        // Seed each LEIA that has no API key yet with the user's default key.
        const clonedData = structuredClone(resp.data);
        if (defaultKey) {
          clonedData.experiment.leias.forEach((leia) => {
            if (!leia.runnerConfiguration.apiKeyId) {
              leia.runnerConfiguration.apiKeyId = defaultKey.id;
            }
          });
        }
        setLocalReplication(clonedData);
        if (id && resp.data?.name) writeReplicationName(id, resp.data.name);
      } catch (err: unknown) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          if (replicationToken) {
            toast.error("Invalid or expired replication token", {
              position: "bottom-right",
              autoClose: 5000,
            });
          } else {
            toast.error("No tienes permisos para acceder a esta réplica.");
            navigate("/login");
          }
        } else {
          console.error("Load error:", err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchReplication();
  }, [
    id,
    navigate,
    replicationToken,
    tokenReady,
    buildRequestConfig,
    defaultKey,
  ]);

  useEffect(() => {
    if (isProvidersLoading || !hasProviderData) {
      setIsMissingProviderModalOpen(false);
      return;
    }
    setIsMissingProviderModalOpen(unavailableLeiaProviders.length > 0);
  }, [isProvidersLoading, hasProviderData, unavailableLeiaProviders.length]);

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
      toast.error(getErrorMessage(err, "Error renaming replication"), {
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
      toast.error(getErrorMessage(err, "Error updating replication duration"), {
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
      toast.error(getErrorMessage(err, "Error removing replication duration"), {
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
      toast.error(getErrorMessage(err, "Error updating replication form"), {
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
      toast.error(getErrorMessage(err, "Error deleting replication form"), {
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
      toast.error(getErrorMessage(err, "Error regenerating code"), {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Regenerate error:", err);
    }
  };

  const regenerateShareToken = async () => {
    if (!isAuthorised) return;
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
      toast.error(getErrorMessage(err, "Error regenerating share token"), {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Regenerate share token error:", err);
    }
  };

  // --- UNSAVED CHANGES LOGIC ---
  // Compute which LEIAs differ from their saved counterpart so actions like
  // activating or starting a test session can prompt to save first.
  const getUnsavedLeias = useCallback(() => {
    if (!replication || !localReplication) return [];
    const unsaved: number[] = [];
    localReplication.experiment.leias.forEach((localLeia, idx) => {
      const savedLeia = replication.experiment.leias[idx];
      if (JSON.stringify(localLeia) !== JSON.stringify(savedLeia)) {
        unsaved.push(idx);
      }
    });
    return unsaved;
  }, [replication, localReplication]);

  const executeToggleActive = async () => {
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
      toast.error(getErrorMessage(err, "Error toggling active state"), {
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
      toast.error(getErrorMessage(err, "Error toggling repeatable state"), {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Update error:", err);
    }
  };

  const toggleShared = async () => {
    if (!replication || !isAuthorised) return;
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
      toast.error(getErrorMessage(err, "Error toggling shared access"), {
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
      toast.error(getErrorMessage(err, "Error toggling ask solution state"), {
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
      toast.error(
        getErrorMessage(err, "Error toggling evaluate solution state"),
        {
          position: "bottom-right",
          autoClose: 5000,
        }
      );
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

  // Returns true on success so the unsaved-changes flow can decide whether to
  // continue with a pending action (toggle active / start test session).
  const handleLeiaUpdate = async (idx: number): Promise<boolean> => {
    if (!replication || !localReplication) return false;
    const replicationId = replication.id;
    const localLeiaId = localReplication.experiment.leias[idx].id;
    const localLeiaRunnerConfiguration =
      localReplication.experiment.leias[idx].runnerConfiguration;
    const modelName = localLeiaRunnerConfiguration.modelName;

    if (!modelName) {
      toast.error("Please select a valid model.", {
        position: "bottom-right",
        autoClose: 5000,
      });
      return false;
    }

    // Send `modelName` (BYOK) and drop the legacy/derived fields the backend
    // no longer accepts on this endpoint.
    const payload = {
      ...localLeiaRunnerConfiguration,
      modelName,
    };
    if ("provider" in payload) {
      delete (payload as Partial<typeof payload> & { provider?: string })
        .provider;
    }
    if ("apiKeyRequesterId" in payload) {
      delete (
        payload as Partial<typeof payload> & { apiKeyRequesterId?: string }
      ).apiKeyRequesterId;
    }

    try {
      const resp = await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${replicationId}/leia/${localLeiaId}/runner-configuration`,
        payload,
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      toast.success("Leia configuration updated successfully", {
        position: "bottom-right",
        autoClose: 5000,
      });
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, "Error updating leia configuration"), {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Update error:", err);
      return false;
    }
  };

  // Wire up the unsaved-changes guard with the dirty-detection + save logic.
  const {
    isModalOpen,
    withUnsavedChangesCheck,
    handleConfirmSaveAndProceed,
    handleProceedWithoutSaving,
    handleCancelUnsavedModal,
  } = useUnsavedChanges(getUnsavedLeias, handleLeiaUpdate);

  const toggleActive = async () => {
    withUnsavedChangesCheck(executeToggleActive);
  };

  const executeStartTestSession = async (
    leiaId: string,
    replicationId: string
  ) => {
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
      toast.error(getErrorMessage(err, "Error starting test session"), {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Start test session error:", err);
    } finally {
      setStartingSessionLeiaId(null);
    }
  };

  const startTestSession = (
    leiaId: string,
    replicationId: string,
    idx: number
  ) => {
    withUnsavedChangesCheck(
      () => executeStartTestSession(leiaId, replicationId),
      idx
    );
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
            hasFetchedAvailableModels={hasProviderData}
            apiKeys={apiKeys}
            apiKeyProvidersMapped={apiKeyProvidersMapped}
            userRole={user?.role}
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
            isAdmin={isAuthorised}
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

      <UnsavedChangesModal
        isOpen={isModalOpen}
        onCancel={handleCancelUnsavedModal}
        onProceedWithoutSaving={handleProceedWithoutSaving}
        onConfirmSaveAndProceed={handleConfirmSaveAndProceed}
      />

      <Dialog
        open={isMissingProviderModalOpen && unavailableLeiaProviders.length > 0}
        onClose={() => setIsMissingProviderModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: "error.main" }}>
          Model not available
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Some LEIAs have a model configured that is no longer in the list of
            available models.
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
            Change the model to one that is available and save the
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
