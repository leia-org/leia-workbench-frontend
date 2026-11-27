import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  EventCountsBadge,
  EventMarker,
  EventsSection,
} from "../../src/components/admin/EventsSection";
import {
  buildTimeline,
  type ClipboardEvent,
  type PageLeaveEvent,
  type PageReturnEvent,
  type SessionEventRecord,
  type TestRunEvent,
  type TimelineMarker,
} from "../../src/lib/events";

const base = (id: string, at: string) => ({
  id,
  session: "s1",
  replication: "rep-1",
  actor: "student" as const,
  hasContent: false,
  contentTruncated: false,
  clientEventId: `client-${id}`,
  clientAt: at,
  seq: 0,
  at,
  createdAt: at,
});

const testRun = (id: string, at: string, overrides: Partial<TestRunEvent> = {}): TestRunEvent => ({
  ...base(id, at),
  type: "test_run",
  source: "code_editor",
  hasContent: true,
  payload: {
    language: "javascript",
    fnName: "twoSum",
    results: [
      { name: "basic", ok: true },
      { name: "empty", ok: false, expected: "[]", actual: "undefined" },
    ],
    error: null,
    durationMs: 12,
    status: "failed",
    passed: 1,
    failed: 1,
    total: 2,
  },
  ...overrides,
});

const clipboard = (
  id: string,
  at: string,
  type: ClipboardEvent["type"],
  overrides: Partial<ClipboardEvent> = {},
): ClipboardEvent => ({
  ...base(id, at),
  type,
  source: "code_editor",
  hasContent: true,
  payload: { method: "keyboard", length: 80, lines: 3, hash: "h", preview: `preview of ${id}` },
  ...overrides,
});

const leave = (id: string, at: string): PageLeaveEvent => ({
  ...base(id, at),
  type: "page_leave",
  source: "page",
  payload: { reason: "hidden" },
});

const back = (id: string, at: string, awayMs: number): PageReturnEvent => ({
  ...base(id, at),
  type: "page_return",
  source: "page",
  payload: { awayMs, reason: "hidden", becameHidden: true },
});

// One event of each kind, deliberately out of order.
const sessionEvents = (): SessionEventRecord[] => [
  back("r1", "2026-11-26T10:06:42.000Z", 42000),
  clipboard("paste-1", "2026-11-26T10:08:00.000Z", "clipboard_paste", {
    source: "chat_input",
    payload: {
      method: "keyboard",
      length: 120,
      lines: 4,
      hash: "h2",
      preview: "function twoSum(nums",
      origin: "external",
    },
  }),
  testRun("run-1", "2026-11-26T10:02:00.000Z"),
  leave("l1", "2026-11-26T10:06:00.000Z"),
  clipboard("copy-1", "2026-11-26T10:04:00.000Z", "clipboard_copy"),
];

const formatDate = (s: string) => s.slice(11, 19);

const card = (id: string) => document.getElementById(`session-event-${id}`) as HTMLElement;

describe("EventsSection — instructor view of a session's events", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  test("lists every kind of event in the order it happened, with a total and a filter per group", () => {
    render(<EventsSection events={sessionEvents()} loadEvent={vi.fn()} formatDate={formatDate} />);

    expect(screen.getByText("Events (4)")).toBeTruthy();
    for (const label of ["All (4)", "Tests (1)", "Clipboard (2)", "Away (1)"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }

    // The leave and its return are one entry.
    const order = Array.from(document.querySelectorAll('[id^="session-event-"]')).map((el) => el.id);
    expect(order).toEqual([
      "session-event-run-1",
      "session-event-copy-1",
      "session-event-l1",
      "session-event-paste-1",
    ]);
    expect(card("r1")).toBeNull();
  });

  test("renders a test run with the card the test runs section used", () => {
    render(<EventsSection events={sessionEvents()} loadEvent={vi.fn()} formatDate={formatDate} />);

    const run = within(card("run-1"));
    expect(run.getByText("1/2 passed")).toBeTruthy();
    expect(run.getByText("Student")).toBeTruthy();
    expect(run.getByText("Run 1")).toBeTruthy();
    expect(run.getByText("Failed (1)")).toBeTruthy();
    expect(run.getByText(/expected \[\], got undefined/)).toBeTruthy();
    expect(run.getByText("Passed (1): basic")).toBeTruthy();
    expect(run.getByRole("button", { name: "View code at this run" })).toBeTruthy();
  });

  test("renders clipboard events with action, surface, origin, size and preview", () => {
    render(<EventsSection events={sessionEvents()} loadEvent={vi.fn()} formatDate={formatDate} />);

    const pasted = within(card("paste-1"));
    expect(pasted.getByText("Paste")).toBeTruthy();
    expect(pasted.getByText("Chat input")).toBeTruthy();
    expect(pasted.getByText("External")).toBeTruthy();
    expect(pasted.getByText("120 chars · 4 lines")).toBeTruthy();
    expect(pasted.getByText("function twoSum(nums")).toBeTruthy();
    expect(pasted.getByText("10:08:00 · Keyboard")).toBeTruthy();

    const copied = within(card("copy-1"));
    expect(copied.getByText("Copy")).toBeTruthy();
    expect(copied.getByText("Code editor")).toBeTruthy();
    expect(copied.getByText("80 chars · 3 lines")).toBeTruthy();
    // Only pastes have an origin.
    expect(copied.queryByText("External")).toBeNull();
    expect(copied.queryByText("Internal")).toBeNull();
  });

  test("tells where an internal paste was copied from", () => {
    const events = [
      clipboard("paste-2", "2026-11-26T10:08:00.000Z", "clipboard_paste", {
        source: "chat_input",
        payload: {
          method: "menu",
          length: 80,
          lines: 3,
          hash: "h",
          preview: "let x",
          wholeLine: true,
          origin: "internal",
          match: { clientEventId: "client-copy-1", sessionId: "s0", source: "code_editor", kind: "trimmed", ageMs: 12000 },
        },
      }),
    ];
    render(<EventsSection events={events} loadEvent={vi.fn()} formatDate={formatDate} />);

    const pasted = within(card("paste-2"));
    expect(pasted.getByText("Internal")).toBeTruthy();
    expect(
      pasted.getByText(
        "Same text as a copy or cut in Code editor, ignoring surrounding whitespace, 12 s earlier (in another stage)",
      ),
    ).toBeTruthy();
    expect(pasted.getByText("10:08:00 · Context menu · Whole line")).toBeTruthy();
    // A single group: no filter to choose from.
    expect(screen.queryByRole("button", { name: "All (1)" })).toBeNull();
  });

  test("shows an absence as one compact paired row", () => {
    const events = [
      ...sessionEvents(),
      leave("l2", "2026-11-26T10:30:00.000Z"),
    ];
    render(<EventsSection events={events} loadEvent={vi.fn()} formatDate={formatDate} />);

    const paired = within(card("l1"));
    expect(paired.getByText("Away 42 s")).toBeTruthy();
    expect(paired.getByText("Tab hidden")).toBeTruthy();
    expect(paired.getByText("10:06:00")).toBeTruthy();

    const open = within(card("l2"));
    expect(open.getByText("Left the page")).toBeTruthy();
    expect(open.getByText("10:30:00 · no return recorded")).toBeTruthy();
  });

  test("filters by group", () => {
    render(<EventsSection events={sessionEvents()} loadEvent={vi.fn()} formatDate={formatDate} />);

    fireEvent.click(screen.getByRole("button", { name: "Clipboard (2)" }));
    expect(card("copy-1")).toBeTruthy();
    expect(card("paste-1")).toBeTruthy();
    expect(card("run-1")).toBeNull();
    expect(card("l1")).toBeNull();
    expect(screen.getByRole("button", { name: "Clipboard (2)" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Away (1)" }));
    expect(card("l1")).toBeTruthy();
    expect(card("copy-1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tests (1)" }));
    expect(card("run-1")).toBeTruthy();
    expect(card("l1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "All (4)" }));
    expect(document.querySelectorAll('[id^="session-event-"]')).toHaveLength(4);
  });

  test("asks for the full text of a clipboard event only when it is opened", async () => {
    const loadEvent = vi.fn(async (eventId: string) => ({
      ...clipboard(eventId, "2026-11-26T10:08:00.000Z", "clipboard_paste"),
      content: "function twoSum(nums, target) {\n  return [];\n}",
      contentTruncated: true,
    }));
    render(<EventsSection events={sessionEvents()} loadEvent={loadEvent} formatDate={formatDate} />);
    expect(loadEvent).not.toHaveBeenCalled();

    const pasted = within(card("paste-1"));
    fireEvent.click(pasted.getByRole("button", { name: "View full text" }));

    expect(loadEvent).toHaveBeenCalledTimes(1);
    expect(loadEvent).toHaveBeenCalledWith("paste-1");
    await waitFor(() => {
      expect(pasted.getByText(/return \[\];/)).toBeTruthy();
    });
    expect(pasted.getByText("The text was longer than the stored limit and is cut here.")).toBeTruthy();

    // Closing and reopening does not ask again.
    fireEvent.click(pasted.getByRole("button", { name: "Hide full text" }));
    fireEvent.click(pasted.getByRole("button", { name: "View full text" }));
    expect(loadEvent).toHaveBeenCalledTimes(1);
  });

  test("offers no full text when none was stored", () => {
    const events = [clipboard("copy-empty", "2026-11-26T10:04:00.000Z", "clipboard_copy", { hasContent: false })];
    render(<EventsSection events={events} loadEvent={vi.fn()} formatDate={formatDate} />);
    expect(screen.queryByRole("button", { name: "View full text" })).toBeNull();
  });

  test("a failed content request can be retried", async () => {
    const loadEvent = vi
      .fn<(eventId: string) => Promise<SessionEventRecord>>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        ...clipboard("copy-1", "2026-11-26T10:04:00.000Z", "clipboard_copy"),
        content: "the copied text",
      });
    render(<EventsSection events={sessionEvents()} loadEvent={loadEvent} formatDate={formatDate} />);

    const copied = within(card("copy-1"));
    fireEvent.click(copied.getByRole("button", { name: "View full text" }));
    await waitFor(() => {
      expect(copied.getByText("The text could not be loaded.")).toBeTruthy();
    });

    fireEvent.click(copied.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(copied.getByText("the copied text")).toBeTruthy();
    });
    expect(loadEvent).toHaveBeenCalledTimes(2);
  });

  test("loads the code of a test run from its own event", async () => {
    const loadEvent = vi.fn(async (eventId: string) => ({
      ...testRun(eventId, "2026-11-26T10:02:00.000Z"),
      content: "const answer = 42;",
    }));
    const events = [
      ...sessionEvents(),
      testRun("run-2", "2026-11-26T10:09:00.000Z", { hasContent: false }),
    ];
    render(<EventsSection events={events} loadEvent={loadEvent} formatDate={formatDate} />);

    const first = within(card("run-1"));
    fireEvent.click(first.getByRole("button", { name: "View code at this run" }));
    expect(loadEvent).toHaveBeenCalledWith("run-1");
    await waitFor(() => {
      expect(card("run-1").textContent).toContain("const answer = 42;");
    });

    // The second run of the session, with no code stored: nothing to request.
    const second = within(card("run-2"));
    expect(second.getByText("Run 2")).toBeTruthy();
    fireEvent.click(second.getByRole("button", { name: "View code at this run" }));
    expect(second.getByText("No code was stored for this run.")).toBeTruthy();
    expect(loadEvent).toHaveBeenCalledTimes(1);
  });

  test("goes by the counters while the list is loading, and lets a failed load be retried", () => {
    const onRetry = vi.fn();
    const counts = { test_run: 2, clipboard_paste: 3, page_leave: 1, page_return: 1 };
    const { rerender } = render(
      <EventsSection events={[]} counts={counts} loading loadEvent={vi.fn()} formatDate={formatDate} />
    );

    expect(screen.getByText("Events (6)")).toBeTruthy();
    expect(screen.getByText("Loading events…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clipboard (3)" })).toBeTruthy();

    rerender(
      <EventsSection
        events={[]}
        counts={counts}
        error
        onRetry={onRetry}
        loadEvent={vi.fn()}
        formatDate={formatDate}
      />
    );
    expect(screen.queryByText("Loading events…")).toBeNull();
    expect(screen.getByText("The events could not be loaded.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("renders nothing for a session without events", () => {
    const { container } = render(
      <EventsSection events={[]} counts={{ test_run: 0 }} loadEvent={vi.fn()} formatDate={formatDate} />
    );
    expect(container.textContent).toBe("");
  });

  test("scrolls to the focused entry and highlights it for a moment", () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <EventsSection events={sessionEvents()} loadEvent={vi.fn()} formatDate={formatDate} focus={null} />
      );
      const scroll = vi.fn();
      card("copy-1").scrollIntoView = scroll;

      rerender(
        <EventsSection
          events={sessionEvents()}
          loadEvent={vi.fn()}
          formatDate={formatDate}
          focus={{ id: "copy-1", at: 1 }}
        />
      );
      expect(scroll).toHaveBeenCalledTimes(1);
      expect(getComputedStyle(card("copy-1")).borderColor).not.toBe(
        getComputedStyle(card("paste-1")).borderColor
      );

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(getComputedStyle(card("copy-1")).borderColor).toBe(getComputedStyle(card("paste-1")).borderColor);
    } finally {
      vi.useRealTimers();
    }
  });

  test("a focused entry hidden by the filter is brought back before scrolling to it", () => {
    const Harness = () => {
      const [focus, setFocus] = useState<{ id: string; at: number } | null>(null);
      return (
        <>
          <button onClick={() => setFocus({ id: "l1", at: Date.now() })}>focus the absence</button>
          <EventsSection events={sessionEvents()} loadEvent={vi.fn()} formatDate={formatDate} focus={focus} />
        </>
      );
    };
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Tests (1)" }));
    expect(card("l1")).toBeNull();

    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this.id);
    });
    fireEvent.click(screen.getByRole("button", { name: "focus the absence" }));

    expect(card("l1")).toBeTruthy();
    expect(scrolled).toEqual(["session-event-l1"]);
    expect(screen.getByRole("button", { name: "All (4)" }).getAttribute("aria-pressed")).toBe("true");
  });

  test("a focused entry already listed under the current filter keeps that filter", () => {
    const { rerender } = render(
      <EventsSection events={sessionEvents()} loadEvent={vi.fn()} formatDate={formatDate} focus={null} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Clipboard (2)" }));

    rerender(
      <EventsSection
        events={sessionEvents()}
        loadEvent={vi.fn()}
        formatDate={formatDate}
        focus={{ id: "paste-1", at: 1 }}
      />
    );
    expect(screen.getByRole("button", { name: "Clipboard (2)" }).getAttribute("aria-pressed")).toBe("true");
    expect(card("run-1")).toBeNull();
  });
});

describe("EventMarker — events inside a transcript", () => {
  const markers = (events: SessionEventRecord[]): TimelineMarker[] =>
    buildTimeline([] as Array<{ id: string; timestamp: string }>, events).filter(
      (item): item is TimelineMarker => item.kind !== "message"
    );

  test("describes test runs, clipboard events and absences", () => {
    const onClick = vi.fn();
    const all = markers(sessionEvents());
    render(
      <>
        {all.map((marker) => (
          <EventMarker key={marker.key} marker={marker} formatDate={formatDate} onClick={onClick} />
        ))}
      </>
    );

    const buttons = screen.getAllByRole("button", { name: /./ });
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Tests run by student · 1/2 passed · 10:02:00",
      "Copied 80 chars from Code editor · 10:04:00",
      "Away 42 s · Tab hidden · 10:06:00",
      "Pasted 120 chars in Chat input · External · 10:08:00",
    ]);

    fireEvent.click(buttons[3]);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("is not a control without a click handler", () => {
    const [marker] = markers([testRun("run-1", "2026-11-26T10:02:00.000Z", { actor: "leia" })]);
    render(<EventMarker marker={marker} formatDate={formatDate} />);
    const button = screen.getByText(/Tests run by LEIA/).closest("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});

describe("EventCountsBadge — counters of a row", () => {
  test("shows one counter per group that has events", () => {
    render(
      <EventCountsBadge
        counts={{ test_run: 3, clipboard_copy: 1, clipboard_paste: 1, page_leave: 1, page_return: 1 }}
      />
    );
    const badge = screen.getByTitle("3 test runs · 2 clipboard events · 1 time away");
    expect(badge.textContent).toBe("321");
  });

  test("leaves out empty groups and renders nothing without events", () => {
    const { rerender, container } = render(<EventCountsBadge counts={{ test_run: 1 }} />);
    expect(screen.getByTitle("1 test run").textContent).toBe("1");

    rerender(<EventCountsBadge counts={{ page_return: 2 }} />);
    expect(container.textContent).toBe("");
    rerender(<EventCountsBadge counts={null} />);
    expect(container.textContent).toBe("");
  });
});
