import React from "react";
import { Box, Button, Typography } from "@mui/material";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useNavigate } from "react-router-dom";

interface Props {
  replicationId: string;
}

export const LivePlaceholder: React.FC<Props> = ({ replicationId }) => {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        py: 8,
        gap: 1.5,
      }}
    >
      <MonitorHeartOutlinedIcon
        sx={{ fontSize: 36, color: "text.disabled" }}
      />
      <Typography sx={{ fontSize: 16, fontWeight: 600 }}>
        Live dashboard
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: "text.secondary", maxWidth: 420 }}
      >
        Monitor active student sessions and spectate ongoing conversations in
        real time.
      </Typography>
      <Button
        variant="contained"
        startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
        onClick={() => navigate(`/replications/${replicationId}/live`)}
        sx={{ mt: 1 }}
      >
        Open live dashboard
      </Button>
    </Box>
  );
};

export default LivePlaceholder;
