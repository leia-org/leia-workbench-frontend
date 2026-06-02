import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import type { ReplicationData } from "../types";

interface SettingsSectionProps {
  replication: ReplicationData;
  onChangeForm: (newForm: string) => Promise<void>;
  onDeleteForm: () => Promise<void>;
}

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  helper?: React.ReactNode;
}> = ({ label, children, helper }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: "200px 1fr",
      alignItems: "center",
      py: 1.5,
      borderBottom: "1px solid",
      borderColor: "divider",
      gap: 2,
      "&:last-of-type": { borderBottom: "none" },
    }}
  >
    <Box>
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
        {label}
      </Typography>
      {helper && (
        <Typography
          variant="caption"
          sx={{ display: "block", color: "text.disabled", mt: 0.25 }}
        >
          {helper}
        </Typography>
      )}
    </Box>
    <Box sx={{ minWidth: 0 }}>{children}</Box>
  </Box>
);

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  replication,
  onChangeForm,
  onDeleteForm,
}) => {
  const [open, setOpen] = useState(false);
  const [newForm, setNewForm] = useState("");

  return (
    <Box sx={{ maxWidth: 880 }}>
      <Typography
        sx={{
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          mb: 0.5,
        }}
      >
        Settings
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
        Additional replication-level configuration.
      </Typography>

      <Field
        label="External form URL"
        helper="Optional link shown after the conversation."
      >
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          {replication.form ? (
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
              <a
                href={replication.form}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#2563EB",
                  fontSize: 13,
                  textDecoration: "none",
                  maxWidth: 360,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  display: "inline-block",
                }}
              >
                {replication.form}
              </a>
              <OpenInNewOutlinedIcon
                sx={{ fontSize: 14, color: "text.disabled" }}
              />
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: "text.disabled" }}>
              No form provided
            </Typography>
          )}
          <Button
            size="small"
            variant="text"
            startIcon={<EditOutlinedIcon sx={{ fontSize: 14 }} />}
            onClick={() => {
              setNewForm(replication.form || "");
              setOpen(true);
            }}
          >
            Change
          </Button>
          {replication.form && (
            <Button
              size="small"
              variant="text"
              color="error"
              startIcon={<DeleteOutlineOutlinedIcon sx={{ fontSize: 14 }} />}
              onClick={onDeleteForm}
            >
              Delete
            </Button>
          )}
        </Stack>
      </Field>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change replication form</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={newForm}
            onChange={(e) => setNewForm(e.target.value)}
            placeholder="https://example.com/form"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!newForm.trim()}
            onClick={async () => {
              await onChangeForm(newForm.trim());
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SettingsSection;
