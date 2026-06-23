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

const DEFAULT_DATA_USAGE_CONSENT_MESSAGE =
  "Before starting this activity, please indicate whether you consent to the use of your conversation data for educational and research purposes. Your choice will be recorded with this conversation.";

interface DataUsageSectionProps {
  replication: ReplicationData;
  onUpdateDataUsage: (dataUsage: {
    dataUsageConsentRequired: boolean;
    dataUsageConsentMessage: string;
    conversationAutomatedRemoval: boolean;
  }) => Promise<void>;
}

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
  const [dataUsageConsentRequired, setDataUsageConsentRequired] = useState(
    Boolean(replication.dataUsageConsentRequired)
  );
  const [dataUsageConsentMessage, setDataUsageConsentMessage] = useState(
    replication.dataUsageConsentMessage || DEFAULT_DATA_USAGE_CONSENT_MESSAGE
  );
  const [conversationAutomatedRemoval, setConversationAutomatedRemoval] =
    useState(Boolean(replication.conversationAutomatedRemoval));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDataUsageConsentRequired(Boolean(replication.dataUsageConsentRequired));
    setDataUsageConsentMessage(
      replication.dataUsageConsentMessage || DEFAULT_DATA_USAGE_CONSENT_MESSAGE
    );
    setConversationAutomatedRemoval(
      Boolean(replication.conversationAutomatedRemoval)
    );
  }, [replication]);

  const isDirty =
    dataUsageConsentRequired !== Boolean(replication.dataUsageConsentRequired) ||
    dataUsageConsentMessage !==
      (replication.dataUsageConsentMessage || DEFAULT_DATA_USAGE_CONSENT_MESSAGE) ||
    conversationAutomatedRemoval !==
      Boolean(replication.conversationAutomatedRemoval);

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
        Consent and retention behaviour for student conversations in this replication.
      </Typography>

      <Field
        label="Data Usage Consent Acceptance Required"
        helper="When enabled, students must choose before the activity starts."
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Switch
            checked={dataUsageConsentRequired}
            onChange={(e) => setDataUsageConsentRequired(e.target.checked)}
          />
          <Typography variant="body2">
            {dataUsageConsentRequired ? "Yes" : "No"}
          </Typography>
        </Stack>
      </Field>

      <Field
        label="Data Usage Consent Acceptance Message"
        helper="Shown inside the blocking student pop-up."
      >
        <TextField
          fullWidth
          multiline
          minRows={5}
          size="small"
          value={dataUsageConsentMessage}
          onChange={(e) => setDataUsageConsentMessage(e.target.value)}
        />
      </Field>

      <Field
        label="Conversation automated removal"
        helper="If enabled, declining consent removes the conversation automatically."
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Switch
            checked={conversationAutomatedRemoval}
            onChange={(e) => setConversationAutomatedRemoval(e.target.checked)}
          />
          <Typography variant="body2">
            {conversationAutomatedRemoval ? "Yes" : "No"}
          </Typography>
        </Stack>
      </Field>

      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
        <Button
          variant="contained"
          startIcon={<SaveOutlinedIcon sx={{ fontSize: 16 }} />}
          disabled={!isDirty || saving || !dataUsageConsentMessage.trim()}
          onClick={async () => {
            setSaving(true);
            try {
              await onUpdateDataUsage({
                dataUsageConsentRequired,
                dataUsageConsentMessage: dataUsageConsentMessage.trim(),
                conversationAutomatedRemoval,
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
