import React, { useState } from "react";
import { toast } from "react-toastify";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import { ApiKeyCard } from "../components/apikeys/ApiKeyCard";
import { ApiKeyFormModal } from "../components/apikeys/ApiKeyFormModal";
import { ApiKeyMarkDefaultModal } from "../components/apikeys/ApiKeyMarkDefaultModal";
import type { ApiKey, ApiKeyFormData } from "../models/ApiKeys";
import { useApiKeys } from "../hooks/useApiKeys";
import { useAuth } from "../context";
import AdminLayout from "../components/admin/AdminLayout";


export const ApiKeysPage: React.FC = () => {
  const {user} = useAuth();
  const { apiKeys, isLoading, toggleDefault, savingIds, deleteKey, saveKey, refetch } = useApiKeys();
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMarkDefaultModalOpen, setIsMarkDefaultModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // --- Handlers ---
  const confirmMarkDefault = async () => {
    if (!selectedKey) return;
    try {
      const updatedKey = await toggleDefault(selectedKey);
      toast.success(updatedKey.isDefault ? "API Key set as default" : "API Key removed as default");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to update default status");
    } finally {
      setIsMarkDefaultModalOpen(false);
      setSelectedKey(null);
    }
  };
  const openCreateModal = () => {
    setFormMode("create");
    setSelectedKey(null);
    setValidationErrors({});
    setIsFormModalOpen(true);
  };

  const openEditModal = (key: ApiKey) => {
    setFormMode("edit");
    setSelectedKey(key);
    setValidationErrors({});
    setIsFormModalOpen(true);
  };

  const openMarkDefaultModal = (key: ApiKey) => {
    setSelectedKey(key);
    setIsMarkDefaultModalOpen(true);
  }

  const handleSaveKey = async (formData: Partial<ApiKey>) => {
    try {
      setValidationErrors({});
      const isCreate = formMode === "create";
      const isSystemKey = isCreate ? formData.isSystemApiKey : selectedKey?.isSystemApiKey;
      const baseUrl = isSystemKey
        ? `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/apiKeys/system`
        : `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/apikeys`;

      const url = isCreate ? baseUrl : `${baseUrl}/${selectedKey?.id}`;
      const method = isCreate ? "POST" : "PUT";
      const cleanManagementUrl = formData.managementUrl?.trim() || undefined;

      const payload: ApiKeyFormData = {
        description: formData.description,
        keyValue: formData.keyValue,
        provider: formData.provider,
        baseUrl: formData.baseUrl,
        managementUrl: cleanManagementUrl,
        isActive: formData.isActive,
      };
      if (isCreate) {
        payload.isDefault = formData.isDefault;
      }
      await saveKey(url, method, payload);
      await refetch();
      toast.success(isCreate ? "API Key created successfully!" : "API Key updated!");
      setIsFormModalOpen(false);
    } catch (err: any) {
      console.error(err);
      console.log('Errores de validación recibidos:', err);
      if (err.validationErrors) {
        setValidationErrors(err.validationErrors);
        toast.error("Please correct the errors in the form.");
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to save API Key");
      }
      throw err;
    }
  };

  const confirmDelete = async () => {
    if (!selectedKey) return;
    try {
      const baseUrl = selectedKey.isSystemApiKey
        ? `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/apiKeys/system`
        : `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/apikeys`;

      const url = `${baseUrl}/${selectedKey.id}`;

      await deleteKey(url, selectedKey.id);
      toast.success("API Key deleted successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to delete API Key");
    } finally {
      setIsDeleteModalOpen(false);
      setSelectedKey(null);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 10,
          }}
        >
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography sx={{ color: "text.secondary", fontWeight: 500 }}>
            Loading your API Keys...
          </Typography>
        </Box>
      );
    }
    if (apiKeys.length === 0) {
      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 10,
            bgcolor: "background.paper",
            borderRadius: 2,
            border: "1px dashed",
            borderColor: "divider",
            boxShadow: 1,
          }}
        >
          <VpnKeyOutlinedIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
          <Typography
            sx={{ color: "text.secondary", mb: 2, textAlign: "center", maxWidth: 360 }}
          >
            You don't have any custom API Keys configured yet. Add one to get started.
          </Typography>
          <Button variant="outlined" onClick={openCreateModal}>
            Create your first key
          </Button>
        </Box>
      );
    }

    return (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
          gap: 3,
        }}
      >
        {apiKeys.map((key) => (
          <ApiKeyCard
            key={key.id}
            apiKey={key}
            userRole={user?.role}
            onEdit={() => openEditModal(key)}
            onDelete={() => { setSelectedKey(key); setIsDeleteModalOpen(true); }}
            onToggleDefault={() => openMarkDefaultModal(key)}
            isSaving={!!savingIds?.[key.id]}
          />
        ))}
      </Box>
    );
  };

  const headerActions = (
    <Button
      variant="contained"
      startIcon={<AddIcon sx={{ fontSize: 16 }} />}
      onClick={openCreateModal}
    >
      New API key
    </Button>
  );

  return (
    <AdminLayout
      title="API Keys"
      subtitle="Manage your model configurations and programmatic access keys."
      actions={headerActions}
    >
      <Box sx={{ maxWidth: 1100, width: "100%", mx: "auto" }}>
        {renderContent()}
      </Box>

      {/* --- MODAL FORMULARIO (Creación / Edición) --- */}
      <ApiKeyFormModal
        isOpen={isFormModalOpen}
        mode={formMode}
        userRole={user?.role}
        selectedKey={selectedKey}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedKey(null);
        }}
        onSave={handleSaveKey}
        errors={validationErrors}
      />

      {/* --- MODAL DE ELIMINACIÓN --- */}
      <Dialog
        open={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedKey(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          Delete API Key?
          <IconButton
            aria-label="close"
            onClick={() => {
              setIsDeleteModalOpen(false);
              setSelectedKey(null);
            }}
            sx={{ color: "text.disabled" }}
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Are you sure you want to delete the key{" "}
            <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>
              "{selectedKey?.description}"
            </Box>
            ? This action cannot be undone and any application using this key will
            stop working immediately.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => setIsDeleteModalOpen(false)}
            sx={{ borderColor: "divider", color: "text.primary" }}
          >
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- MODAL MARCAR/DESMARCAR DEFAULT --- */}
      {isMarkDefaultModalOpen && (<ApiKeyMarkDefaultModal
        apiKey={selectedKey}
        onClose={() => { setIsMarkDefaultModalOpen(false); setSelectedKey(null); }}
        onConfirm={confirmMarkDefault}
      />)}
    </AdminLayout>
  );
};
