import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import axios, { AxiosRequestConfig } from "axios";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../context/useAuth";
import { WidgetsConfigPanel, type WidgetAssignment } from "./replication/WidgetsConfigPanel";
import Switch from "react-switch";
import { toast } from "react-toastify";
import SyntaxHighlighter from "react-syntax-highlighter";
import { docco } from "react-syntax-highlighter/dist/esm/styles/hljs";
import {
  PencilIcon,
  ClockIcon,
  CodeBracketIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
  EyeIcon,
  LockClosedIcon,
  InformationCircleIcon,
  LinkIcon,
  XMarkIcon,
  ClipboardDocumentCheckIcon,
  TrashIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  LightBulbIcon,
  ShareIcon,
  BeakerIcon,
  ChatBubbleBottomCenterIcon
} from "@heroicons/react/24/solid";
import { UnsavedChangesModal } from "../components/UnsavedChangesModal";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import { useApiKeys } from "../hooks/useApiKeys";
import { ApiKey } from "../models/ApiKeys";
import { useProviders } from "../hooks/useProviders";

interface Replication {
  id: string;
  name: string;
  isActive: boolean;
  duration: number | null;
  isRepeatable: boolean;
  isShared: boolean;
  shareToken?: string | null;
  code: string;
  createdAt: string;
  updatedAt: string;
  form: string | undefined | null;
  experiment: {
    name: string;
    leias: Array<{
      configuration: {
        mode: string;
        data?: any;
        askSolution: boolean;
        evaluateSolution: boolean;
      };
      leia: {
        id: any;
        metadata: { name: string };
        spec: any;
      };
      runnerConfiguration: {
        provider: string;
        modelName?: string;
        apiKeyId?: string | null;
        audioMode?: "realtime" | "luke" | null;
        hideAudioTranscription?: boolean | null;
        realtimeConfig?: {
          model?: string;
          voice?: string;
          instructions?: string;
          turnDetection?: {
            type?: "server_vad" | "none";
            threshold?: number;
            prefix_padding_ms?: number;
            silence_duration_ms?: number;
          };
        };
        lukeConfig?: {
          provider: string;
          voice: string;
          widgets?: Array<{
            widgetType: string;
            slot: "left" | "right" | "main";
          }>;
        };
      };
      sessionCount: number;
      id: string;
    }>;
  };
}

const VOICE_OPTIONS: Array<{
  value: string;
  label: string;
  gender: string;
}> = [
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
  all = false,
  selected: string
) => {
  if (!pronoun || all || (pronoun != "he" && pronoun != "she")) {
    return VOICE_OPTIONS;
  } else if (pronoun === "he") {
    return VOICE_OPTIONS.filter(
      (option) => option.gender === "male" || option.value === selected
    );
  } else if (pronoun === "she") {
    return VOICE_OPTIONS.filter(
      (option) => option.gender === "female" || option.value === selected
    );
  }
};

const getValidModels = (
  apiKeyId: string | null | undefined,
  apiKeys: ApiKey[],
  apiKeyProvidersMapped: Record<string, string[]>
): string[] => {
  const modelsParch = apiKeyProvidersMapped ? Object.values(apiKeyProvidersMapped).flat() : [];
  if (!apiKeyId) return modelsParch;

  const apiKey = apiKeys.find((k) => k.id === apiKeyId);
  if (!apiKey || !apiKey.provider) return modelsParch;

  return apiKeyProvidersMapped[apiKey.provider] || [];
};

const getValidApiKeys = (
  modelName: string | null | undefined,
  apiKeys: ApiKey[],
  apiKeyProvidersMapped: Record<string, string[]>
): ApiKey[] => {
  if (!modelName) return apiKeys;

  const validProviders = Object.entries(apiKeyProvidersMapped)
    .filter(([, models]) => models.includes(modelName))
    .map(([provider]) => provider);

  return apiKeys.filter((key) => validProviders.includes(key.provider));
};

const REPLICATION_TOKENS_KEY = "replicationTokens";
const DEFAULT_PROVIDER = "default";

const readStoredReplicationTokens = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(REPLICATION_TOKENS_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const getErrorMessage = (err: any, fallbackMessage: string) => {
  if (axios.isAxiosError(err) && err.response?.data) {
    return err.response.data.message || err.response.data.error || fallbackMessage;
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
  const isAuthorised = user?.role === "admin" || user?.role === "advanced";
  const [replication, setReplication] = useState<Replication | null>(null);
  const [localReplication, setLocalReplication] = useState<Replication | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const [copied, setCopied] = useState<boolean>(false);
  const [replicationToken, setReplicationToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [copiedStudentLink, setCopiedStudentLink] = useState(false);
  const [copiedDemoLink, setCopiedDemoLink] = useState(false);
  const [showAllVoices, setShowAllVoices] = useState<boolean>(false);
  const [startingSessionLeiaId, setStartingSessionLeiaId] = useState<
    string | null
  >(null);
  const [isMissingProviderModalOpen, setIsMissingProviderModalOpen] =
    useState(false);
  // Modals
  const [newName, setNewName] = useState<string>("");
  const [newDuration, setNewDuration] = useState<string>("");
  const [newForm, setNewForm] = useState<string>("");
  const [isNewNameModalOpen, setIsNewNameModalOpen] = useState<boolean>(false);
  const [isNewDurationModalOpen, setIsNewDurationModalOpen] =
    useState<boolean>(false);
  const [isNewFormModalOpen, setIsNewFormModalOpen] = useState<boolean>(false);
  // Side bar
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [sideBarData, setSideBarData] = useState<any>(null);
  const {apiKeys, getDefaultKey} = useApiKeys();
  const { apiKeyProvidersMapped, isLoading: isProvidersLoading } = useProviders();
  const defaultKey = getDefaultKey();
  const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);

  const availableModels = Object.values(apiKeyProvidersMapped).flat();
  const hasProviderData = availableModels.length > 0;

  const isModelAvailable = (model: string) => {
    return model === DEFAULT_PROVIDER || availableModels.includes(model);
  };

  const unavailableLeiaProviders: Array<{ leiaName: string; provider: string }> =
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
    if (!tokenReady || !id) {
      return;
    }
    const fetchReplication = async () => {
      try {
        const resp = await axios.get<Replication>(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}`,
          buildRequestConfig()
        );
        setReplication(resp.data);
        const clonedData = structuredClone(resp.data);
        if (defaultKey) {
          clonedData.experiment.leias.forEach((leia) => {
            if (!leia.runnerConfiguration.apiKeyId) {
              leia.runnerConfiguration.apiKeyId = defaultKey.id;
            }
          });
        }

        setLocalReplication(clonedData);
      } catch (err: any) {
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
    defaultKey
  ]);
  useEffect(() => {
    if (isProvidersLoading || !hasProviderData) {
      setIsMissingProviderModalOpen(false);
      return;
    }

    const hasUnavailableProvider = unavailableLeiaProviders.length > 0;

    setIsMissingProviderModalOpen(hasUnavailableProvider);
  }, [isProvidersLoading, hasProviderData, unavailableLeiaProviders.length]);


  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1)
      return `${interval} year${interval === 1 ? "" : "s"} ago`;

    interval = Math.floor(seconds / 2592000);
    if (interval >= 1)
      return `${interval} month${interval === 1 ? "" : "s"} ago`;

    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `${interval} day${interval === 1 ? "" : "s"} ago`;

    interval = Math.floor(seconds / 3600);
    if (interval >= 1)
      return `${interval} hour${interval === 1 ? "" : "s"} ago`;

    interval = Math.floor(seconds / 60);
    if (interval >= 1)
      return `${interval} minute${interval === 1 ? "" : "s"} ago`;

    if (seconds > 0) return `${seconds} second${seconds === 1 ? "" : "s"} ago`;

    return `Now`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(replication?.code || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 4000);
  };

  const handleCopyShareLink = () => {
    if (!replication?.shareToken || !id) return;
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";
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

  const handleRename = async () => {
    if (replication && newName.trim()) {
      try {
        const resp = await axios.patch(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/name`,
          { name: newName.trim() },
          buildRequestConfig()
        );
        setReplication(resp.data);
        setLocalReplication(structuredClone(resp.data));
        setNewName("");
        setIsNewNameModalOpen(false);
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
    }
  };

  const handleChangeDuration = async () => {
    if (
      replication &&
      !isNaN(Number(newDuration)) &&
      Number(newDuration) > 0 &&
      Number.isInteger(Number(newDuration))
    ) {
      try {
        const resp = await axios.patch(
          `${
            import.meta.env.VITE_APP_BACKEND
          }/api/v1/replications/${id}/duration`,
          { duration: Number(newDuration) },
          buildRequestConfig()
        );
        setReplication(resp.data);
        setLocalReplication(structuredClone(resp.data));
        setNewDuration("");
        setIsNewDurationModalOpen(false);
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
    }
  };

  const handleDeleteDuration = async () => {
    if (replication) {
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
    }
  };

  const handleChangeForm = async () => {
    if (replication && newForm.trim()) {
      try {
        const resp = await axios.patch(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/form`,
          { form: newForm.trim() },
          buildRequestConfig()
        );
        setReplication(resp.data);
        setLocalReplication(structuredClone(resp.data));
        setNewForm("");
        setIsNewFormModalOpen(false);
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
    }
  };

  const handleDeleteForm = async () => {
    if (replication) {
      try {
        const resp = await axios.delete(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/form`,
          buildRequestConfig()
        );
        setReplication(resp.data);
        setLocalReplication(structuredClone(resp.data));
        setNewForm("");
        setIsNewFormModalOpen(false);
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
    }
  };

  const regenerateCode = async () => {
    try {
      const resp = await axios.patch(
        `${
          import.meta.env.VITE_APP_BACKEND
        }/api/v1/replications/${id}/regenerate-code`,
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
        `${
          import.meta.env.VITE_APP_BACKEND
        }/api/v1/replications/${id}/regenerate-share-token`,
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
        `${
          import.meta.env.VITE_APP_BACKEND
        }/api/v1/replications/${id}/toggle-active`,
        {},
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      const message = replication.isActive
        ? "Replication is now inactive"
        : "Replication is now active";
      toast.success(message, {
        position: "bottom-right",
        autoClose: 5000,
      });
    } catch (err) {
      toast.error(getErrorMessage(err, "Error toggling active state"), {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Update error:", err);
    }
  };

  const toggleActive = () => withUnsavedChangesCheck(executeToggleActive);

  const toggleRepeatable = async () => {
    if (!replication) return;
    try {
      const resp = await axios.patch(
        `${
          import.meta.env.VITE_APP_BACKEND
        }/api/v1/replications/${id}/toggle-repeatable`,
        {},
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      const message = replication.isRepeatable
        ? "Replication is now non-repeatable"
        : "Replication is now repeatable";
      toast.success(message, {
        position: "bottom-right",
        autoClose: 5000,
      });
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
        `${
          import.meta.env.VITE_APP_BACKEND
        }/api/v1/replications/${id}/toggle-shared`,
        {},
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      const message = resp.data.isShared
        ? "Replication sharing enabled"
        : "Replication sharing disabled";
      toast.success(message, {
        position: "bottom-right",
        autoClose: 5000,
      });
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
        `${
          import.meta.env.VITE_APP_BACKEND
        }/api/v1/replications/${id}/leia/${leiaId}/toggle-ask-solution`,
        {},
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      const message = "Leia configuration updated";
      toast.success(message, {
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
        `${
          import.meta.env.VITE_APP_BACKEND
        }/api/v1/replications/${id}/leia/${leiaId}/toggle-evaluate-solution`,
        {},
        buildRequestConfig()
      );
      setReplication(resp.data);
      setLocalReplication(structuredClone(resp.data));
      const message = "Leia configuration updated";
      toast.success(message, {
        position: "bottom-right",
        autoClose: 5000,
      });
    } catch (err) {
      toast.error(getErrorMessage(err, "Error toggling evaluate solution state"), {
        position: "bottom-right",
        autoClose: 5000,
      });
      console.error("Update error:", err);
    }
  };

  const handleLocalLeiaChange = (idx: number, key: string, value: any) => {
    setLocalReplication((prev) => {
      if (!prev) return prev;
      const copy = structuredClone(prev) as any;
      const keys = key.split(".");
      let property = copy.experiment.leias[idx];
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

  // Modificado para devolver un booleano indicando el éxito
  const handleLeiaUpdate = async (idx: number): Promise<boolean> => {
    if (replication && localReplication) {
      const replicationId = replication.id;
      const localLeiaId = localReplication.experiment.leias[idx].id;
      const localLeiaRunnerConfiguration =
        localReplication.experiment.leias[idx].runnerConfiguration;
      const modelName =
        localLeiaRunnerConfiguration.modelName;

      if (!modelName) {
        toast.error("Please select a valid model.", {
          position: "bottom-right",
          autoClose: 5000,
        });
        return false;
      }
      const payload = {
        ...localLeiaRunnerConfiguration,
        modelName,
      };

      if ("provider" in payload) {
        delete (payload as Partial<typeof payload> & { provider?: string }).provider;
      }

      if ("apiKeyRequesterId" in payload) {
        delete (payload as Partial<typeof payload> & { apiKeyRequesterId?: string }).apiKeyRequesterId;
      }

      try {
        const resp = await axios.patch(
          `${
            import.meta.env.VITE_APP_BACKEND
          }/api/v1/replications/${replicationId}/leia/${localLeiaId}/runner-configuration`,
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
    }
    return false;
  };

  // Inicializamos nuestro hook pasándole las funciones que necesita para comprobar y guardar
  const {
    isModalOpen,
    withUnsavedChangesCheck,
    handleConfirmSaveAndProceed,
    handleProceedWithoutSaving,
    handleCancelUnsavedModal,
  } = useUnsavedChanges(getUnsavedLeias, handleLeiaUpdate);

  const executeStartTestSession = async (leiaId: string, replicationId: string) => {
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

  const startTestSession = (leiaId: string, replicationId: string, idx: number) => {
    withUnsavedChangesCheck(() => executeStartTestSession(leiaId, replicationId), idx);
  };

  if (loading || !replication || !localReplication) {
    return (
      <div className="min-h-screen">
        {isAuthorised && <Navbar />}
        <div className="py-20 text-center">Loading replication...</div>
      </div>
    );
  }
return (
    <div className="min-h-screen bg-gray-50">
      {isAuthorised && <Navbar />}
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-800 mr-2">
              {replication.name}
            </h1>
            {isAuthorised && (
              <button
                onClick={() => setIsNewNameModalOpen(true)}
                className="flex text-center items-center space-x-1 text-blue-600 hover:underline px-2"
              >
                <PencilIcon className="h-4 w-4" />
                <span className="text-sm">Rename</span>
              </button>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <Link
              to={`/replications/${id}/conversations`}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <DocumentTextIcon className="h-4 w-4" />
              View Conversations
            </Link>
            <label className="text-center flex items-center">
              <LockClosedIcon className="h-4 w-4 text-gray-600" />
              <span className="text-sm text-gray-700 mx-2">Active</span>
              <Switch
                checked={replication.isActive}
                onChange={toggleActive}
              ></Switch>
            </label>
            <label className="text-center flex items-center">
              <ArrowPathIcon className="h-4 w-4 text-gray-600" />
              <span className="text-sm text-gray-700 mx-2">Repeatable</span>
              <Switch
                checked={replication.isRepeatable}
                onChange={toggleRepeatable}
              ></Switch>
            </label>
            {isAuthorised && (
              <label className="text-center flex items-center">
                <ShareIcon className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-700 mx-2">Shared</span>
                <Switch
                  checked={replication.isShared}
                  onChange={toggleShared}
                ></Switch>
              </label>
            )}
          </div>
        </div>

        {isAuthorised && replication.isShared && replication.shareToken && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm text-purple-900 font-semibold">
                  Share token:{" "}
                  <span className="font-mono">{replication.shareToken}</span>
                </p>
                <p className="text-xs text-purple-700 mt-1">
                  Anyone with this link can manage the replication.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleCopyShareLink}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  <ClipboardDocumentCheckIcon className="h-4 w-4" />
                  {copiedShareLink ? "Copied Link" : "Copy Share Link"}
                </button>
                <button
                  onClick={regenerateShareToken}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-100 transition-colors text-sm"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Regenerate Token
                </button>
              </div>
            </div>
          </div>
        )}

        {/*Information*/}
        <h3 className="text-lg font-semibold">Replication information</h3>
        <div className="flex justify-between bg-white p-4 rounded-xl shadow mb-6 mt-2 items-center">
          <div className="text-sm text-gray-700 space-y-2">
            <div className="flex">
              <CalendarDaysIcon className="h-5 w-5 text-gray-600 mr-2" />
              <strong>Created:</strong>
              <p className="ml-2">
                {new Date(replication.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex">
              <PencilSquareIcon className="h-5 w-5 text-gray-600 mr-2" />
              <strong>Last updated:</strong>
              <p className="ml-2">{formatTimeAgo(replication.updatedAt)}</p>
            </div>
            <div className="flex">
              <InformationCircleIcon className="h-5 w-5 text-gray-600 mr-2" />
              <strong>Experiment:</strong>
              <p className="ml-2">{replication.experiment.name}</p>
            </div>
            <div className="space-y-3">
              {(() => {
                const studentLink = buildWorkbenchLink(replication.code);

                return (
                  <div>
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-5 w-5 text-gray-600" />
                      <strong>Student link:</strong>
                    </div>
                    <div
                      className="cursor-pointer pl-7"
                      onClick={handleCopyStudentLink}
                      title="Copy student link to clipboard"
                    >
                      <span className="text-sm font-semibold text-gray-500 hover:text-gray-700 break-all transition duration-200">
                        {studentLink}
                      </span>
                    </div>
                    {copiedStudentLink && (
                      <div className="pl-7 text-xs font-bold text-green-600 mt-1">
                        Copied!
                      </div>
                    )}
                  </div>
                );
              })()}

              {(() => {
                const demoLink = buildWorkbenchLink(replication.code, "_test_demo");

                return (
                  <div>
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-5 w-5 text-gray-600" />
                      <strong>Demo/Test link:</strong>
                    </div>
                    <div
                      className="cursor-pointer pl-7"
                      onClick={handleCopyDemoLink}
                      title="Copy demo/test link to clipboard"
                    >
                      <span className="text-sm font-semibold text-gray-500 hover:text-gray-700 break-all transition duration-200">
                        {demoLink}
                      </span>
                    </div>
                    {copiedDemoLink && (
                      <div className="pl-7 text-xs font-bold text-green-600 mt-1">
                        Copied!
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Basic details */}
        <h3 className="text-lg font-semibold">Replication configuration</h3>
        <div className="flex justify-between bg-white p-4 rounded-xl shadow mb-6 mt-2 items-center">
          <div className="text-sm text-gray-700 space-y-2">
            <div className="flex">
              <ClockIcon className="h-5 w-5 text-gray-600 mr-2" />
              <strong>Duration:</strong>
              {replication.duration ? (
                <p className="mx-2">
                  {Math.floor(replication.duration / 60)}m{" "}
                  {replication.duration % 60}s
                </p>
              ) : (
                <p className="mx-2 text-gray-500">No time limit</p>
              )}
              <button
                onClick={() => setIsNewDurationModalOpen(true)}
                className="flex text-center items-center space-x-1 text-blue-600 hover:underline mr-2"
              >
                <PencilIcon className="h-4 w-4" />
                <span className="text-sm">{replication.duration ? "Change" : "Add timer"}</span>
              </button>
              {replication.duration && (
                <button
                  onClick={handleDeleteDuration}
                  className="flex text-center items-center space-x-1 text-red-600 hover:underline"
                >
                  <TrashIcon className="h-4 w-4" />
                  <span className="text-sm">Remove</span>
                </button>
              )}
            </div>
            <div className="flex">
              <ClipboardDocumentCheckIcon className="h-5 w-5 text-gray-600 mr-2" />
              <strong>Form:</strong>
              {replication.form ? (
                <a
                  href={replication.form}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mx-2 text-blue-600 hover:underline max-w-xs overflow-hidden truncate"
                >
                  {replication.form}
                </a>
              ) : (
                <p className="mx-2 text-gray-500">No form provided</p>
              )}
              <button
                onClick={() => setIsNewFormModalOpen(true)}
                className="flex text-center items-center space-x-1 text-blue-600 hover:underline mr-2"
              >
                <PencilIcon className="h-4 w-4" />
                <span className="text-sm">Change</span>
              </button>
              <button
                onClick={() => handleDeleteForm()}
                className="flex text-center items-center space-x-1 text-red-600 hover:underline"
              >
                <TrashIcon className="h-4 w-4" />
                <span className="text-sm">Delete</span>
              </button>
            </div>
            <div className="flex">
              <CodeBracketIcon className="h-5 w-5 text-gray-600 mr-2" />
              <strong>Code:</strong>
              <div
                className="flex flex-col cursor-pointer ml-2"
                onClick={() => handleCopyCode()}
                title="Copy code to clipboard"
              >
                <div className="flex items-center mr-2">
                  <span className="text-sm font-semibold text-gray-500 hover:text-gray-700 transition duration-200">
                    {replication.code}
                  </span>
                </div>
              </div>
              <button
                onClick={() => regenerateCode()}
                className="flex text-center items-center space-x-1 text-blue-600 hover:underline mr-2"
              >
                <ArrowPathIcon className="h-4 w-4" />
                <span className="text-sm">Regenerate</span>
              </button>
              {copied && (
                <span className="text-xs font-bold text-green-600 mt-1">
                  Copied!
                </span>
              )}
            </div>
            
          </div>
        </div>

        {/* Leias section */}
        <h3 className="text-lg font-semibold">Leia configurations</h3>
        <div className="space-y-4 bg-white p-4 rounded-xl shadow mb-6 mt-2">
          {localReplication.experiment.leias.map((item, idx) => {
            const isStartingAnySession = Boolean(startingSessionLeiaId);
            const isStartingThisSession = startingSessionLeiaId === item.id;
            const currentApiKeyId = item.runnerConfiguration.apiKeyId;
            const currentModelName = item.runnerConfiguration.modelName ?? "";

            const currentApiKeyObj = apiKeys.find((k) => k.id === currentApiKeyId);
            const apiKeyDisplayName = currentApiKeyObj?.description || "Select Key";

            const validModelsForLeia = getValidModels(
              currentApiKeyId,
              apiKeys,
              apiKeyProvidersMapped
            );

            const validApiKeysForLeia = getValidApiKeys(
              currentModelName,
              apiKeys,
              apiKeyProvidersMapped
            );

            return (
              <div
                key={idx}
                className="bg-white p-4 rounded-xl shadow flex flex-col space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{item.leia.metadata.name}</div>
                  <div className="flex">
                    <button
                      onClick={() => {
                        setSideBarData(item.leia);
                        setIsSidebarOpen(true);
                      }}
                      className="flex items-center space-x-1 text-blue-600 hover:underline"
                    >
                      <EyeIcon className="h-4 w-4" />
                      <span className="text-sm">View Content</span>
                    </button>
                    <button
                      onClick={() => {
                        startTestSession(item.id, replication.id, idx);
                      }}
                      disabled={isStartingAnySession}
                      className={`flex items-center space-x-1 text-gray-600 hover:underline ${
                        isStartingAnySession
                          ? "opacity-60 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      {isStartingThisSession ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 text-gray-600 ml-4 animate-spin" />
                          <span className="text-sm text-gray-700">
                            Starting...
                          </span>
                        </>
                      ) : (
                        <>
                          <BeakerIcon className="h-4 w-4 text-gray-600 ml-4" />
                          <span className="text-sm text-gray-700">
                            Test Session
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-700">
                  Sessions: <strong>{item.sessionCount}</strong>
                </div>
                <div className="text-sm text-gray-700">
                  Mode: <strong>{item.configuration.mode}</strong>
                </div>

                <div className="flex items-center space-x-8">
                  <label className="text-center flex items-center">
                    <DocumentTextIcon className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-700 mx-2">
                      Student solution
                    </span>
                    <Switch
                      checked={item.configuration.askSolution}
                      onChange={() => toggleAskSolution(idx)}
                    ></Switch>
                  </label>
                  <label className="text-center flex items-center">
                    <LightBulbIcon className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-700 mx-2">
                      Automatic evaluation
                    </span>
                    <Switch
                      checked={item.configuration.evaluateSolution}
                      onChange={() => toggleEvaluateSolution(idx)}
                    ></Switch>
                  </label>
                </div>

                <fieldset className="bg-white p-4 rounded-xl shadow border-solid border border-gray-400">
                  <legend>Runner</legend>
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="text-sm text-gray-700">Model:</div>
                    {(() => {
                      const currentValue =
                        item.runnerConfiguration.modelName ?? "";
                      const isCurrentValid =
                        currentValue === "" ||
                        currentValue === DEFAULT_PROVIDER ||
                        validModelsForLeia.includes(currentValue);

                      return (
                        <select
                          value={currentValue}
                          onChange={(e) =>
                            handleLocalLeiaChange(
                              idx,
                              "runnerConfiguration.modelName",
                              e.target.value
                            )
                          }
                          className={`border rounded-md p-2 ${
                            isCurrentValid
                              ? "border-gray-300"
                              : "border-red-500 bg-red-50 text-red-800"
                          }`}
                        >
                          <option value="">-- Select Model --</option>
                          {!isCurrentValid && (
                            <option value={currentValue}>
                              {currentValue} (no disponible)
                            </option>
                          )}
                          {validModelsForLeia.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      );
                    })()}
                  </div>

                  {/* API Key Dropdown */}
                  <div className="flex items-center space-x-2 mb-3 relative">
                    <div className="text-sm text-gray-700 mr-1">API Key:</div>

                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() =>
                          setOpenDropdownIdx(openDropdownIdx === idx ? null : idx)
                        }
                        className="flex items-center justify-between min-w-[180px] border border-gray-300 rounded-md p-2 text-sm bg-white hover:bg-gray-50 focus:outline-none transition-colors"
                      >
                        <span className="truncate mr-2">
                          {apiKeyDisplayName}
                        </span>
                        <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                      </button>

                      {openDropdownIdx === idx && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setOpenDropdownIdx(null)}
                          ></div>

                          <div className="absolute left-0 mt-1 w-full min-w-[180px] bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1 overflow-hidden">
                            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50 border-b border-gray-100">
                              Select Key
                            </div>

                            <button
                              onClick={() => {
                                handleLocalLeiaChange(
                                  idx,
                                  "runnerConfiguration.apiKeyId",
                                  null
                                );
                                setOpenDropdownIdx(null);
                              }}
                              className="w-full text-left px-3 py-2 text-sm italic text-gray-500 hover:bg-gray-100 border-b border-gray-100 transition-colors"
                            >
                              -- Clear Selection --
                            </button>

                            {validApiKeysForLeia.map((key) => (
                              <button
                                key={key.id}
                                onClick={() => {
                                  handleLocalLeiaChange(
                                    idx,
                                    "runnerConfiguration.apiKeyId",
                                    key.id
                                  );
                                  setOpenDropdownIdx(null);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                  currentApiKeyId === key.id
                                    ? "bg-blue-50 text-blue-700 font-medium"
                                    : "text-gray-700 hover:bg-gray-100"
                                }`}
                              >
                                {key.description}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 pl-2">
                      {currentApiKeyObj && (!currentApiKeyObj.isSystemApiKey || user?.role === 'admin') && currentApiKeyObj.managementUrl && (
                        <a
                          href={currentApiKeyObj.managementUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                          title={currentApiKeyObj.managementUrl}
                        >
                          <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          <span>Dashboard</span>
                        </a>
                      )}

                      <Link
                        to="/administration/api-keys"
                        className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Manage Keys
                      </Link>
                    </div>
                  </div>

                  {/* Audio Mode Configuration */}
                  <div className="border-t pt-3 mt-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <label className="text-sm text-gray-700 font-medium">
                        Audio Mode:
                      </label>
                      <select
                        value={item.runnerConfiguration.audioMode || "none"}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "none") {
                            handleLocalLeiaChange(
                              idx,
                              "runnerConfiguration.audioMode",
                              null
                            );
                            handleLocalLeiaChange(
                              idx,
                              "runnerConfiguration.hideAudioTranscription",
                              null
                            );
                          } else if (value === "realtime") {
                            handleLocalLeiaChange(
                              idx,
                              "runnerConfiguration.audioMode",
                              "realtime"
                            );
                            if (
                              item.runnerConfiguration.hideAudioTranscription ===
                                null ||
                              item.runnerConfiguration.hideAudioTranscription ===
                                undefined
                            ) {
                              handleLocalLeiaChange(
                                idx,
                                "runnerConfiguration.hideAudioTranscription",
                                false
                              );
                            }
                            if (!item.runnerConfiguration.realtimeConfig) {
                              handleLocalLeiaChange(
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
                            handleLocalLeiaChange(
                              idx,
                              "runnerConfiguration.audioMode",
                              "luke"
                            );
                            if (
                              item.runnerConfiguration.hideAudioTranscription ===
                                null ||
                              item.runnerConfiguration.hideAudioTranscription ===
                                undefined
                            ) {
                              handleLocalLeiaChange(
                                idx,
                                "runnerConfiguration.hideAudioTranscription",
                                false
                              );
                            }
                            if (!item.runnerConfiguration.lukeConfig) {
                              handleLocalLeiaChange(
                                idx,
                                "runnerConfiguration.lukeConfig",
                                {
                                  provider: "gemini",
                                  voice: "Puck",
                                }
                              );
                            }
                          }
                        }}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        <option value="none">None</option>
                        <option value="realtime">Legacy (OpenAI Realtime)</option>
                        <option value="luke">Luke</option>
                      </select>
                    </div>

                    {item.runnerConfiguration.audioMode && (
                      <div className="ml-4">
                        <div className="flex items-center space-x-2 mt-2">
                          <ChatBubbleBottomCenterIcon className="h-4 w-4 text-gray-600" />
                          <label className="text-sm text-gray-700 font-medium">
                            Hide audio transcription:
                          </label>
                          <Switch
                            checked={
                              item.runnerConfiguration
                                .hideAudioTranscription || false
                            }
                            onChange={(checked) =>
                              handleLocalLeiaChange(
                                idx,
                                "runnerConfiguration.hideAudioTranscription",
                                checked
                              )
                            }
                          />
                        </div>
                      </div>
                    )}

                    {item.runnerConfiguration.audioMode === "realtime" && (
                      <div className="ml-4 space-y-2 text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-600">Voice:</span>
                          <select
                            value={
                              item.runnerConfiguration.realtimeConfig?.voice ||
                              "marin"
                            }
                            onChange={(e) =>
                              handleLocalLeiaChange(
                                idx,
                                "runnerConfiguration.realtimeConfig.voice",
                                e.target.value
                              )
                            }
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                          >
                            {getFilteredVoiceOptions(
                              item.leia.spec.persona.spec.subjectPronoum,
                              showAllVoices,
                              item.runnerConfiguration.realtimeConfig?.voice ||
                                "marin"
                            )?.map((voice) => (
                              <option key={voice.value} value={voice.value}>
                                {voice.label}
                              </option>
                            ))}
                          </select>
                          <label className="text-center flex items-center">
                            <EyeIcon className="h-4 w-4 text-gray-600" />
                            <span className="text-sm text-gray-700 mx-2">
                              Show all voices
                            </span>
                            <Switch
                              checked={showAllVoices}
                              onChange={() => setShowAllVoices(!showAllVoices)}
                            ></Switch>
                          </label>
                        </div>
                        <div className="text-xs text-purple-600 flex items-center gap-1">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                            />
                          </svg>
                          Real-time voice conversation enabled (Legacy)
                        </div>
                      </div>
                    )}

                    {item.runnerConfiguration.audioMode === "luke" && (
                      <div className="ml-4 space-y-2 text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-600">Provider:</span>
                          <select
                            value={
                              item.runnerConfiguration.lukeConfig?.provider ||
                              "gemini"
                            }
                            onChange={(e) => {
                              const provider = e.target.value;
                              handleLocalLeiaChange(
                                idx,
                                "runnerConfiguration.lukeConfig.provider",
                                provider
                              );
                              // Set default voice for the selected provider
                              const defaultVoice = provider === "gemini" ? "Puck" : "alloy";
                              handleLocalLeiaChange(
                                idx,
                                "runnerConfiguration.lukeConfig.voice",
                                defaultVoice
                              );
                            }}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                          >
                            <option value="openai">OpenAI</option>
                            <option value="gemini">Gemini</option>
                          </select>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-600">Voice:</span>
                          <select
                            value={
                              item.runnerConfiguration.lukeConfig?.voice ||
                              (item.runnerConfiguration.lukeConfig?.provider === "openai" ? "alloy" : "Puck")
                            }
                            onChange={(e) =>
                              handleLocalLeiaChange(
                                idx,
                                "runnerConfiguration.lukeConfig.voice",
                                e.target.value
                              )
                            }
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                          >
                            {item.runnerConfiguration.lukeConfig?.provider === "openai" ? (
                              <>
                                <option value="alloy">Alloy</option>
                                <option value="ash">Ash</option>
                                <option value="ballad">Ballad</option>
                                <option value="coral">Coral</option>
                                <option value="echo">Echo</option>
                                <option value="sage">Sage</option>
                                <option value="shimmer">Shimmer</option>
                                <option value="verse">Verse</option>
                              </>
                            ) : (
                              <>
                                <option value="Puck">Puck</option>
                                <option value="Charon">Charon</option>
                                <option value="Kore">Kore</option>
                                <option value="Fenrir">Fenrir</option>
                                <option value="Aoede">Aoede</option>
                              </>
                            )}
                          </select>
                        </div>
                        <div className="text-xs text-blue-600 flex items-center gap-1">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                            />
                          </svg>
                          Luke voice conversation enabled
                        </div>

                        <WidgetsConfigPanel
                          widgets={(item.runnerConfiguration.lukeConfig?.widgets ?? []) as WidgetAssignment[]}
                          onChange={(next) =>
                            handleLocalLeiaChange(
                              idx,
                              "runnerConfiguration.lukeConfig.widgets",
                              next
                            )
                          }
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex w-full gap-2">
                    <button
                      onClick={() => handleLocalLeiaReset(idx)}
                      className="mt-2 bg-gray-400 text-white rounded-lg px-4 py-2 hover:bg-gray-500 transition duration-200 w-full"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => handleLeiaUpdate(idx)}
                      disabled={
                        JSON.stringify(
                          localReplication.experiment.leias[idx]
                        ) === JSON.stringify(replication.experiment.leias[idx])
                      }
                      className={`mt-2 rounded-lg px-4 py-2 transition duration-200 w-full text-white ${
                        JSON.stringify(
                          localReplication.experiment.leias[idx]
                        ) === JSON.stringify(replication.experiment.leias[idx])
                          ? "bg-blue-300 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      Save
                    </button>
                  </div>
                </fieldset>
              </div>
            );
          })}
        </div>

        {/* Modals */}
        {isNewNameModalOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsNewNameModalOpen(false);
                setNewName("");
              }
            }}
          >
            <div
              className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold mb-4">Rename Replication</h2>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="name"
                className="w-full border border-gray-300 rounded-md p-2 mb-4"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setIsNewNameModalOpen(false);
                    setNewName("");
                  }}
                  className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRename}
                  disabled={!newName.trim()}
                  className={`px-4 py-2 rounded-md ${
                    newName.trim()
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-blue-300 text-white cursor-not-allowed"
                  }`}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {isNewDurationModalOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsNewDurationModalOpen(false);
                setNewDuration("");
              }
            }}
          >
            <div
              className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold mb-4">
                Change Replication Duration
              </h2>
              <input
                type="text"
                pattern="[0-9]*"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                placeholder="Duration in seconds (e.g. 1800)"
                className="w-full border border-gray-300 rounded-md p-2 mb-4"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setIsNewDurationModalOpen(false);
                    setNewDuration("");
                  }}
                  className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangeDuration}
                  disabled={
                    !newDuration ||
                    isNaN(Number(newDuration)) ||
                    Number(newDuration) <= 0 ||
                    !Number.isInteger(Number(newDuration))
                  }
                  className={`px-4 py-2 rounded-md ${
                    newDuration &&
                    !isNaN(Number(newDuration)) &&
                    Number(newDuration) > 0 &&
                    Number.isInteger(Number(newDuration))
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-blue-300 text-white cursor-not-allowed"
                  }`}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {isNewFormModalOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsNewFormModalOpen(false);
                setNewForm("");
              }
            }}
          >
            <div
              className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold mb-4">
                Change Replication Form
              </h2>
              <input
                type="text"
                value={newForm}
                onChange={(e) => setNewForm(e.target.value)}
                placeholder="https://example.com/form"
                className="w-full border border-gray-300 rounded-md p-2 mb-4"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setIsNewFormModalOpen(false);
                    setNewForm("");
                  }}
                  className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangeForm}
                  disabled={!newForm.trim()}
                  className={`px-4 py-2 rounded-md ${
                    newForm.trim()
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-blue-300 text-white cursor-not-allowed"
                  }`}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        <UnsavedChangesModal
          isOpen={isModalOpen}
          onCancel={handleCancelUnsavedModal}
          onProceedWithoutSaving={handleProceedWithoutSaving}
          onConfirmSaveAndProceed={handleConfirmSaveAndProceed}
        />

        {isMissingProviderModalOpen && unavailableLeiaProviders.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-lg w-full mx-4">
              <h2 className="text-lg font-semibold mb-2 text-red-700">
                Model not available
              </h2>
              <p className="text-sm text-gray-700 mb-4">
                Some Leias have a provider configured that is no longer in the list of available models.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 max-h-56 overflow-auto">
                {unavailableLeiaProviders.map((item) => (
                  <div
                    key={`${item.leiaName}-${item.provider}`}
                    className="text-sm text-red-800"
                  >
                    <strong>{item.leiaName}:</strong> {item.provider}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Change the provider to one that is available and save the configuration.
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => setIsMissingProviderModalOpen(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Understand
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Sidebar */}
        {isSidebarOpen && (
          <div className="fixed inset-y-0 left-0 w-full bg-white shadow-lg z-50 overflow-auto">
            <div className="sticky top-0 flex justify-between items-center p-4 border-b bg-white">
              <h2 className="text-lg font-semibold">Leia Content</h2>
              <button onClick={() => setIsSidebarOpen(false)}>
                <XMarkIcon className="h-5 w-5 text-gray-600 hover:text-gray-800" />
              </button>
            </div>
            <SyntaxHighlighter
              language="json"
              style={docco}
              wrapLongLines={true}
              showLineNumbers={true}
            >
              {JSON.stringify(sideBarData, null, 2)}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
    </div>
)};