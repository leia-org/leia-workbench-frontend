import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import type { ReplicationData } from "../types";

export const DEFAULT_DATA_USAGE_CONSENT_MESSAGE =
  "Before starting this activity, please indicate whether you consent to the use of your conversation data for educational and research purposes. Your choice will be recorded with this conversation.";

type DataUsageConfig = NonNullable<ReplicationData["dataUsageConfig"]>;

interface DataUsageSectionProps {
  replication: ReplicationData;
  onUpdateDataUsage: (dataUsageConfig: DataUsageConfig) => Promise<void>;
}

const getConfig = (replication: ReplicationData): DataUsageConfig => ({
  dataUsageConsentRequired: Boolean(replication.dataUsageConfig?.dataUsageConsentRequired),
  dataUsageConsentMessage:
    replication.dataUsageConfig?.dataUsageConsentMessage || DEFAULT_DATA_USAGE_CONSENT_MESSAGE,
  conversationAutomatedRemoval:
    Boolean(replication.dataUsageConfig?.dataUsageConsentRequired) &&
    Boolean(replication.dataUsageConfig?.conversationAutomatedRemoval),
});

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  helper?: React.ReactNode;
}> = ({ label, children, helper }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: "260px 1fr",
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

export const DataUsageSection: React.FC<DataUsageSectionProps> = ({
  replication,
  onUpdateDataUsage,
}) => {
  const savedConfig = getConfig(replication);
  const [dataUsageConsentRequired, setDataUsageConsentRequired] = useState(
    savedConfig.dataUsageConsentRequired
  );
  const [dataUsageConsentMessage, setDataUsageConsentMessage] = useState(
    savedConfig.dataUsageConsentMessage
  );
  const [conversationAutomatedRemoval, setConversationAutomatedRemoval] =
    useState(savedConfig.conversationAutomatedRemoval);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextConfig = getConfig(replication);
    setDataUsageConsentRequired(nextConfig.dataUsageConsentRequired);
    setDataUsageConsentMessage(nextConfig.dataUsageConsentMessage);
    setConversationAutomatedRemoval(nextConfig.conversationAutomatedRemoval);
  }, [replication]);

  const isDirty =
    dataUsageConsentRequired !== savedConfig.dataUsageConsentRequired ||
    dataUsageConsentMessage !== savedConfig.dataUsageConsentMessage ||
    conversationAutomatedRemoval !== savedConfig.conversationAutomatedRemoval;

  const handleDataUsageConsentRequiredChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const checked = e.target.checked;
    setDataUsageConsentRequired(checked);
    if (!checked) {
      setConversationAutomatedRemoval(false);
    }
  };

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
        Data Usage
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
        Configure consent and conversation retention for this replication.
      </Typography>

      <Field
        label="Data Usage Consent Acceptance"
        helper="When enabled, students must choose before interacting."
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Switch
            checked={dataUsageConsentRequired}
            onChange={handleDataUsageConsentRequiredChange}
          />
          <Typography variant="body2">
            {dataUsageConsentRequired ? "Enabled" : "Disabled"}
          </Typography>
        </Stack>
      </Field>

      <Field
        label="Consent message"
        helper="Shown inside the student pop-up."
      >
        <TextField
          fullWidth
          multiline
          minRows={5}
          size="small"
          value={dataUsageConsentMessage}
          disabled={!dataUsageConsentRequired}
          onChange={(e) => setDataUsageConsentMessage(e.target.value)}
        />
      </Field>

      <Field
        label="Conversation automated removal"
        helper="If enabled, conversations will be automatically removed after the student leaves the replication."
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Switch
            checked={conversationAutomatedRemoval}
            disabled={!dataUsageConsentRequired}
            onChange={(e) => setConversationAutomatedRemoval(e.target.checked)}
          />
          <Typography variant="body2">
            {conversationAutomatedRemoval ? "Enabled" : "Disabled"}
          </Typography>
        </Stack>
      </Field>

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
        <Button
          variant="contained"
          startIcon={<SaveOutlinedIcon sx={{ fontSize: 16 }} />}
          disabled={
            !isDirty ||
            saving ||
            (dataUsageConsentRequired && !dataUsageConsentMessage.trim())
          }
          onClick={async () => {
            setSaving(true);
            try {
              await onUpdateDataUsage({
                dataUsageConsentRequired,
                dataUsageConsentMessage:
                  dataUsageConsentMessage.trim() || DEFAULT_DATA_USAGE_CONSENT_MESSAGE,
                conversationAutomatedRemoval:
                  dataUsageConsentRequired && conversationAutomatedRemoval,
              });
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </Stack>
    </Box>
  );
};

export default DataUsageSection;
