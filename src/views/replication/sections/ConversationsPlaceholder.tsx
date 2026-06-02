import React from "react";
import { Box, Button, Typography } from "@mui/material";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useNavigate } from "react-router-dom";

interface Props {
  replicationId: string;
}

export const ConversationsPlaceholder: React.FC<Props> = ({ replicationId }) => {
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
      <ForumOutlinedIcon sx={{ fontSize: 36, color: "text.disabled" }} />
      <Typography sx={{ fontSize: 16, fontWeight: 600 }}>
        Conversations
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: "text.secondary", maxWidth: 420 }}
      >
        Inspect transcripts, sessions and student responses from the dedicated
        conversations view.
      </Typography>
      <Button
        variant="contained"
        startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
        onClick={() => navigate(`/replications/${replicationId}/conversations`)}
        sx={{ mt: 1 }}
      >
        Open conversations
      </Button>
    </Box>
  );
};

export default ConversationsPlaceholder;
