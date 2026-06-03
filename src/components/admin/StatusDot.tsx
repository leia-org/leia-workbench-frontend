import React from "react";
import { Box, keyframes } from "@mui/material";

type StatusColor = "success" | "warning" | "error" | "neutral" | "primary";

interface StatusDotProps {
  color?: StatusColor;
  size?: number;
  /** When true, the dot emits a soft expanding halo — used to signal
   *  live / active sessions in the dashboard. */
  pulse?: boolean;
}

const COLOR_MAP: Record<StatusColor, string> = {
  success: "#16A34A",
  warning: "#D97706",
  error: "#DC2626",
  neutral: "#A8A29E",
  primary: "#2563EB",
};

const pulseAnim = keyframes`
  0% { transform: scale(1); opacity: 0.55; }
  70% { transform: scale(2.6); opacity: 0; }
  100% { transform: scale(2.6); opacity: 0; }
`;

export const StatusDot: React.FC<StatusDotProps> = ({
  color = "neutral",
  size = 6,
  pulse = false,
}) => {
  const bg = COLOR_MAP[color];
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <Box
        component="span"
        sx={{
          display: "block",
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: bg,
        }}
      />
      {pulse && (
        <Box
          component="span"
          sx={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            backgroundColor: bg,
            animation: `${pulseAnim} 1.6s ease-out infinite`,
            pointerEvents: "none",
          }}
        />
      )}
    </Box>
  );
};

export default StatusDot;
