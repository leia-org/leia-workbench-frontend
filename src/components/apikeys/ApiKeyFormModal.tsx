import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { ApiKey } from "../../models/ApiKeys";
import { useProviders } from "../../hooks/useProviders";

export interface ApiKeyFormModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  selectedKey: ApiKey | null;
  userRole?: string;
  onClose: () => void;

  onSave: (formData: Partial<ApiKey>) => Promise<void>;
  errors?: Record<string, string>;
}

export const ApiKeyFormModal: React.FC<ApiKeyFormModalProps> = ({ isOpen, mode, selectedKey, userRole, onClose, onSave, errors = {} }) => {
  const [formData, setFormData] = useState<Partial<ApiKey>>({});
  const [, setInitialFormData] = useState<Partial<ApiKey> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { apiKeysProviderSet, apiKeyProvidersMapped, isLoading: isLoadingProviders } = useProviders();
  const providerModels = (formData.provider && apiKeyProvidersMapped?.[formData.provider]) || [];

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && selectedKey) {
        const initialData = { ...selectedKey, keyValue: "" };
        setFormData(initialData);
        setInitialFormData(initialData);
      } else {
        const newKeyData = {
          description: "",
          keyValue: "",
          provider: "",
          model: "",
          isActive: true,
          baseUrl: "",
          managementUrl: "",
          isDefault: false,
          isSystemApiKey: false,
        };
        setFormData(newKeyData);
        setInitialFormData(newKeyData);
      }
    }
  }, [isOpen, mode, selectedKey]);
  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
      | SelectChangeEvent
  ) => {
    const { name, value, type } = e.target as {
      name: string;
      value: string;
      type?: string;
    };

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'isActive') {
      setFormData(prev => ({ ...prev, isActive: value === 'Active' }));
    } else if (name === 'provider') {
      // Changing provider invalidates the chosen model.
      setFormData(prev => ({ ...prev, provider: value, model: "" }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = { ...formData };
      await onSave(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography variant="h6" component="span">
          {mode === "create" ? "Add New API Key" : "Edit API Key"}
        </Typography>
        <IconButton
          onClick={onClose}
          aria-label="Close"
          size="small"
          sx={{ color: "text.disabled", "&:hover": { color: "text.secondary" } }}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </DialogTitle>

      <Box component="form" id="api-key-form" onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <TextField
              label="Key Name (Description)"
              name="description"
              value={formData.description || ""}
              onChange={handleChange}
              placeholder="e.g. Production Key"
              required
              fullWidth
              error={!!errors.description}
              helperText={errors.description}
            />
            <TextField
              label="API Key Value"
              name="keyValue"
              value={formData.keyValue || ""}
              onChange={handleChange}
              placeholder={mode === "create" ? "sk-..." : "Leave blank to keep current"}
              required={mode === "create"}
              fullWidth
              error={!!errors.keyValue}
              helperText={errors.keyValue}
              InputProps={{ sx: { fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace" } }}
            />
            <Stack direction="row" spacing={2}>
              <FormControl
                fullWidth
                required
                error={!!errors.provider}
                disabled={isLoadingProviders}
              >
                <InputLabel id="api-key-provider-label">API Key Type</InputLabel>
                <Select
                  labelId="api-key-provider-label"
                  label="API Key Type"
                  name="provider"
                  value={formData.provider || ""}
                  onChange={handleChange}
                  displayEmpty
                  renderValue={(selected) =>
                    selected
                      ? (selected as string)
                      : (
                        <Typography component="span" sx={{ color: "text.disabled" }}>
                          {isLoadingProviders ? "Loading providers..." : "Select a provider"}
                        </Typography>
                      )
                  }
                >
                  {apiKeysProviderSet.map((provider) => (
                    <MenuItem key={provider} value={provider}>
                      {provider}
                    </MenuItem>
                  ))}
                </Select>
                {errors.provider && (
                  <Typography variant="caption" sx={{ color: "error.main", mt: 0.5, ml: 1.75 }}>
                    {errors.provider}
                  </Typography>
                )}
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="api-key-status-label">Status</InputLabel>
                <Select
                  labelId="api-key-status-label"
                  label="Status"
                  name="isActive"
                  value={formData.isActive ? "Active" : "Inactive"}
                  onChange={handleChange}
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <FormControl
              fullWidth
              required={mode === "create"}
              error={!!errors.model}
              disabled={!formData.provider || isLoadingProviders || providerModels.length === 0}
            >
              <InputLabel id="api-key-model-label" shrink>
                {mode === "create" ? "Default Model" : "Default Model (Optional)"}
              </InputLabel>
              <Select
                labelId="api-key-model-label"
                label={mode === "create" ? "Default Model" : "Default Model (Optional)"}
                name="model"
                value={formData.model || ""}
                onChange={handleChange}
                displayEmpty
                renderValue={(selected) =>
                  selected
                    ? (selected as string)
                    : (
                      <Typography component="span" sx={{ color: "text.disabled" }}>
                        {!formData.provider
                          ? "Select a provider first"
                          : providerModels.length === 0
                            ? "No models for this provider"
                            : mode === "create" ? "Select a model" : "-- none --"}
                      </Typography>
                    )
                }
              >
                {mode === "edit" && <MenuItem value=""><em>-- none --</em></MenuItem>}
                {providerModels.map((m) => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </Select>
              <Typography variant="caption" sx={{ color: errors.model ? "error.main" : "text.secondary", mt: 0.5, ml: 1.75 }}>
                {errors.model || "Preselected wherever this key is used (you can still change it there)."}
              </Typography>
            </FormControl>
            <TextField
              label="Base URL (Required for local providers)"
              name="baseUrl"
              type="url"
              value={formData.baseUrl || ""}
              onChange={handleChange}
              placeholder="https://..."
              fullWidth
              error={!!errors.baseUrl}
              helperText={errors.baseUrl}
              InputProps={{ sx: { color: "primary.main" } }}
            />
            <TextField
              label="Management URL (Optional)"
              name="managementUrl"
              type="url"
              value={formData.managementUrl || ""}
              onChange={handleChange}
              placeholder="https://..."
              fullWidth
              InputProps={{ sx: { color: "primary.main" } }}
            />
            {mode === "create" && (
              <Box sx={{ pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="isDefault"
                      checked={!!formData.isDefault}
                      onChange={handleChange}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="subtitle2">
                      Make this the default API Key
                    </Typography>
                  }
                />
                {errors.isDefault && (
                  <Typography variant="caption" sx={{ display: "block", color: "error.main", ml: 3.75 }}>
                    {errors.isDefault}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ display: "block", color: "text.secondary", ml: 3.75 }}>
                  If set, this API key will be used by default for operations that require it.
                </Typography>
              </Box>
            )}
            {mode === "create" && userRole && userRole === "admin" && (
              <Box sx={{ pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="isSystemApiKey"
                      checked={!!formData.isSystemApiKey}
                      onChange={handleChange}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="subtitle2">
                      Make this a System API Key
                    </Typography>
                  }
                />
                {errors.isSystemApiKey && (
                  <Typography variant="caption" sx={{ display: "block", color: "error.main", ml: 3.75 }}>
                    {errors.isSystemApiKey}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ display: "block", color: "text.secondary", ml: 3.75 }}>
                  System API keys can be used by all users who have system access enabled.
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onClose} disabled={isSubmitting} color="inherit">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} variant="contained" color="success">
            {isSubmitting ? "Saving..." : (mode === "create" ? "Create Key" : "Save Changes")}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default ApiKeyFormModal;
