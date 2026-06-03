import React from "react";
import { Box, ThemeProvider, CssBaseline } from "@mui/material";
import { AdminSidebar, ADMIN_SIDEBAR_WIDTH } from "./AdminSidebar";
import AdminPageHeader, { type BreadcrumbItem } from "./AdminPageHeader";
import { adminTheme } from "./theme";
import "@fontsource-variable/manrope/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";

interface AdminLayoutProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  // When set, the page content area renders flush (no padding) so that
  // child layouts can manage their own scrolling regions, e.g. the
  // master-detail two-column layout.
  flush?: boolean;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  children,
  flush = false,
}) => {
  return (
    <ThemeProvider theme={adminTheme}>
      <CssBaseline />
      <Box sx={{ display: "flex", height: "100vh", overflow: "hidden", bgcolor: "background.default" }}>
        <AdminSidebar />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
            width: `calc(100% - ${ADMIN_SIDEBAR_WIDTH}px)`,
          }}
        >
          <AdminPageHeader
            title={title}
            subtitle={subtitle}
            breadcrumbs={breadcrumbs}
            actions={actions}
          />
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              p: flush ? 0 : 4,
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default AdminLayout;
