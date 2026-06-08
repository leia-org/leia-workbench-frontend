import React from "react";
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";

export type SectionId =
  | "general"
  | "leias"
  | "settings"
  | "conversations"
  | "live";

interface LeiaItem {
  id: string;
  name: string;
}

interface ReplicationSubSidebarProps {
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
  leias: LeiaItem[];
  activeLeiaId: string | null;
  onLeiaSelect: (leiaId: string) => void;
}

const itemSx = (selected: boolean, depth = 0) => ({
  height: 32,
  minHeight: 32,
  mx: 1,
  px: 1.25,
  pl: depth ? 4 : 1.25,
  borderRadius: "6px",
  position: "relative" as const,
  color: selected ? "primary.dark" : "text.primary",
  bgcolor: selected ? "surfaces.selected" : "transparent",
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
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
});

export const ReplicationSubSidebar: React.FC<ReplicationSubSidebarProps> = ({
  activeSection,
  onSectionChange,
  leias,
  activeLeiaId,
  onLeiaSelect,
}) => {
  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        borderRight: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        overflowY: "auto",
        py: 1.5,
      }}
    >
      <List dense disablePadding>
        <ListItem disablePadding sx={{ display: "block" }}>
          <ListItemButton
            onClick={() => onSectionChange("general")}
            aria-current={activeSection === "general" ? "page" : undefined}
            sx={itemSx(activeSection === "general")}
          >
            <ListItemIcon>
              <TuneOutlinedIcon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText primary="General" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding sx={{ display: "block" }}>
          <ListItemButton
            onClick={() => {
              onSectionChange("leias");
              if (!activeLeiaId && leias.length > 0) {
                onLeiaSelect(leias[0].id);
              }
            }}
            aria-current={activeSection === "leias" ? "page" : undefined}
            sx={itemSx(activeSection === "leias")}
          >
            <ListItemIcon>
              <PeopleAltOutlinedIcon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText primary={`LEIAs (${leias.length})`} />
          </ListItemButton>
        </ListItem>

        {activeSection === "leias" && (
          <Box sx={{ py: 0.5 }}>
            {leias.map((leia) => {
              const isActive = leia.id === activeLeiaId;
              return (
                <ListItem
                  key={leia.id}
                  disablePadding
                  sx={{ display: "block" }}
                >
                  <ListItemButton
                    onClick={() => onLeiaSelect(leia.id)}
                    aria-current={isActive ? "page" : undefined}
                    sx={itemSx(isActive, 1)}
                  >
                    <ListItemText primary={leia.name} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </Box>
        )}

        <ListItem disablePadding sx={{ display: "block" }}>
          <ListItemButton
            onClick={() => onSectionChange("settings")}
            aria-current={activeSection === "settings" ? "page" : undefined}
            sx={itemSx(activeSection === "settings")}
          >
            <ListItemIcon>
              <SettingsOutlinedIcon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText primary="Settings" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding sx={{ display: "block" }}>
          <ListItemButton
            onClick={() => onSectionChange("conversations")}
            aria-current={
              activeSection === "conversations" ? "page" : undefined
            }
            sx={itemSx(activeSection === "conversations")}
          >
            <ListItemIcon>
              <ForumOutlinedIcon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText primary="Conversations" />
          </ListItemButton>
        </ListItem>

        <ListItem disablePadding sx={{ display: "block" }}>
          <ListItemButton
            onClick={() => onSectionChange("live")}
            aria-current={activeSection === "live" ? "page" : undefined}
            sx={itemSx(activeSection === "live")}
          >
            <ListItemIcon>
              <MonitorHeartOutlinedIcon sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText primary="Live" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );
};

export default ReplicationSubSidebar;
