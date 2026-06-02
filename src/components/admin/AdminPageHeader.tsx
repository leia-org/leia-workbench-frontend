import React from "react";
import { Box, Breadcrumbs, Link as MuiLink, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface AdminPageHeaderProps {
  title?: string;
  /** Optional one-line caption rendered under the title. Ignored when
   *  breadcrumbs are used instead of a title. */
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
}) => {
  return (
    <Box
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        height: 56,
        minHeight: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        bgcolor: "background.default",
        borderBottom: "1px solid",
        borderColor: "divider",
        px: 4,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", minWidth: 0, gap: 1 }}>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <Breadcrumbs
            separator={
              <ChevronRightIcon sx={{ fontSize: 14, color: "text.disabled" }} />
            }
            sx={{
              "& .MuiBreadcrumbs-ol": { flexWrap: "nowrap" },
              "& .MuiBreadcrumbs-li": { minWidth: 0 },
            }}
          >
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              if (isLast || !crumb.to) {
                return (
                  <Typography
                    key={idx}
                    variant="h6"
                    sx={{
                      color: "text.primary",
                      fontSize: 18,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 600,
                    }}
                  >
                    {crumb.label}
                  </Typography>
                );
              }
              return (
                <MuiLink
                  key={idx}
                  component={RouterLink}
                  to={crumb.to}
                  underline="hover"
                  sx={{
                    color: "text.secondary",
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  {crumb.label}
                </MuiLink>
              );
            })}
          </Breadcrumbs>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <Typography variant="h6">{title}</Typography>
            {subtitle && (
              <Typography
                sx={{ fontSize: 12, color: "text.secondary", mt: 0.25 }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        )}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {actions}
      </Box>
    </Box>
  );
};

export default AdminPageHeader;
