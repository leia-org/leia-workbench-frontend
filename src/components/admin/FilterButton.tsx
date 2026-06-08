import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Divider,
  IconButton,
  Popover,
  Radio,
  Tooltip,
  Typography,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterListOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
}

export type FilterState = Record<string, string[]>;

export interface SortOption {
  /** Stable key. Whatever the caller uses to look up the comparator. */
  id: string;
  label: string;
}

export type SortDirection = "asc" | "desc";

export interface SortState {
  by: string;
  dir: SortDirection;
}

interface FilterButtonProps {
  groups: FilterGroup[];
  value: FilterState;
  onChange: (next: FilterState) => void;
  /** Optional sort controls — render only when `sortOptions` is non-empty. */
  sortOptions?: SortOption[];
  sortValue?: SortState;
  onSortChange?: (next: SortState) => void;
  /** Optional helper used by callers to display the number of items that
   *  pass the current filter — purely cosmetic. */
  matchedCount?: number;
}

const countActive = (state: FilterState): number =>
  Object.values(state).reduce((sum, arr) => sum + (arr?.length || 0), 0);

export const FilterButton: React.FC<FilterButtonProps> = ({
  groups,
  value,
  onChange,
  sortOptions,
  sortValue,
  onSortChange,
  matchedCount,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const activeFilterCount = useMemo(() => countActive(value), [value]);
  const hasSortControls = Boolean(sortOptions && sortOptions.length > 0 && sortValue && onSortChange);

  const toggleOption = (groupId: string, optionValue: string) => {
    const current = value[groupId] ?? [];
    const exists = current.includes(optionValue);
    const next = {
      ...value,
      [groupId]: exists
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue],
    };
    if (next[groupId].length === 0) delete next[groupId];
    onChange(next);
  };

  const clearAll = () => onChange({});

  const toggleSortDirection = () => {
    if (!sortValue || !onSortChange) return;
    onSortChange({ ...sortValue, dir: sortValue.dir === "asc" ? "desc" : "asc" });
  };

  const setSortField = (by: string) => {
    if (!sortValue || !onSortChange) return;
    onSortChange({ by, dir: sortValue.dir });
  };

  return (
    <>
      <Tooltip
        title={activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
        placement="bottom"
        arrow
      >
        <IconButton
          size="small"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label="Open filters"
          sx={{
            position: "relative",
            borderRadius: "6px",
            color: activeFilterCount > 0 ? "primary.main" : "text.secondary",
            "&:hover": { color: "primary.main", bgcolor: "surfaces.accent" },
          }}
        >
          <FilterListIcon sx={{ fontSize: 18 }} />
          {activeFilterCount > 0 && (
            <Box
              sx={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: "primary.main",
                boxShadow: "0 0 0 1.5px #FFFFFF",
              }}
            />
          )}
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              width: 300,
              border: "1px solid",
              borderColor: "divider",
              boxShadow:
                "0 4px 12px rgba(15,15,15,0.08), 0 2px 4px rgba(15,15,15,0.04)",
            },
          },
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.25,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
            Filters {hasSortControls && "& sort"}
          </Typography>
          {activeFilterCount > 0 ? (
            <Button
              size="small"
              variant="text"
              onClick={clearAll}
              sx={{
                fontSize: 12,
                color: "text.secondary",
                px: 0.5,
                minWidth: 0,
                "&:hover": { color: "primary.main", bgcolor: "transparent" },
              }}
            >
              Clear
            </Button>
          ) : (
            <Typography sx={{ fontSize: 11, color: "text.disabled" }}>
              None active
            </Typography>
          )}
        </Box>

        <Box sx={{ maxHeight: 420, overflowY: "auto", py: 0.5 }}>
          {/* Sort section — rendered first so it sits at the top of the
              popover when present, since it's the most-used control. */}
          {hasSortControls && sortOptions && sortValue && onSortChange && (
            <>
              <Box
                sx={{
                  px: 2,
                  pt: 1.25,
                  pb: 0.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="overline" sx={{ color: "text.disabled" }}>
                  Sort by
                </Typography>
                <Tooltip
                  title={
                    sortValue.dir === "asc" ? "Ascending" : "Descending"
                  }
                  placement="left"
                  arrow
                >
                  <IconButton
                    size="small"
                    onClick={toggleSortDirection}
                    sx={{
                      color: "primary.main",
                      bgcolor: "surfaces.accent",
                      borderRadius: "6px",
                      width: 26,
                      height: 26,
                      "&:hover": { bgcolor: "surfaces.selected" },
                    }}
                    aria-label="Toggle sort direction"
                  >
                    {sortValue.dir === "asc" ? (
                      <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                    ) : (
                      <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>
              <Box sx={{ pb: 0.5 }}>
                {sortOptions.map((opt) => {
                  const isSelected = sortValue.by === opt.id;
                  return (
                    <Box
                      key={opt.id}
                      onClick={() => setSortField(opt.id)}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        mx: 1,
                        px: 1,
                        py: 0.5,
                        borderRadius: "6px",
                        cursor: "pointer",
                        "&:hover": { bgcolor: "surfaces.hover" },
                      }}
                    >
                      <Radio
                        size="small"
                        checked={isSelected}
                        tabIndex={-1}
                        disableRipple
                        sx={{
                          p: 0.25,
                          "& .MuiSvgIcon-root": { fontSize: 18 },
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: 13,
                          color: "text.primary",
                          userSelect: "none",
                        }}
                      >
                        {opt.label}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
              {groups.length > 0 && <Divider sx={{ my: 0.5 }} />}
            </>
          )}

          {groups.length === 0 && !hasSortControls ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography sx={{ fontSize: 12, color: "text.disabled" }}>
                No filters available
              </Typography>
            </Box>
          ) : (
            groups.map((group, groupIdx) => {
              const selected = new Set(value[group.id] ?? []);
              return (
                <React.Fragment key={group.id}>
                  {groupIdx > 0 && <Divider sx={{ my: 0.5 }} />}
                  <Box sx={{ px: 2, pt: 1.25, pb: 0.5 }}>
                    <Typography
                      variant="overline"
                      sx={{ display: "block", color: "text.disabled" }}
                    >
                      {group.label}
                    </Typography>
                  </Box>
                  <Box sx={{ pb: 0.5 }}>
                    {group.options.map((opt) => {
                      const isChecked = selected.has(opt.value);
                      return (
                        <Box
                          key={opt.value}
                          onClick={() => toggleOption(group.id, opt.value)}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.75,
                            mx: 1,
                            px: 1,
                            py: 0.5,
                            borderRadius: "6px",
                            cursor: "pointer",
                            "&:hover": { bgcolor: "surfaces.hover" },
                          }}
                        >
                          <Checkbox
                            size="small"
                            checked={isChecked}
                            tabIndex={-1}
                            disableRipple
                            sx={{
                              p: 0.25,
                              "& .MuiSvgIcon-root": { fontSize: 18 },
                            }}
                          />
                          <Typography
                            sx={{
                              fontSize: 13,
                              color: "text.primary",
                              userSelect: "none",
                            }}
                          >
                            {opt.label}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </React.Fragment>
              );
            })
          )}
        </Box>

        {typeof matchedCount === "number" && (
          <Box
            sx={{
              px: 2,
              py: 1,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              {matchedCount} {matchedCount === 1 ? "match" : "matches"}
            </Typography>
          </Box>
        )}
      </Popover>
    </>
  );
};

export default FilterButton;
