import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Collapse,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import NotesIcon from "@mui/icons-material/Notes";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { describeTestRun } from "../../lib/testRuns";
import {
  EVENT_GROUPS,
  EVENT_GROUP_LABELS,
  awayReasonLabel,
  buildEventItems,
  clipboardMethodLabel,
  countEventGroups,
  describeAway,
  describeClipboardEvent,
  describeClipboardSize,
  eventSourceLabel,
  eventTypeLabel,
  formatDuration,
  isTestRunEvent,
  toTestRunRecord,
  type AwayInterval,
  type ClipboardEvent,
  type EventCounts,
  type EventGroup,
  type SessionEventRecord,
  type TimelineMarker,
} from "../../lib/events";
import { MONO, TEST_STATUS_STYLE, chipSx, neutralChipSx } from "./eventStyles";
import { TestRunCard } from "./TestRunCard";

// Instructor view of what a student did in a session besides writing
// messages: test runs of the code editor, what was copied, cut and pasted and
// where, and when the student left the page. One section with a filter per
// group and a renderer per type of event.

const eventElementId = (id: string) => `session-event-${id}`;

const CLIPBOARD_ICONS = {
  clipboard_copy: ContentCopyIcon,
  clipboard_cut: ContentCutIcon,
  clipboard_paste: ContentPasteIcon,
} as const;

const EXTERNAL_STYLE = { color: "warning.main", bgcolor: "rgba(217,119,6,0.08)" } as const;

const originLabel = (origin: string) => (origin === "external" ? "External" : "Internal");

// — transcript marker -----------------------------------------------------

/** Compact line shown inside a transcript at the moment an event happened. */
export const EventMarker: React.FC<{
  marker: TimelineMarker;
  formatDate: (s: string) => string;
  onClick?: () => void;
}> = ({ marker, formatDate, onClick }) => {
  let icon: React.ReactNode;
  let text: React.ReactNode;

  if (marker.kind === "away") {
    const { interval } = marker;
    icon = <VisibilityOffOutlinedIcon sx={{ fontSize: 14 }} />;
    text = (
      <>
        {describeAway(interval)} · {awayReasonLabel(interval)} · {formatDate(interval.startAt)}
      </>
    );
  } else if (isTestRunEvent(marker.event)) {
    const run = toTestRunRecord(marker.event);
    const style = TEST_STATUS_STYLE[run.status] ?? TEST_STATUS_STYLE.error;
    icon = <PlayArrowRoundedIcon sx={{ fontSize: 14, color: style.color }} />;
    text = (
      <>
        Tests run by {run.trigger === "leia" ? "LEIA" : "student"} ·{" "}
        <Box component="span" sx={{ color: style.color, fontWeight: 600 }}>
          {describeTestRun(run)}
        </Box>{" "}
        · {formatDate(run.createdAt)}
      </>
    );
  } else {
    const { event } = marker;
    const Icon = CLIPBOARD_ICONS[event.type] ?? ContentCopyIcon;
    const origin = event.type === "clipboard_paste" ? event.payload?.origin : undefined;
    icon = <Icon sx={{ fontSize: 13 }} />;
    text = (
      <>
        {describeClipboardEvent(event)}
        {origin && (
          <>
            {" · "}
            <Box
              component="span"
              sx={origin === "external" ? { color: EXTERNAL_STYLE.color, fontWeight: 600 } : undefined}
            >
              {originLabel(origin)}
            </Box>
          </>
        )}{" "}
        · {formatDate(event.at)}
      </>
    );
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center" }}>
      <ButtonBase
        onClick={onClick}
        disabled={!onClick}
        title={onClick ? "Show this event" : undefined}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          px: 1.25,
          py: 0.25,
          borderRadius: 999,
          border: "1px dashed",
          borderColor: "divider",
          fontSize: 11,
          color: "text.secondary",
          "&:hover": { bgcolor: "surfaces.hover" },
        }}
      >
        {icon}
        <span>{text}</span>
      </ButtonBase>
    </Box>
  );
};

// — counters for list rows ------------------------------------------------

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Per-group counters of a session (or attempt) for the rows of a list. */
export const EventCountsBadge: React.FC<{ counts?: EventCounts | null }> = ({ counts }) => {
  const groups = countEventGroups(counts);
  if (groups.total === 0) return null;

  const entries = [
    { key: "tests", count: groups.tests, Icon: PlayArrowRoundedIcon, text: plural(groups.tests, "test run", "test runs") },
    { key: "clipboard", count: groups.clipboard, Icon: ContentPasteIcon, text: plural(groups.clipboard, "clipboard event", "clipboard events") },
    { key: "away", count: groups.away, Icon: VisibilityOffOutlinedIcon, text: plural(groups.away, "time away", "times away") },
  ].filter((entry) => entry.count > 0);

  return (
    <Box
      component="span"
      title={entries.map((entry) => entry.text).join(" · ")}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        fontSize: 11,
        fontWeight: 600,
        color: "text.secondary",
        lineHeight: 1,
      }}
    >
      {entries.map(({ key, count, Icon }) => (
        <Box key={key} component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}>
          <Icon sx={{ fontSize: 12 }} />
          {count}
        </Box>
      ))}
    </Box>
  );
};

// — renderers -------------------------------------------------------------

type ContentState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; content: string; truncated: boolean };

const ClipboardCard: React.FC<{
  event: ClipboardEvent;
  formatDate: (s: string) => string;
  highlighted: boolean;
  open: boolean;
  onToggle: () => void;
  content: ContentState | undefined;
  onRetry: () => void;
}> = ({ event, formatDate, highlighted, open, onToggle, content, onRetry }) => {
  const payload = event.payload ?? ({} as ClipboardEvent["payload"]);
  const isPaste = event.type === "clipboard_paste";
  const origin = isPaste ? payload.origin : undefined;
  const match = isPaste ? payload.match : undefined;
  const details = [
    formatDate(event.at),
    payload.method ? clipboardMethodLabel(payload.method) : null,
    payload.wholeLine ? "Whole line" : null,
  ].filter(Boolean);

  return (
    <Paper
      id={eventElementId(event.id)}
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2,
        borderColor: highlighted ? "primary.main" : "divider",
        transition: "border-color 0.3s",
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 0.5 }}>
        <Chip
          size="small"
          label={eventTypeLabel(event.type)}
          sx={{ ...chipSx, bgcolor: "surfaces.accent", color: "primary.dark" }}
        />
        <Chip size="small" label={eventSourceLabel(event.source)} sx={neutralChipSx} />
        {origin && (
          <Chip
            size="small"
            label={originLabel(origin)}
            title={
              origin === "external"
                ? "The text was not copied inside the activity"
                : "The text was copied inside the activity"
            }
            sx={origin === "external" ? { ...chipSx, ...EXTERNAL_STYLE } : neutralChipSx}
          />
        )}
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary" }}>
          {describeClipboardSize(payload)}
        </Typography>
        <Typography sx={{ fontSize: 12, color: "text.disabled" }}>{details.join(" · ")}</Typography>
      </Stack>

      {match && (
        <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.5 }}>
          {/* The match says where the text was taken from, not whether it
              was copied or cut there. */}
          Same text as a copy or cut in {eventSourceLabel(match.source)}
          {match.kind === "trimmed" ? ", ignoring surrounding whitespace" : ""}
          {typeof match.ageMs === "number" ? `, ${formatDuration(match.ageMs)} earlier` : ""}
          {match.sessionId && match.sessionId !== event.session ? " (in another stage)" : ""}
        </Typography>
      )}

      {payload.preview ? (
        <Box sx={{ mt: 0.75, px: 1, py: 0.75, borderRadius: 1, bgcolor: "surfaces.subtle" }}>
          {/* Three lines at most; the padding stays outside so a fourth
              line never peeks through it. */}
          <Typography
            component="pre"
            sx={{
              m: 0,
              fontFamily: MONO,
              fontSize: 12,
              lineHeight: "18px",
              color: "text.primary",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 54,
              overflow: "hidden",
            }}
          >
            {payload.preview}
          </Typography>
        </Box>
      ) : null}

      {event.hasContent && (
        <>
          <Button
            size="small"
            color="inherit"
            startIcon={<NotesIcon sx={{ fontSize: 14 }} />}
            onClick={onToggle}
            sx={{ mt: 0.75, fontSize: 12, color: "text.secondary", textTransform: "none" }}
          >
            {open ? "Hide full text" : "View full text"}
          </Button>
          <Collapse in={open} unmountOnExit>
            <Paper
              variant="outlined"
              sx={{
                mt: 0.5,
                borderRadius: 2,
                bgcolor: "surfaces.subtle",
                maxHeight: 420,
                overflow: "auto",
              }}
            >
              {content?.status === "loaded" ? (
                <>
                  <Typography
                    component="pre"
                    sx={{
                      m: 0,
                      px: 2,
                      py: 1.5,
                      fontFamily: MONO,
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: "text.primary",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {content.content || " "}
                  </Typography>
                  {content.truncated && (
                    <Typography sx={{ fontSize: 11, color: "text.disabled", px: 2, pb: 1 }}>
                      The text was longer than the stored limit and is cut here.
                    </Typography>
                  )}
                </>
              ) : (
                <Stack direction="row" alignItems="center" gap={1} sx={{ p: 2 }}>
                  {content?.status === "loading" && <CircularProgress size={14} />}
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: content?.status === "error" ? "error.main" : "text.secondary",
                    }}
                  >
                    {content?.status === "error" ? "The text could not be loaded." : "Loading text…"}
                  </Typography>
                  {content?.status === "error" && (
                    <Button size="small" onClick={onRetry} sx={{ fontSize: 12 }}>
                      Retry
                    </Button>
                  )}
                </Stack>
              )}
            </Paper>
          </Collapse>
        </>
      )}
    </Paper>
  );
};

const AwayRow: React.FC<{
  interval: AwayInterval;
  formatDate: (s: string) => string;
  highlighted: boolean;
}> = ({ interval, formatDate, highlighted }) => (
  <Box
    id={eventElementId(interval.id)}
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1,
      flexWrap: "wrap",
      px: 1.5,
      py: 0.75,
      borderRadius: 2,
      border: "1px dashed",
      borderColor: highlighted ? "primary.main" : "divider",
      transition: "border-color 0.3s",
    }}
  >
    <VisibilityOffOutlinedIcon sx={{ fontSize: 14, color: "text.disabled" }} />
    <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary" }}>
      {describeAway(interval)}
    </Typography>
    <Chip size="small" label={awayReasonLabel(interval)} sx={neutralChipSx} />
    <Typography sx={{ fontSize: 12, color: "text.disabled" }}>
      {formatDate(interval.startAt)}
      {interval.endAt === null ? " · no return recorded" : ""}
    </Typography>
  </Box>
);

// — section ---------------------------------------------------------------

type Filter = "all" | EventGroup;

interface EventsSectionProps {
  /** The session's events, without their content. */
  events: SessionEventRecord[];
  /** Per-type totals of the session, known before `events` is loaded. */
  counts?: EventCounts | null;
  /** The request that brings `events` is on its way. */
  loading?: boolean;
  /** That request failed. */
  error?: boolean;
  onRetry?: () => void;
  /** Fetches one event with its content: the code of a test run or the
   *  clipboard text. Called when the instructor opens it. */
  loadEvent: (eventId: string) => Promise<SessionEventRecord>;
  formatDate: (s: string) => string;
  /** Entry to scroll to and highlight. `at` changes on every request so the
   *  same entry can be focused again. */
  focus?: { id: string; at: number } | null;
}

export const EventsSection: React.FC<EventsSectionProps> = ({
  events,
  counts,
  loading = false,
  error = false,
  onRetry,
  loadEvent,
  formatDate,
  focus,
}) => {
  const [filter, setFilter] = useState<Filter>("all");
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [contentById, setContentById] = useState<Record<string, ContentState>>({});
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [handledFocus, setHandledFocus] = useState(focus ?? null);

  const items = useMemo(() => buildEventItems(events), [events]);

  // A focused entry hidden by the current filter has to be listed before it
  // can be scrolled to; adjusted while rendering so the effect below already
  // finds it.
  if (focus && focus !== handledFocus) {
    setHandledFocus(focus);
    const target = items.find((item) => item.id === focus.id);
    if (target && filter !== "all" && filter !== target.group) setFilter("all");
  }

  useEffect(() => {
    if (!focus) return;
    document
      .getElementById(eventElementId(focus.id))
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(focus.id);
    const timer = window.setTimeout(() => setHighlightId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [focus]);

  const fetchContent = useCallback(
    async (eventId: string) => {
      setContentById((prev) => ({ ...prev, [eventId]: { status: "loading" } }));
      try {
        const full = await loadEvent(eventId);
        setContentById((prev) => ({
          ...prev,
          [eventId]: {
            status: "loaded",
            content: full?.content ?? "",
            truncated: full?.contentTruncated === true,
          },
        }));
      } catch {
        setContentById((prev) => ({ ...prev, [eventId]: { status: "error" } }));
      }
    },
    [loadEvent]
  );

  const toggleContent = (event: SessionEventRecord) => {
    const opening = !openIds[event.id];
    setOpenIds((prev) => ({ ...prev, [event.id]: opening }));
    // The content travels on demand, one event at a time; a failed request is
    // tried again when the entry is reopened.
    const state = contentById[event.id];
    if (opening && event.hasContent && (!state || state.status === "error")) {
      void fetchContent(event.id);
    }
  };

  // Until the list arrives (or if the counters are ahead of it) the header
  // goes by the counters.
  const expected = countEventGroups(counts);
  const groupCounts: Record<EventGroup, number> = { tests: 0, clipboard: 0, away: 0 };
  for (const item of items) groupCounts[item.group]++;
  for (const group of EVENT_GROUPS) groupCounts[group] = Math.max(groupCounts[group], expected[group]);
  const total = EVENT_GROUPS.reduce((sum, group) => sum + groupCounts[group], 0);

  if (total === 0 && !loading && !error) return null;

  const visibleGroups = EVENT_GROUPS.filter((group) => groupCounts[group] > 0);
  const visibleItems = filter === "all" ? items : items.filter((item) => item.group === filter);
  const filters: Array<{ key: Filter; label: string }> = [
    { key: "all", label: `All (${total})` },
    ...visibleGroups.map((group) => ({
      key: group as Filter,
      label: `${EVENT_GROUP_LABELS[group]} (${groupCounts[group]})`,
    })),
  ];

  return (
    <>
      <Typography
        variant="overline"
        sx={{ display: "block", mb: 1.5, color: "text.disabled" }}
      >
        Events ({total})
      </Typography>

      {visibleGroups.length > 1 && (
        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mb: 1.5 }}>
          {filters.map(({ key, label }) => {
            const active = filter === key;
            return (
              <Chip
                key={key}
                size="small"
                variant={active ? "filled" : "outlined"}
                color={active ? "primary" : "default"}
                label={label}
                aria-pressed={active}
                onClick={() => setFilter(key)}
                sx={{ height: 22, fontSize: 11, fontWeight: active ? 600 : 500 }}
              />
            );
          })}
        </Stack>
      )}

      {error ? (
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: 12, color: "error.main" }}>
            The events could not be loaded.
          </Typography>
          {onRetry && (
            <Button size="small" onClick={onRetry} sx={{ fontSize: 12 }}>
              Retry
            </Button>
          )}
        </Stack>
      ) : loading && items.length === 0 ? (
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
          <CircularProgress size={14} />
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>Loading events…</Typography>
        </Stack>
      ) : null}

      <Stack gap={1.5} sx={{ mb: 1 }}>
        {visibleItems.map((item) => {
          if (item.kind === "away") {
            return (
              <AwayRow
                key={item.id}
                interval={item.interval}
                formatDate={formatDate}
                highlighted={highlightId === item.id}
              />
            );
          }

          const { event } = item;
          const content = contentById[event.id];
          if (item.kind === "clipboard") {
            return (
              <ClipboardCard
                key={item.id}
                event={item.event}
                formatDate={formatDate}
                highlighted={highlightId === item.id}
                open={Boolean(openIds[event.id])}
                onToggle={() => toggleContent(event)}
                content={content}
                onRetry={() => void fetchContent(event.id)}
              />
            );
          }

          return (
            <TestRunCard
              key={item.id}
              run={toTestRunRecord(item.event)}
              number={item.number}
              formatDate={formatDate}
              elementId={eventElementId(event.id)}
              highlighted={highlightId === item.id}
              codeOpen={Boolean(openIds[event.id])}
              onToggleCode={() => toggleContent(event)}
              code={content?.status === "loaded" ? content.content : undefined}
              codeTruncated={content?.status === "loaded" && content.truncated}
              codeLoading={content?.status === "loading"}
              codeError={content?.status === "error" ? "The code could not be loaded." : null}
              codeMissing={!event.hasContent}
              onRetryCode={() => void fetchContent(event.id)}
            />
          );
        })}
      </Stack>
    </>
  );
};

export default EventsSection;
