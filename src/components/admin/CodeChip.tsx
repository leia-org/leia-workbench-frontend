import React from "react";
import { Box } from "@mui/material";

interface CodeChipProps {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}

export const CodeChip: React.FC<CodeChipProps> = ({ children, onClick, title }) => {
  return (
    <Box
      component="span"
      onClick={onClick}
      title={title}
      sx={{
        fontFamily:
          "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        px: "6px",
        py: "2px",
        borderRadius: "4px",
        bgcolor: "surfaces.subtle",
        color: "text.secondary",
        display: "inline-block",
        cursor: onClick ? "pointer" : "default",
        "&:hover": onClick
          ? { bgcolor: "surfaces.hover", color: "text.primary" }
          : undefined,
      }}
    >
      {children}
    </Box>
  );
};

export default CodeChip;
