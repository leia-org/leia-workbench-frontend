import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, InputBase, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";

interface MasterDetailLayoutProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  listHeaderActions?: React.ReactNode;
  list: React.ReactNode;
  detail: React.ReactNode;
  emptyListMessage?: string;
  isListEmpty?: boolean;
  /** Stable key used to persist the list column width per view. */
  storageKey?: string;
  /** Initial width when nothing is persisted yet. */
  defaultWidth?: number;
}

const MIN_LIST_WIDTH = 280;
const MAX_LIST_WIDTH = 640;
const DRAG_HANDLE_WIDTH = 8;

const readPersistedWidth = (key?: string): number | null => {
  if (!key || typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(MAX_LIST_WIDTH, Math.max(MIN_LIST_WIDTH, parsed));
};

export const MasterDetailLayout: React.FC<MasterDetailLayoutProps> = ({
  searchPlaceholder = "Search...",
  searchValue,
  onSearchChange,
  listHeaderActions,
  list,
  detail,
  emptyListMessage = "Nothing here yet.",
  isListEmpty = false,
  storageKey,
  defaultWidth = 420,
}) => {
  const [listWidth, setListWidth] = useState<number>(
    () => readPersistedWidth(storageKey) ?? defaultWidth
  );
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(listWidth);

  // Re-read persisted width if the storage key changes between views.
  useEffect(() => {
    const persisted = readPersistedWidth(storageKey);
    if (persisted != null) setListWidth(persisted);
  }, [storageKey]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      draggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = listWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handlePointerMove = (ev: PointerEvent) => {
        if (!draggingRef.current) return;
        const delta = ev.clientX - startXRef.current;
        const next = Math.min(
          MAX_LIST_WIDTH,
          Math.max(MIN_LIST_WIDTH, startWidthRef.current + delta)
        );
        setListWidth(next);
      };

      const handlePointerUp = () => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        if (storageKey && typeof window !== "undefined") {
          window.localStorage.setItem(storageKey, String(Math.round(listWidthRef.current)));
        }
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [listWidth, storageKey]
  );

  // Keep an up-to-date ref of the current width so the pointer-up callback
  // (which is closed over the initial render's value) can persist what's
  // actually on screen at release time.
  const listWidthRef = useRef(listWidth);
  useEffect(() => {
    listWidthRef.current = listWidth;
  }, [listWidth]);

  return (
    <Box
      sx={{
        display: "flex",
        flex: 1,
        minHeight: 0,
        bgcolor: "background.default",
      }}
    >
      {/* Left list panel — fixed-width column, height locked to the
          viewport via the AdminLayout flex chain so only this inner
          region scrolls when the list grows. */}
      <Box
        sx={{
          width: listWidth,
          flexShrink: 0,
          borderRight: "1px solid",
          borderColor: "divider",
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.paper",
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            height: 48,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <SearchIcon sx={{ fontSize: 16, color: "text.disabled" }} />
          <InputBase
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            sx={{
              flex: 1,
              fontSize: 13,
              "& input::placeholder": {
                color: "text.disabled",
                opacity: 1,
              },
            }}
          />
          {listHeaderActions}
        </Box>
        <Box sx={{ flex: 1, overflowY: "auto" }}>
          {isListEmpty ? (
            <Box
              sx={{
                p: 4,
                textAlign: "center",
                color: "text.secondary",
                fontSize: 13,
              }}
            >
              {emptyListMessage}
            </Box>
          ) : (
            list
          )}
        </Box>
      </Box>

      {/* Drag handle for resizing the list column. The hit area is
          wider than the visible line so it's comfortable to grab. */}
      <Box
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize list panel"
        onPointerDown={handlePointerDown}
        sx={{
          width: DRAG_HANDLE_WIDTH,
          marginLeft: `-${DRAG_HANDLE_WIDTH / 2}px`,
          marginRight: `-${DRAG_HANDLE_WIDTH / 2}px`,
          cursor: "col-resize",
          flexShrink: 0,
          zIndex: 1,
          position: "relative",
          // Visible vertical line only on hover/active so it stays
          // subtle when idle.
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "50%",
            width: "1px",
            backgroundColor: "transparent",
            transition: "background-color 120ms ease",
          },
          "&:hover::before, &:active::before": {
            backgroundColor: (theme) => theme.palette.primary.main,
            width: "2px",
            transform: "translateX(-0.5px)",
          },
        }}
      />

      {/* Right detail */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          minWidth: 0,
        }}
      >
        {detail}
      </Box>
    </Box>
  );
};

export const MasterDetailEmptyState: React.FC<{
  message?: string;
  icon?: React.ReactNode;
}> = ({ message = "Select an item to see details", icon }) => {
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "text.disabled",
        gap: 1.5,
        p: 4,
      }}
    >
      {icon ?? <InboxOutlinedIcon sx={{ fontSize: 32 }} />}
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {message}
      </Typography>
    </Box>
  );
};

export default MasterDetailLayout;
