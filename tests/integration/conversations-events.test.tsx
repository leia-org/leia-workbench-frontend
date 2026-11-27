import { configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import axios from "axios";

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    token: "test-token" as string | null,
    user: { id: "admin-1", email: "admin@example.com", role: "admin" } as {
      id: string;
      email: string;
      role: string;
    } | null,
    logout: vi.fn(),
  },
}));

vi.mock("../../src/context/useAuth", () => ({
  useAuth: () => mockAuthState,
}));

import { Conversations } from "../../src/views/Conversations";

// Rendering a whole admin view in jsdom can take over a second when the
// suites run in parallel; the default wait of 1 s is too tight for that.
configure({ asyncUtilTimeout: 5000 });

const BACKEND = "http://localhost:3001";

const eventBase = (id: string, session: string, at: string) => ({
  id,
  session,
  replication: "rep-1",
  actor: "student",
  hasContent: true,
  contentTruncated: false,
  clientEventId: `client-${id}`,
  clientAt: at,
  seq: 0,
  at,
  createdAt: at,
});

const testRunEvent = (id: string, session: string, at: string) => ({
  ...eventBase(id, session, at),
  type: "test_run",
  source: "code_editor",
  payload: {
    language: "javascript",
    fnName: "twoSum",
    results: [{ name: "basic", ok: true }],
    error: null,
    durationMs: 9,
    status: "passed",
    passed: 1,
    failed: 0,
    total: 1,
  },
});

const clipboardEvent = (id: string, session: string, at: string, type = "clipboard_paste") => ({
  ...eventBase(id, session, at),
  type,
  source: "chat_input",
  payload: {
    method: "keyboard",
    length: 120,
    lines: 4,
    hash: "h",
    preview: `text of ${id}`,
    ...(type === "clipboard_paste" ? { origin: "external" } : {}),
  },
});

const presenceEvents = (session: string) => [
  {
    ...eventBase("leave-1", session, "2026-11-26T10:05:00.000Z"),
    type: "page_leave",
    source: "page",
    hasContent: false,
    payload: { reason: "hidden" },
  },
  {
    ...eventBase("return-1", session, "2026-11-26T10:05:42.000Z"),
    type: "page_return",
    source: "page",
    hasContent: false,
    payload: { awayMs: 42000, reason: "hidden", becameHidden: true },
  },
];

const conversation = (id: string, email: string, startedAt: string, extra: Record<string, unknown> = {}) => ({
  id,
  startedAt,
  finishedAt: null,
  result: null,
  evaluation: null,
  score: null,
  user: { email },
  messages: [
    { id: `${id}-m1`, text: `First message of ${id}`, isLeia: true, timestamp: "2026-11-26T10:00:00.000Z" },
    { id: `${id}-m2`, text: `Second message of ${id}`, isLeia: false, timestamp: "2026-11-26T10:10:00.000Z" },
  ],
  ...extra,
});

interface Backend {
  conversations: unknown[];
  /** What the events endpoint answers for each session. */
  events?: Record<string, () => Promise<unknown[]> | unknown[]>;
  replication?: Record<string, unknown>;
}

function mockBackend({ conversations, events = {}, replication }: Backend) {
  return vi.spyOn(axios, "get").mockImplementation(async (url: string) => {
    const eventsMatch = url.match(/\/sessions\/([^/]+)\/events$/);
    if (eventsMatch) {
      const list = (await events[eventsMatch[1]]?.()) ?? [];
      return { data: { events: list, total: list.length } };
    }
    if (url.endsWith("/csv")) return { data: new Blob(["a,b"]) };
    if (url.endsWith("/conversations")) return { data: conversations };
    return { data: replication ?? { name: "Events Rep", experiment: { leias: [] } } };
  });
}

function renderConversations() {
  return render(
    <MemoryRouter initialEntries={["/replications/rep-1/conversations"]}>
      <Routes>
        <Route path="/replications/:id/conversations" element={<Conversations />} />
      </Routes>
    </MemoryRouter>
  );
}

const eventsUrl = (sessionId: string) =>
  `${BACKEND}/api/v1/replications/rep-1/sessions/${sessionId}/events`;

const eventRequests = (spy: ReturnType<typeof mockBackend>) =>
  spy.mock.calls.map(([url]) => String(url)).filter((url) => url.endsWith("/events"));

const eventCards = () =>
  Array.from(document.querySelectorAll('[id^="session-event-"]')).map((el) => el.id);

const selectRow = (email: string) => {
  const row = screen
    .getAllByText(email)
    .map((el) => el.closest("button"))
    .find((button): button is HTMLButtonElement => button !== null);
  if (!row) throw new Error(`no row for ${email}`);
  fireEvent.click(row);
};

describe("Conversations — session events", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    mockAuthState.token = "test-token";
    mockAuthState.user = { id: "admin-1", email: "admin@example.com", role: "admin" };
    vi.stubEnv("VITE_APP_BACKEND", BACKEND);
    Element.prototype.scrollIntoView = vi.fn();
  });

  test("loads the events of a session when it is selected, marks them in the transcript and lists them", async () => {
    const getSpy = mockBackend({
      conversations: [
        conversation("sa", "alice@example.com", "2026-11-26T10:00:00Z", {
          eventCounts: { test_run: 1, clipboard_paste: 1, page_leave: 1, page_return: 1 },
          // Still sent during the transition; the view no longer reads them.
          testRuns: [],
          testRunCount: 9,
        }),
        conversation("sb", "bob@example.com", "2026-11-26T09:00:00Z"),
      ],
      events: {
        sa: () => [
          testRunEvent("run-1", "sa", "2026-11-26T10:02:00.000Z"),
          clipboardEvent("paste-1", "sa", "2026-11-26T10:04:00.000Z"),
          ...presenceEvents("sa"),
        ],
      },
    });

    renderConversations();
    await screen.findAllByText("alice@example.com");
    selectRow("alice@example.com");

    await waitFor(() => {
      expect(screen.getByText("Events (3)")).toBeTruthy();
      expect(eventCards()).toEqual([
        "session-event-run-1",
        "session-event-paste-1",
        "session-event-leave-1",
      ]);
    });
    expect(getSpy).toHaveBeenCalledWith(
      eventsUrl("sa"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      })
    );

    // Counters of the attempt in the list.
    expect(screen.getByTitle("1 test run · 1 clipboard event · 1 time away")).toBeTruthy();

    // The transcript has a marker for each event, between the two messages.
    const transcript = screen.getByText("First message of sa").closest(".MuiPaper-root") as HTMLElement;
    const lines = Array.from(transcript.querySelectorAll("button, p"))
      .map((el) => el.textContent ?? "")
      .filter((text) => /message of sa|Tests run|Pasted|Away/.test(text));
    expect(lines.map((text) => text.replace(/ · [^·]*$/, ""))).toEqual([
      "First message of sa",
      "Tests run by student · 1/1 passed",
      "Pasted 120 chars in Chat input · External",
      "Away 42 s · Tab hidden",
      "Second message of sa",
    ]);

    // A marker brings its entry of the section into view.
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this.id);
    });
    fireEvent.click(screen.getByText(/Pasted 120 chars in Chat input/).closest("button") as HTMLElement);
    expect(scrolled).toEqual(["session-event-paste-1"]);

    // A session without events asks for nothing and shows no section.
    selectRow("bob@example.com");
    await screen.findByText("First message of sb");
    expect(screen.queryByText(/^Events \(/)).toBeNull();
    expect(eventCards()).toEqual([]);
    expect(eventRequests(getSpy)).toEqual([eventsUrl("sa")]);
  });

  test("drops the response for a session that is no longer selected", async () => {
    let resolveSlow: (events: unknown[]) => void = () => {};
    const slow = new Promise<unknown[]>((resolve) => {
      resolveSlow = resolve;
    });
    const getSpy = mockBackend({
      conversations: [
        conversation("sa", "alice@example.com", "2026-11-26T10:00:00Z", {
          eventCounts: { test_run: 1 },
        }),
        conversation("sb", "bob@example.com", "2026-11-26T09:00:00Z", {
          eventCounts: { clipboard_copy: 1 },
        }),
      ],
      events: {
        sa: () => slow,
        sb: () => [clipboardEvent("copy-b", "sb", "2026-11-26T10:03:00.000Z", "clipboard_copy")],
      },
    });

    renderConversations();
    await screen.findAllByText("alice@example.com");
    selectRow("alice@example.com");
    await waitFor(() => {
      expect(eventRequests(getSpy)).toContain(eventsUrl("sa"));
    });
    expect(screen.getByText("Loading events…")).toBeTruthy();

    // The instructor moves on before the answer arrives.
    selectRow("bob@example.com");
    await waitFor(() => {
      expect(eventCards()).toEqual(["session-event-copy-b"]);
    });

    resolveSlow([testRunEvent("run-a", "sa", "2026-11-26T10:02:00.000Z")]);
    await slow;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(eventCards()).toEqual(["session-event-copy-b"]);
    expect(screen.queryByText(/Tests run by student/)).toBeNull();
    expect(screen.getByText("Events (1)")).toBeTruthy();
  });

  test("a failed load can be retried", async () => {
    let attempts = 0;
    mockBackend({
      conversations: [
        conversation("sa", "alice@example.com", "2026-11-26T10:00:00Z", {
          eventCounts: { test_run: 1 },
        }),
      ],
      events: {
        sa: () => {
          attempts += 1;
          if (attempts === 1) throw new Error("network");
          return [testRunEvent("run-1", "sa", "2026-11-26T10:02:00.000Z")];
        },
      },
    });

    renderConversations();

    await screen.findByText("The events could not be loaded.");
    // The counter still says there is something to show.
    expect(screen.getByText("Events (1)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(eventCards()).toEqual(["session-event-run-1"]);
    });
    expect(screen.queryByText("The events could not be loaded.")).toBeNull();
  });

  test("downloads the events CSV named after the replication", async () => {
    const getSpy = mockBackend({
      conversations: [conversation("sa", "alice@example.com", "2026-11-26T10:00:00Z")],
      replication: { name: "My  Rep 2026", experiment: { leias: [] } },
    });
    URL.createObjectURL = vi.fn(() => "blob:events");
    URL.revokeObjectURL = vi.fn();
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.getAttribute("download") ?? "");
    });

    renderConversations();

    // jsdom runs on localhost, which counts as a preview host.
    fireEvent.click(await screen.findByRole("button", { name: "Download events CSV" }));

    await waitFor(() => {
      expect(downloads).toEqual(["My_Rep_2026_events.csv"]);
    });
    expect(getSpy).toHaveBeenCalledWith(
      `${BACKEND}/api/v1/replications/rep-1/events/csv`,
      expect.objectContaining({
        responseType: "blob",
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      })
    );
  });

  test("offers the tests CSV only when there is a code editor or some test run", async () => {
    mockBackend({
      conversations: [
        conversation("sa", "alice@example.com", "2026-11-26T10:00:00Z", {
          eventCounts: { clipboard_copy: 2 },
          // The legacy field no longer counts.
          testRuns: [{ id: "legacy" }],
        }),
      ],
      events: { sa: () => [] },
    });

    const first = renderConversations();
    await screen.findByRole("button", { name: "Download events CSV" });
    await screen.findAllByText("alice@example.com");
    expect(screen.queryByRole("button", { name: "Download tests CSV" })).toBeNull();
    first.unmount();

    vi.restoreAllMocks();
    mockBackend({
      conversations: [
        conversation("sa", "alice@example.com", "2026-11-26T10:00:00Z", {
          eventCounts: { test_run: 1 },
        }),
      ],
      events: { sa: () => [testRunEvent("run-1", "sa", "2026-11-26T10:02:00.000Z")] },
    });
    renderConversations();
    expect(await screen.findByRole("button", { name: "Download tests CSV" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download events CSV" })).toBeTruthy();
  });
});
