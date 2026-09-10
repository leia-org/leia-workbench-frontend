import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import { Chip } from "@mui/material";
import CodeChip from "../../../components/admin/CodeChip";
import { formatTimeAgo } from "../../../components/admin/RelativeTime";
import type { ReplicationData } from "../types";

interface GeneralSectionProps {
  replication: ReplicationData;
  isAdmin: boolean;
  onRename: (newName: string) => Promise<void>;
  onChangeDuration: (newDuration: number) => Promise<void>;
  onDeleteDuration: () => Promise<void>;
  onRegenerateCode: () => Promise<void>;
  onSwitchLanguage: (newLanguage: string) => Promise<void>;
  onToggleActive: () => Promise<void>;
  onToggleRepeatable: () => Promise<void>;
  onToggleShared: () => Promise<void>;
  onRegenerateShareToken: () => Promise<void>;
  onCopyCode: () => void;
  onCopyShareLink: () => void;
  onCopyStudentLink: () => void;
  onCopyDemoLink: () => void;
  copied: boolean;
  copiedShareLink: boolean;
  copiedStudentLink: boolean;
  copiedDemoLink: boolean;
  studentLink: string;
  demoLink: string;
}

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  helper?: React.ReactNode;
}> = ({ label, children, helper }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: "180px 1fr",
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

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    sx={{
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "text.disabled",
      mb: 1,
      mt: 4,
    }}
  >
    {children}
  </Typography>
);

export const GeneralSection: React.FC<GeneralSectionProps> = (props) => {
  const {
    replication,
    isAdmin,
    onRename,
    onChangeDuration,
    onDeleteDuration,
    onRegenerateCode,
    onSwitchLanguage,
    onToggleActive,
    onToggleRepeatable,
    onToggleShared,
    onRegenerateShareToken,
    onCopyCode,
    onCopyShareLink,
    onCopyStudentLink,
    onCopyDemoLink,
    copied,
    copiedShareLink,
    copiedStudentLink,
    copiedDemoLink,
    studentLink,
    demoLink,
  } = props;

  const [nameOpen, setNameOpen] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [languageOpen, setLanguageOpen] = useState(false);
  const [newLanguage, setNewLanguage] = useState("");
  const [durHours, setDurHours] = useState<number>(0);
  const [durMinutes, setDurMinutes] = useState<number>(30);
  const [durSeconds, setDurSeconds] = useState<number>(0);

  const totalSeconds =
    Math.max(0, durHours) * 3600 +
    Math.max(0, durMinutes) * 60 +
    Math.max(0, durSeconds);
  const totalIsValid =
    totalSeconds > 0 && Number.isInteger(totalSeconds) && totalSeconds < 24 * 3600 * 7;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "No time limit";
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <Box sx={{ maxWidth: 880 }}>
      <Typography
        sx={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", mb: 0.5 }}
      >
        General
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
        Replication metadata and high-level toggles.
      </Typography>

      <SectionTitle>Links</SectionTitle>
      <Field label="Student link">
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Typography
            onClick={onCopyStudentLink}
            sx={{
              fontSize: 13,
              color: "text.secondary",
              cursor: "pointer",
              wordBreak: "break-all",
              "&:hover": { color: "text.primary" },
            }}
            title="Copy student link"
          >
            <LinkOutlinedIcon
              sx={{ fontSize: 14, mr: 0.5, verticalAlign: "middle" }}
            />
            {studentLink}
          </Typography>
          {copiedStudentLink && (
            <Typography
              variant="caption"
              sx={{ color: "success.main", fontWeight: 600 }}
            >
              Copied!
            </Typography>
          )}
        </Stack>
      </Field>

      <Field label="Demo / test link">
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Typography
            onClick={onCopyDemoLink}
            sx={{
              fontSize: 13,
              color: "text.secondary",
              cursor: "pointer",
              wordBreak: "break-all",
              "&:hover": { color: "text.primary" },
            }}
            title="Copy demo link"
          >
            <LinkOutlinedIcon
              sx={{ fontSize: 14, mr: 0.5, verticalAlign: "middle" }}
            />
            {demoLink}
          </Typography>
          {copiedDemoLink && (
            <Typography
              variant="caption"
              sx={{ color: "success.main", fontWeight: 600 }}
            >
              Copied!
            </Typography>
          )}
        </Stack>
      </Field>

      {isAdmin && (
        <>
          <SectionTitle>Sharing</SectionTitle>
          <Field
            label="Shared access"
            helper="Anyone with the share link can manage this replication."
          >
            <Stack direction="row" alignItems="center" gap={1}>
              <Switch
                checked={replication.isShared}
                onChange={onToggleShared}
                size="small"
              />
              <ShareOutlinedIcon
                sx={{ fontSize: 16, color: "text.disabled" }}
              />
            </Stack>
          </Field>
          {replication.isShared && replication.shareToken && (
            <Field label="Share token">
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <CodeChip>{replication.shareToken}</CodeChip>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={
                    <ContentCopyOutlinedIcon sx={{ fontSize: 14 }} />
                  }
                  onClick={onCopyShareLink}
                  sx={{ borderColor: "divider", color: "text.primary" }}
                >
                  {copiedShareLink ? "Copied" : "Copy share link"}
                </Button>
                <Button
                  size="small"
                  variant="text"
                  startIcon={<RefreshOutlinedIcon sx={{ fontSize: 14 }} />}
                  onClick={onRegenerateShareToken}
                >
                  Regenerate
                </Button>
              </Stack>
            </Field>
          )}
        </>
      )}

      <SectionTitle>Identity</SectionTitle>

      <Field label="Name">
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography sx={{ fontSize: 14 }}>{replication.name}</Typography>
          {isAdmin && (
            <Button
              size="small"
              variant="text"
              startIcon={<EditOutlinedIcon sx={{ fontSize: 14 }} />}
              onClick={() => {
                setNewName(replication.name);
                setNameOpen(true);
              }}
            >
              Rename
            </Button>
          )}
        </Stack>
      </Field>

      <Field
        label="Code"
        helper="Students join with this code."
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <CodeChip onClick={onCopyCode} title="Copy code">
            {replication.code}
          </CodeChip>
          {copied && (
            <Typography
              variant="caption"
              sx={{ color: "success.main", fontWeight: 600 }}
            >
              Copied!
            </Typography>
          )}
          <Tooltip title="Regenerate code">
            <IconButton size="small" onClick={onRegenerateCode}>
              <RefreshOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Field>

      <Field label="Experiment">
        <Typography sx={{ fontSize: 14, color: "text.primary" }}>
          {replication.experiment.name}
        </Typography>
      </Field>

      <Field label="Created">
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {new Date(replication.createdAt).toLocaleString()}
        </Typography>
      </Field>

      <Field label="Last updated">
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {formatTimeAgo(replication.updatedAt)}
        </Typography>
      </Field>

      <SectionTitle>State</SectionTitle>

      <Field
        label="Language"
        helper="The language used for evaluation and feedback."
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography sx={{ fontSize: 14 }}>{replication.language}</Typography>
          {isAdmin && (
            <Button
              size="small"
              variant="text"
              startIcon={<EditOutlinedIcon sx={{ fontSize: 14 }} />}
              onClick={() => {
                setNewLanguage(replication.language);
                setLanguageOpen(true);
              }}
            >
              Rename
            </Button>
          )}
        </Stack>
      </Field>
      <Field label="Active" helper="Controls whether students can join.">
        <Switch
          checked={replication.isActive}
          onChange={onToggleActive}
          size="small"
        />
      </Field>
      
      <Field label="Repeatable" helper="Allow the same student to retry.">
        <Switch
          checked={replication.isRepeatable}
          onChange={onToggleRepeatable}
          size="small"
        />
      </Field>

      <Field label="Duration" helper="Optional time limit per session.">
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography sx={{ fontSize: 14 }}>
            {formatDuration(replication.duration)}
          </Typography>
          <Button
            size="small"
            variant="text"
            startIcon={<EditOutlinedIcon sx={{ fontSize: 14 }} />}
            onClick={() => {
              // Seed the picker with the current duration when there is
              // one, so the user nudges from the existing value instead
              // of starting from zero.
              if (replication.duration) {
                const total = replication.duration;
                setDurHours(Math.floor(total / 3600));
                setDurMinutes(Math.floor((total % 3600) / 60));
                setDurSeconds(total % 60);
              } else {
                setDurHours(0);
                setDurMinutes(30);
                setDurSeconds(0);
              }
              setDurationOpen(true);
            }}
          >
            {replication.duration ? "Change" : "Add timer"}
          </Button>
          {replication.duration ? (
            <Button
              size="small"
              variant="text"
              color="error"
              startIcon={<DeleteOutlineOutlinedIcon sx={{ fontSize: 14 }} />}
              onClick={onDeleteDuration}
            >
              Remove
            </Button>
          ) : null}
        </Stack>
      </Field>

      {/* Rename dialog */}
      <Dialog open={nameOpen} onClose={() => setNameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename replication</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNameOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!newName.trim()}
            onClick={async () => {
              await onRename(newName.trim());
              setNameOpen(false);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Language dialog */}
      <Dialog open={languageOpen} onClose={() => setLanguageOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change replication language</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={newLanguage}
            onChange={(e) => setNewLanguage(e.target.value)}
            placeholder="Language"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLanguageOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!newLanguage.trim()}
            onClick={async () => {
              await onSwitchLanguage(newLanguage.trim());
              setLanguageOpen(false);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
      {/* Duration dialog — hours + minutes picker. The backend still
          stores the raw second count; we just hide that from the admin
          since "type the duration in seconds" is a bad ask. */}
      <Dialog
        open={durationOpen}
        onClose={() => setDurationOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <AccessTimeOutlinedIcon sx={{ fontSize: 18 }} />
            <span>Set replication duration</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", mb: 2 }}
          >
            How long can a student stay in a single session?
          </Typography>
          <Stack direction="row" gap={1.5} alignItems="flex-end" sx={{ mb: 2 }}>
            <TextField
              autoFocus
              size="small"
              label="Hours"
              type="number"
              value={durHours}
              onChange={(e) =>
                setDurHours(Math.max(0, Math.min(23, Number(e.target.value) || 0)))
              }
              inputProps={{ min: 0, max: 23, step: 1, style: { width: 70 } }}
            />
            <Typography sx={{ pb: 0.75, color: "text.secondary" }}>h</Typography>
            <TextField
              size="small"
              label="Minutes"
              type="number"
              value={durMinutes}
              onChange={(e) =>
                setDurMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
              }
              inputProps={{ min: 0, max: 59, step: 1, style: { width: 70 } }}
            />
            <Typography sx={{ pb: 0.75, color: "text.secondary" }}>m</Typography>
            <TextField
              size="small"
              label="Seconds"
              type="number"
              value={durSeconds}
              onChange={(e) =>
                setDurSeconds(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
              }
              inputProps={{ min: 0, max: 59, step: 1, style: { width: 70 } }}
            />
            <Typography sx={{ pb: 0.75, color: "text.secondary" }}>s</Typography>
          </Stack>

          <Typography
            variant="overline"
            sx={{ display: "block", color: "text.disabled", mb: 0.75 }}
          >
            Quick presets
          </Typography>
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            {[
              { label: "15m", h: 0, m: 15, s: 0 },
              { label: "30m", h: 0, m: 30, s: 0 },
              { label: "45m", h: 0, m: 45, s: 0 },
              { label: "1h", h: 1, m: 0, s: 0 },
              { label: "1h 30m", h: 1, m: 30, s: 0 },
              { label: "2h", h: 2, m: 0, s: 0 },
            ].map((p) => {
              const active =
                p.h === durHours && p.m === durMinutes && p.s === durSeconds;
              return (
                <Chip
                  key={p.label}
                  label={p.label}
                  size="small"
                  onClick={() => {
                    setDurHours(p.h);
                    setDurMinutes(p.m);
                    setDurSeconds(p.s);
                  }}
                  sx={{
                    cursor: "pointer",
                    borderRadius: 1,
                    fontWeight: 500,
                    bgcolor: active ? "primary.main" : "surfaces.subtle",
                    color: active ? "primary.contrastText" : "text.primary",
                    "&:hover": {
                      bgcolor: active ? "primary.dark" : "surfaces.hover",
                    },
                  }}
                />
              );
            })}
          </Stack>

          <Box
            sx={{
              mt: 2.5,
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: "surfaces.accent",
              border: "1px solid",
              borderColor: "primary.main",
            }}
          >
            <Typography sx={{ fontSize: 12, color: "primary.dark" }}>
              Total:{" "}
              <strong>
                {durHours > 0 ? `${durHours}h ` : ""}
                {durMinutes > 0 ? `${durMinutes}m ` : ""}
                {durSeconds > 0
                  ? `${durSeconds}s`
                  : durHours === 0 && durMinutes === 0
                  ? "0s"
                  : ""}
              </strong>{" "}
              ({totalSeconds} seconds)
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDurationOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!totalIsValid}
            onClick={async () => {
              await onChangeDuration(totalSeconds);
              setDurationOpen(false);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GeneralSection;
