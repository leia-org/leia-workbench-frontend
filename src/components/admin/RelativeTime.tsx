import React from "react";
import { Typography } from "@mui/material";

export const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return `${interval} year${interval === 1 ? "" : "s"} ago`;

  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return `${interval} month${interval === 1 ? "" : "s"} ago`;

  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return `${interval} day${interval === 1 ? "" : "s"} ago`;

  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return `${interval} hour${interval === 1 ? "" : "s"} ago`;

  interval = Math.floor(seconds / 60);
  if (interval >= 1) return `${interval} minute${interval === 1 ? "" : "s"} ago`;

  if (seconds > 0) return `${seconds} second${seconds === 1 ? "" : "s"} ago`;

  return "Now";
};

interface RelativeTimeProps {
  date: string;
  variant?: "caption" | "body2";
  color?: string;
}

export const RelativeTime: React.FC<RelativeTimeProps> = ({
  date,
  variant = "caption",
  color = "text.disabled",
}) => {
  return (
    <Typography component="span" variant={variant} sx={{ color }}>
      {formatTimeAgo(date)}
    </Typography>
  );
};

export default RelativeTime;
