import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
} from "@mui/material";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { IconButton } from "@mui/material";
import { readReplicationName } from "../../lib/replicationNames";
import { useAuth } from "../../context";

export const ADMIN_SIDEBAR_WIDTH = 240;

const REPLICATION_TOKENS_KEY = "replicationTokens";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  matchPrefix?: string;
}

const WORKSPACE_ITEMS: NavItem[] = [
  {
    label: "Replications",
    path: "/administration",
    icon: <LayersOutlinedIcon sx={{ fontSize: 18 }} />,
    matchPrefix: "/administration",
  },
  {
    label: "Experiments",
    path: "/experiments",
    icon: <ScienceOutlinedIcon sx={{ fontSize: 18 }} />,
    matchPrefix: "/experiments",
  },
  {
    label: "API Keys",
    path: "/administration/api-keys",
    icon: <VpnKeyOutlinedIcon sx={{ fontSize: 18 }} />,
    matchPrefix: "/administration/api-keys",
  },
];

const groupLabelSx = {
  display: "block",
  px: 2,
  pt: 3,
  pb: 1,
};

const itemButtonSx = (selected: boolean) => ({
  height: 32,
  minHeight: 32,
  mx: 1,
  px: 1.25,
  borderRadius: "6px",
  position: "relative" as const,
  color: selected ? "primary.dark" : "text.primary",
  bgcolor: selected ? "surfaces.selected" : "transparent",
  fontWeight: selected ? 600 : 500,
  "&:hover": {
    bgcolor: selected ? "surfaces.selected" : "surfaces.hover",
  },
  "&::before": selected
    ? {
        content: '""',
        position: "absolute",
        left: 0,
        top: 6,
        bottom: 6,
        width: 2,
        borderRadius: 2,
        backgroundColor: "primary.main",
      }
    : {},
  "& .MuiListItemIcon-root": {
    minWidth: 28,
    color: selected ? "primary.main" : "text.secondary",
  },
  "& .MuiListItemText-primary": {
    fontSize: 13,
    fontWeight: selected ? 600 : 500,
    color: "inherit",
  },
});

// Extracts the replication id from the current path. Returns null when
// we're not under a replication route. Used to scope the sidebar for
// share-token visitors who only have access to that single replication.
const replicationIdFromPath = (pathname: string): string | null => {
  const m = pathname.match(/^\/replications\/([^/]+)/);
  return m ? m[1] : null;
};

const hasStoredShareToken = (id: string | null): boolean => {
  if (!id) return false;
  try {
    const raw = localStorage.getItem(REPLICATION_TOKENS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && typeof parsed === "object" && parsed[id]);
  } catch {
    return false;
  }
};

export const AdminSidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Two modes:
  // - admin (default): full workspace + admin/logout.
  // - scoped: share-token visitor; we only surface the single replication
  //   they're authorised to manage. No Experiments, no global list.
  // A logged-in user (JWT in the auth context) is never "scoped"; scoped mode
  // is only for share-token visitors landing on a single replication.
  const { token, logout } = useAuth();
  const scopedReplicationId = useMemo(
    () => replicationIdFromPath(location.pathname),
    [location.pathname]
  );
  const isScoped =
    !token && scopedReplicationId !== null &&
    hasStoredShareToken(scopedReplicationId);

  const isSelected = (item: NavItem) => {
    if (item.matchPrefix) {
      if (item.matchPrefix === "/administration") {
        return (
          (location.pathname.startsWith("/administration") &&
            !location.pathname.startsWith("/administration/api-keys")) ||
          location.pathname.startsWith("/replications")
        );
      }
      return location.pathname.startsWith(item.matchPrefix);
    }
    return location.pathname === item.path;
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleEndShareSession = () => {
    // Clear ONLY the share token for this replication, then drop the
    // user back at the public landing.
    if (scopedReplicationId) {
      try {
        const raw = localStorage.getItem(REPLICATION_TOKENS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            delete parsed[scopedReplicationId];
            localStorage.setItem(
              REPLICATION_TOKENS_KEY,
              JSON.stringify(parsed)
            );
          }
        }
      } catch {
        /* ignore */
      }
    }
    navigate("/");
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: ADMIN_SIDEBAR_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: ADMIN_SIDEBAR_WIDTH,
          boxSizing: "border-box",
          backgroundColor: "surfaces.sidebar",
          borderRight: "1px solid",
          borderColor: "divider",
          boxShadow: "none",
        },
      }}
    >
      {/* Match the page header exactly: 56px container with the
          border drawn INSIDE the height (border-box). A standalone
          <Divider> below the logo would add an extra 1px and shift
          everything in the sidebar down relative to the page header. */}
      <Box
        sx={{
          height: 56,
          display: "flex",
          alignItems: "center",
          px: 2.5,
          gap: 1.25,
          borderBottom: "1px solid",
          borderColor: "divider",
          boxSizing: "border-box",
        }}
      >
        <Box
          component="img"
          src="/logo/leia_main_dark.png"
          alt="LEIA"
          sx={{
            width: 22,
            height: 22,
            display: "block",
            objectFit: "contain",
          }}
        />
        <Typography
          sx={{
            fontFamily: "'Manrope Variable', sans-serif",
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "text.primary",
          }}
        >
          LEIA
        </Typography>
      </Box>

      {isScoped ? (
        <ScopedSidebarBody
          replicationId={scopedReplicationId!}
          location={location.pathname}
          onNavigate={(p) => navigate(p)}
          onEndSession={handleEndShareSession}
        />
      ) : (
        <Box sx={{ flex: 1, overflow: "auto", py: 0 }}>
          <Typography variant="overline" sx={groupLabelSx}>
            Workspace
          </Typography>
          <List dense disablePadding>
            {WORKSPACE_ITEMS.map((item) => {
              const selected = isSelected(item);
              return (
                <ListItem
                  key={item.path}
                  disablePadding
                  sx={{ display: "block" }}
                >
                  <ListItemButton
                    onClick={() => navigate(item.path)}
                    aria-current={selected ? "page" : undefined}
                    sx={itemButtonSx(selected)}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>

          <Typography variant="overline" sx={groupLabelSx}>
            Admin
          </Typography>
          <List dense disablePadding>
            <ListItem disablePadding sx={{ display: "block" }}>
              <ListItemButton
                onClick={handleLogout}
                sx={{
                  ...itemButtonSx(false),
                  "&:hover": {
                    bgcolor: "rgba(220, 38, 38, 0.06)",
                    color: "error.main",
                    "& .MuiListItemIcon-root": { color: "error.main" },
                    "& .MuiListItemText-primary": { color: "error.main" },
                  },
                }}
              >
                <ListItemIcon>
                  <LogoutOutlinedIcon sx={{ fontSize: 18 }} />
                </ListItemIcon>
                <ListItemText primary="Logout" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      )}
    </Drawer>
  );
};

// Sidebar body for share-token visitors. One section, one item: the
// replication they have access to. Clicking the item lands them on the
// replication's General section regardless of where they currently are
// inside the replication.
const ScopedSidebarBody: React.FC<{
  replicationId: string;
  location: string;
  onNavigate: (path: string) => void;
  onEndSession: () => void;
}> = ({ replicationId, location, onNavigate, onEndSession }) => {
  const selected = location.startsWith(`/replications/${replicationId}`);
  // Replication name is cached by Replication / Conversations / Live
  // when they fetch it. Falls back to a generic label until the view
  // has had a chance to populate the cache.
  const replicationName = readReplicationName(replicationId) || "Replication";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, overflow: "auto", py: 0 }}>
      {/* Shared-session banner. Sits above the workspace list and
          carries the close affordance so the user can drop the
          ephemeral access without scrolling for it. */}
      <Box
        sx={{
          mx: 1.5,
          mt: 2,
          p: 1.25,
          display: "flex",
          gap: 1,
          alignItems: "flex-start",
          borderRadius: 1.5,
          bgcolor: "surfaces.accent",
          border: "1px solid",
          borderColor: "primary.main",
        }}
      >
        <LinkOutlinedIcon
          sx={{ fontSize: 16, color: "primary.main", mt: "1px" }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "primary.main",
              lineHeight: 1.2,
            }}
          >
            Shared session
          </Typography>
          <Typography
            sx={{
              fontSize: 11,
              color: "text.secondary",
              lineHeight: 1.4,
              mt: 0.25,
            }}
          >
            You're managing this replication via a share link. Close to drop access.
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={onEndSession}
          aria-label="Close shared session"
          sx={{
            mt: "-2px",
            mr: "-4px",
            color: "primary.main",
            p: 0.25,
            "&:hover": {
              bgcolor: "rgba(37, 99, 235, 0.08)",
            },
          }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

      <Typography variant="overline" sx={groupLabelSx}>
        Replications
      </Typography>
      <List dense disablePadding>
        <ListItem disablePadding sx={{ display: "block" }}>
          <ListItemButton
            onClick={() => onNavigate(`/replications/${replicationId}`)}
            aria-current={selected ? "page" : undefined}
            sx={itemButtonSx(selected)}
          >
            <ListItemIcon>
              <LayersOutlinedIcon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText
              primary={replicationName}
              primaryTypographyProps={{
                noWrap: true,
                sx: {
                  fontSize: 13,
                  fontWeight: selected ? 600 : 500,
                  color: "inherit",
                },
              }}
            />
          </ListItemButton>
        </ListItem>
      </List>

      <Box sx={{ flex: 1 }} />

      <Divider sx={{ mt: 2 }} />
      <List dense disablePadding sx={{ pt: 1, pb: 1 }}>
        <ListItem disablePadding sx={{ display: "block" }}>
          <ListItemButton
            onClick={onEndSession}
            sx={{
              ...itemButtonSx(false),
              "&:hover": {
                bgcolor: "rgba(220, 38, 38, 0.06)",
                color: "error.main",
                "& .MuiListItemIcon-root": { color: "error.main" },
                "& .MuiListItemText-primary": { color: "error.main" },
              },
            }}
          >
            <ListItemIcon>
              <LogoutOutlinedIcon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText primary="End session" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );
};

export default AdminSidebar;
