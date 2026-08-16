import React, { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import SettingsSuggestOutlinedIcon from "@mui/icons-material/SettingsSuggestOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";

type EvaluationView = "config" | "insights" | "tree";

const cardSx = {
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 2,
  boxShadow: "none",
  bgcolor: "background.paper",
};

const insights = [
  {
    title: "Strong conceptual understanding",
    body: "Most students correctly distinguish state from behavior, although they struggle to justify when a responsibility should be encapsulated.",
    value: "72%",
    tone: "success.main",
  },
  {
    title: "Recurring blocker",
    body: "8 students tried to modify the public interface before checking the edge cases in the assignment.",
    value: "8",
    tone: "warning.main",
  },
  {
    title: "Reinforcement opportunity",
    body: "Answers about composition versus inheritance show low confidence and a lack of specific explanations.",
    value: "41%",
    tone: "info.main",
  },
];

const TreeNode = ({
  label,
  detail,
  count,
  color = "primary.main",
}: {
  label: string;
  detail: string;
  count: number;
  color?: string;
}) => (
  <Paper sx={{ ...cardSx, p: 1.5, width: 210, borderTop: "3px solid", borderTopColor: color }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{label}</Typography>
      <Chip label={count} size="small" sx={{ height: 21, fontSize: 11, fontWeight: 700 }} />
    </Stack>
    <Typography sx={{ mt: 0.5, fontSize: 11.5, color: "text.secondary", lineHeight: 1.45 }}>
      {detail}
    </Typography>
  </Paper>
);

export const EvaluationSection: React.FC = () => {
  const [view, setView] = useState<EvaluationView>("config");
  const [enabled, setEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  return (
    <Box sx={{ maxWidth: 1180, mx: "auto" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Evaluation</Typography>
          </Stack>
          <Typography sx={{ mt: 0.75, color: "text.secondary", fontSize: 14 }}>
            Configure the evaluator LEIA and explore the learning evidence collected in this replication.
          </Typography>
        </Box>
      </Stack>

      <Paper sx={{ ...cardSx, mt: 3, px: 1 }}>
        <Tabs value={view} onChange={(_, value: EvaluationView) => setView(value)}>
          <Tab icon={<SettingsSuggestOutlinedIcon />} iconPosition="start" value="config" label="Configuration" />
          <Tab icon={<InsightsOutlinedIcon />} iconPosition="start" value="insights" label="Insights" />
          <Tab icon={<AccountTreeOutlinedIcon />} iconPosition="start" value="tree" label="Trajectory tree" />
        </Tabs>
      </Paper>

      {view === "config" && (
        <Stack spacing={2.5} sx={{ mt: 2.5 }}>
          <Paper sx={{ ...cardSx, p: 2.5 }}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
              <Box>
                <Typography sx={{ fontWeight: 700 }}>Evaluator LEIA</Typography>
                <Typography sx={{ color: "text.secondary", fontSize: 13, mt: 0.5 }}>
                  Asks adaptive questions after the activity and synthesizes the collected evidence.
                </Typography>
              </Box>
              <FormControlLabel control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />} label={enabled ? "Enabled" : "Disabled"} />
            </Stack>
          </Paper>

          <Box>
            <Paper sx={{ ...cardSx, p: 2.5 }}>
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Evaluation goal</Typography>
              <Typography sx={{ color: "text.secondary", fontSize: 13, mb: 2 }}>
                Describe the evidence the evaluator should look for during the conversation.
              </Typography>
              <TextField fullWidth multiline minRows={5} defaultValue="Assess whether the student understands the object-oriented design principles used in their solution. Explore their decisions, identify possible misconceptions, and evaluate their ability to justify alternative approaches." />
              <Divider sx={{ my: 2.5 }} />
              <Typography sx={{ fontWeight: 700, mb: 2 }}>Parameters</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.75 }}>Number of questions</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    defaultValue={5}
                    slotProps={{ htmlInput: { min: 2, step: 1 } }}
                  />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.75 }}>Conversation tone</Typography>
                  <Select fullWidth size="small" defaultValue="socratic"><MenuItem value="socratic">Socratic and approachable</MenuItem><MenuItem value="formal">Formal</MenuItem><MenuItem value="direct">Direct</MenuItem></Select>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.75 }}>Model</Typography>
                  <Select fullWidth size="small" defaultValue="default"><MenuItem value="default">Default model</MenuItem><MenuItem value="gpt">GPT-4.1 mini</MenuItem></Select>
                </Box>
              </Box>
              <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 3 }}>
                <Button variant="text">Reset</Button>
                <Button variant="contained" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }}>
                  {saved ? "Configuration saved" : "Save configuration"}
                </Button>
              </Stack>
            </Paper>
          </Box>
        </Stack>
      )}

      {view === "insights" && (
        <Stack spacing={2.5} sx={{ mt: 2.5 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
            {[
              ["24", "Students evaluated", <GroupsOutlinedIcon />],
              ["116", "Answers analyzed", <ChatBubbleOutlineIcon />],
              ["68%", "Average mastery", <InsightsOutlinedIcon />],
            ].map(([value, label, icon]) => (
              <Paper key={String(label)} sx={{ ...cardSx, p: 2.25 }}>
                <Stack direction="row" justifyContent="space-between"><Box><Typography sx={{ fontSize: 26, fontWeight: 750 }}>{value}</Typography><Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{label}</Typography></Box><Box sx={{ color: "primary.main" }}>{icon}</Box></Stack>
              </Paper>
            ))}
          </Box>
          <Paper sx={{ ...cardSx, p: 2.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography sx={{ fontWeight: 700 }}>Insight summary</Typography><Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.5 }}>Aggregated and anonymized patterns from the latest run.</Typography></Box><Chip label="Updated 4 min ago" size="small" variant="outlined" /></Stack>
            <Stack spacing={2} sx={{ mt: 2.5 }}>
              {insights.map((item) => <Box key={item.title} sx={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 2, p: 2, borderRadius: 1.5, bgcolor: "action.hover" }}><Typography sx={{ fontSize: 20, fontWeight: 750, color: item.tone }}>{item.value}</Typography><Box><Typography sx={{ fontSize: 14, fontWeight: 700 }}>{item.title}</Typography><Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.5 }}>{item.body}</Typography></Box></Box>)}
            </Stack>
          </Paper>
          <Paper sx={{ ...cardSx, p: 2.5 }}>
            <Typography sx={{ fontWeight: 700, mb: 2 }}>Mastery by dimension</Typography>
            {[["Conceptual understanding", 76], ["Decision rationale", 64], ["Error detection", 58], ["Knowledge transfer", 71]].map(([label, value]) => <Box key={String(label)} sx={{ mb: 1.75 }}><Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}><Typography sx={{ fontSize: 13 }}>{label}</Typography><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{value}%</Typography></Stack><LinearProgress variant="determinate" value={Number(value)} sx={{ height: 7, borderRadius: 4 }} /></Box>)}
          </Paper>
        </Stack>
      )}

      {view === "tree" && (
        <Paper sx={{ ...cardSx, mt: 2.5, p: 2.5, overflow: "auto" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography sx={{ fontWeight: 700 }}>Trajectory tree</Typography><Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.5 }}>Paths grouped according to student answers.</Typography></Box><Stack direction="row" spacing={1}><Chip label="24 trajectories" size="small" /><Button size="small" variant="outlined">Export</Button></Stack></Stack>
          <Box sx={{ minWidth: 800, mt: 4, pb: 2 }}>
            <Stack alignItems="center"><TreeNode label="Evaluation started" detail="Explains the proposed solution" count={24} color="primary.main" /><Box sx={{ width: 2, height: 30, bgcolor: "divider" }} /></Stack>
            <Stack direction="row" justifyContent="center" spacing={8} sx={{ position: "relative", "&::before": { content: '\"\"', position: "absolute", top: -1, left: "25%", right: "25%", height: 2, bgcolor: "divider" } }}>
              <Stack alignItems="center"><Box sx={{ width: 2, height: 24, bgcolor: "divider" }} /><TreeNode label="Decision justified" detail="Connects the design to requirements" count={16} color="success.main" /><Box sx={{ width: 2, height: 30, bgcolor: "divider" }} /><Stack direction="row" spacing={3}><TreeNode label="Transfers the concept" detail="Suggests a valid alternative" count={11} color="success.main" /><TreeNode label="Unsure about variations" detail="Needs a supporting question" count={5} color="warning.main" /></Stack></Stack>
              <Stack alignItems="center"><Box sx={{ width: 2, height: 24, bgcolor: "divider" }} /><TreeNode label="Partial rationale" detail="Describes the code, not the decision" count={8} color="warning.main" /><Box sx={{ width: 2, height: 30, bgcolor: "divider" }} /><Stack direction="row" spacing={3}><TreeNode label="Recognizes the error" detail="Reframes the answer after a hint" count={6} color="info.main" /><TreeNode label="Maintains the approach" detail="Does not identify the edge case" count={2} color="error.main" /></Stack></Stack>
            </Stack>
          </Box>
          <Divider />
          <Stack direction="row" spacing={3} sx={{ mt: 2 }}>{[["success.main", "High mastery"], ["warning.main", "Needs support"], ["error.main", "Blocker detected"]].map(([color, label]) => <Stack key={label} direction="row" spacing={0.75} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} /><Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>{label}</Typography></Stack>)}</Stack>
        </Paper>
      )}
    </Box>
  );
};
