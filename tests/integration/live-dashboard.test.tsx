import { act, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import axios from "axios";

type SocketHandler = (...args: unknown[]) => void;

const { mockIo, mockAuthState, socketHandlers } = vi.hoisted(() => {
  // Handlers the dashboard registers, so a test can deliver socket events.
  const handlers = new Map<string, SocketHandler>();
  return {
    socketHandlers: handlers,
    mockIo: vi.fn(() => ({
      on: vi.fn((event: string, cb: SocketHandler) => {
        handlers.set(event, cb);
      }),
      emit: vi.fn(),
      disconnect: vi.fn(),
    })),
    mockAuthState: {
      token: "test-token" as string | null,
      user: { id: "admin-1", email: "admin@example.com", role: "admin" } as {
        id: string;
        email: string;
        role: string;
      } | null,
      logout: vi.fn(),
    },
  };
});

vi.mock("socket.io-client", () => ({
  io: mockIo,
}));

vi.mock("../../src/context/useAuth", () => ({
  useAuth: () => mockAuthState,
}));

import { LiveDashboard } from "../../src/views/LiveDashboard";

// Rendering a whole admin view in jsdom can take over a second when the
// suites run in parallel; the default wait of 1 s is too tight for that.
configure({ asyncUtilTimeout: 5000 });

describe("LiveDashboard staged activities", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockIo.mockClear();
    socketHandlers.clear();
    localStorage.clear();
    mockAuthState.token = "test-token";
    mockAuthState.user = { id: "admin-1", email: "admin@example.com", role: "admin" };
    vi.stubEnv("VITE_APP_BACKEND", "http://localhost:3001");
  });

  test("renders staged sessions without crashing", async () => {
    vi.spyOn(axios, "get").mockImplementation(async (url: string) => {
      if (url.includes("/sessions")) {
        return {
          data: {
            sessions: [
              {
                id: "s1",
                runId: "run-1",
                stageId: "st-1",
                stageNumber: 1,
                stageTotal: 2,
                user: { id: "u1", email: "alice@example.com" },
                leia: "slot-1",
                startedAt: "2026-11-20T10:00:00Z",
                finishedAt: "2026-11-20T10:05:00Z",
                isActive: false,
                messageCount: 2,
                lastMessage: { text: "Done stage 1", isLeia: false, timestamp: "2026-11-20T10:05:00Z" },
              },
              {
                id: "s2",
                runId: "run-1",
                stageId: "st-2",
                stageNumber: 2,
                stageTotal: 2,
                user: { id: "u1", email: "alice@example.com" },
                leia: "slot-2",
                startedAt: "2026-11-20T10:06:00Z",
                finishedAt: null,
                isActive: true,
                messageCount: 1,
                lastMessage: { text: "Hello stage 2", isLeia: true, timestamp: "2026-11-20T10:06:30Z" },
              },
            ],
          },
        };
      }
      return {
        data: {
          name: "Staged Rep",
          experiment: {
            stages: [{ id: "st-1" }, { id: "st-2" }],
            leias: [
              { id: "slot-1", leia: { id: "l1", metadata: { name: "LEIA 1" }, spec: {} } },
              { id: "slot-2", leia: { id: "l2", metadata: { name: "LEIA 2" }, spec: {} } },
            ],
          },
        },
      };
    });

    render(
      <MemoryRouter initialEntries={["/replications/rep-1/live"]}>
        <Routes>
          <Route path="/replications/:id/live" element={<LiveDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("alice@example.com").length).toBeGreaterThan(0);
      expect(screen.getByText("Stage 2/2")).toBeTruthy();
      expect(screen.getByText("Stage 2 of 2")).toBeTruthy();
    });
  });

  test("handles missing sessions or leias arrays gracefully without crashing", async () => {
    vi.spyOn(axios, "get").mockImplementation(async (url: string) => {
      if (url.includes("/sessions")) {
        return { data: {} };
      }
      return { data: { name: "Empty Rep", experiment: {} } };
    });

    render(
      <MemoryRouter initialEntries={["/replications/rep-2/live"]}>
        <Routes>
          <Route path="/replications/:id/live" element={<LiveDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No sessions yet.")).toBeTruthy();
    });
  });

  test("sends bearer token on HTTP and WebSocket auth for advanced users", async () => {
    mockAuthState.token = "advanced-jwt-token";
    mockAuthState.user = { id: "adv-1", email: "adv@example.com", role: "advanced" };

    const getSpy = vi.spyOn(axios, "get").mockImplementation(async (url: string) => {
      if (url.includes("/sessions")) {
        return { data: { sessions: [] } };
      }
      return { data: { name: "Advanced Rep", experiment: { leias: [] } } };
    });

    render(
      <MemoryRouter initialEntries={["/replications/rep-adv/live"]}>
        <Routes>
          <Route path="/replications/:id/live" element={<LiveDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No sessions yet.")).toBeTruthy();
    });

    expect(getSpy).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/spectator/replications/rep-adv/sessions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer advanced-jwt-token",
        }),
      })
    );
    expect(getSpy).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/replications/rep-adv",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer advanced-jwt-token",
        }),
      })
    );
    expect(mockIo).toHaveBeenCalledWith("http://localhost:3001", {
      auth: { token: "advanced-jwt-token" },
    });
  });

  test("forwards both user token and shareToken when an advanced user opens a shared live link", async () => {
    mockAuthState.token = "advanced-jwt-token";
    mockAuthState.user = { id: "adv-1", email: "adv@example.com", role: "advanced" };

    const getSpy = vi.spyOn(axios, "get").mockImplementation(async (url: string) => {
      if (url.includes("/sessions")) {
        return { data: { sessions: [] } };
      }
      return { data: { name: "Shared Rep", experiment: { leias: [] } } };
    });

    render(
      <MemoryRouter initialEntries={["/replications/rep-shared/live?token=share-123"]}>
        <Routes>
          <Route path="/replications/:id/live" element={<LiveDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No sessions yet.")).toBeTruthy();
    });

    expect(getSpy).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/spectator/replications/rep-shared/sessions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer advanced-jwt-token",
        }),
        params: expect.objectContaining({
          token: "share-123",
        }),
      })
    );
    expect(mockIo).toHaveBeenCalledWith("http://localhost:3001", {
      auth: { token: "advanced-jwt-token", shareToken: "share-123" },
    });
  });
});

// — session events ------------------------------------------------------

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

const pasteEvent = (id: string, session: string, at: string) => ({
  ...eventBase(id, session, at),
  type: "clipboard_paste",
  source: "chat_input",
  payload: {
    method: "keyboard",
    length: 120,
    lines: 4,
    hash: "h",
    preview: `pasted text of ${id}`,
    origin: "external",
  },
});

const presenceEvents = (session: string) => [
  {
    ...eventBase("leave-1", session, "2026-11-26T10:06:00.000Z"),
    type: "page_leave",
    source: "page",
    hasContent: false,
    payload: { reason: "hidden" },
  },
  {
    ...eventBase("return-1", session, "2026-11-26T10:06:42.000Z"),
    type: "page_return",
    source: "page",
    hasContent: false,
    payload: { awayMs: 42000, reason: "hidden", becameHidden: true },
  },
];

const liveSession = (id: string, email: string, startedAt: string, extra: Record<string, unknown> = {}) => ({
  id,
  user: { id: `user-${id}`, email },
  leia: "slot-1",
  startedAt,
  finishedAt: null,
  isActive: true,
  messageCount: 1,
  lastMessage: { text: `Hello from ${id}`, isLeia: false, timestamp: startedAt },
  ...extra,
});

describe("LiveDashboard session events", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockIo.mockClear();
    socketHandlers.clear();
    localStorage.clear();
    mockAuthState.token = "test-token";
    mockAuthState.user = { id: "admin-1", email: "admin@example.com", role: "admin" };
    vi.stubEnv("VITE_APP_BACKEND", "http://localhost:3001");
  });

  const eventsUrl = (sessionId: string) =>
    `http://localhost:3001/api/v1/replications/rep-1/sessions/${sessionId}/events`;

  // `sessions` is what the dashboard loads; `eventsBySession` what the events
  // endpoint lists for each session; `contentByEvent` the content the
  // single-event endpoint adds.
  function mockBackend(
    sessions: unknown[],
    eventsBySession: Record<string, Array<{ id: string }>> = {},
    contentByEvent: Record<string, string> = {}
  ) {
    return vi.spyOn(axios, "get").mockImplementation(async (url: string) => {
      const eventMatch = url.match(/\/sessions\/([^/]+)\/events\/([^/]+)$/);
      if (eventMatch) {
        const event = (eventsBySession[eventMatch[1]] ?? []).find((e) => e.id === eventMatch[2]);
        return { data: { event: { ...event, content: contentByEvent[eventMatch[2]] } } };
      }
      const eventsMatch = url.match(/\/sessions\/([^/]+)\/events$/);
      if (eventsMatch) {
        const events = eventsBySession[eventsMatch[1]] ?? [];
        return { data: { events, total: events.length } };
      }
      if (url.includes("/spectator/replications/")) return { data: { sessions } };
      return { data: { name: "Events Rep", experiment: { leias: [] } } };
    });
  }

  function renderDashboard() {
    return render(
      <MemoryRouter initialEntries={["/replications/rep-1/live"]}>
        <Routes>
          <Route path="/replications/:id/live" element={<LiveDashboard />} />
        </Routes>
      </MemoryRouter>
    );
  }

  const deliver = (payload: unknown) => {
    act(() => {
      socketHandlers.get("session:events")?.(payload);
    });
  };

  const eventCards = () =>
    Array.from(document.querySelectorAll('[id^="session-event-"]')).map((el) => el.id);

  test("shows the counters of each session and loads the events of the selected one", async () => {
    const getSpy = mockBackend(
      [
        // Started last, so it is listed first and selected.
        liveSession("s1", "alice@example.com", "2026-11-26T10:00:00Z", {
          eventCounts: { test_run: 2, clipboard_paste: 1 },
          // Still sent during the transition; the view no longer reads them.
          testRuns: [],
          testRunCount: 7,
        }),
        liveSession("s2", "bob@example.com", "2026-11-26T09:00:00Z"),
      ],
      {
        s1: [
          testRunEvent("run-1", "s1", "2026-11-26T10:01:00.000Z"),
          testRunEvent("run-2", "s1", "2026-11-26T10:03:00.000Z"),
          pasteEvent("paste-1", "s1", "2026-11-26T10:02:00.000Z"),
        ],
      }
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Events (3)")).toBeTruthy();
      expect(eventCards()).toEqual([
        "session-event-run-1",
        "session-event-paste-1",
        "session-event-run-2",
      ]);
    });

    expect(screen.getByTitle("2 test runs · 1 clipboard event")).toBeTruthy();
    expect(screen.queryByText("▶ 7")).toBeNull();
    expect(getSpy).toHaveBeenCalledWith(
      eventsUrl("s1"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      })
    );
    // Sessions that are not selected, or have no events, are not asked for.
    expect(getSpy.mock.calls.filter(([url]) => String(url).endsWith("/events"))).toHaveLength(1);
  });

  test("session:events adds the batch to the selected session and keeps the highest counters", async () => {
    const getSpy = mockBackend(
      [
        liveSession("s1", "alice@example.com", "2026-11-26T10:00:00Z", {
          eventCounts: { test_run: 1 },
        }),
        liveSession("s2", "bob@example.com", "2026-11-26T09:00:00Z"),
      ],
      { s1: [testRunEvent("run-1", "s1", "2026-11-26T10:01:00.000Z")] }
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Events (1)")).toBeTruthy();
      expect(socketHandlers.has("session:events")).toBe(true);
    });
    expect(screen.getByTitle("1 test run")).toBeTruthy();

    // A batch for the selected session: one emission, several events.
    deliver({
      sessionId: "s1",
      events: [pasteEvent("paste-1", "s1", "2026-11-26T10:02:00.000Z"), ...presenceEvents("s1")],
      counts: { test_run: 1, clipboard_paste: 1, page_leave: 1, page_return: 1 },
    });

    expect(screen.getByText("Events (3)")).toBeTruthy();
    expect(eventCards()).toEqual([
      "session-event-run-1",
      "session-event-paste-1",
      "session-event-leave-1",
    ]);
    expect(screen.getByText("Away 42 s")).toBeTruthy();
    expect(screen.getByTitle("1 test run · 1 clipboard event · 1 time away")).toBeTruthy();

    // The same batch again, late and with older counters: nothing doubles
    // and no counter goes down.
    deliver({
      sessionId: "s1",
      events: [pasteEvent("paste-1", "s1", "2026-11-26T10:02:00.000Z")],
      counts: { test_run: 0, clipboard_paste: 1 },
    });

    expect(screen.getByText("Events (3)")).toBeTruthy();
    expect(eventCards()).toHaveLength(3);
    expect(screen.getByTitle("1 test run · 1 clipboard event · 1 time away")).toBeTruthy();

    // A batch for another session only moves that session's counters.
    deliver({
      sessionId: "s2",
      events: [testRunEvent("run-9", "s2", "2026-11-26T10:05:00.000Z")],
      counts: { test_run: 4 },
    });

    expect(screen.getByTitle("4 test runs")).toBeTruthy();
    expect(eventCards()).toHaveLength(3);
    expect(document.getElementById("session-event-run-9")).toBeNull();
    expect(getSpy.mock.calls.filter(([url]) => String(url).endsWith("/events"))).toHaveLength(1);
  });

  test("a selected session with no events shows its first batch and then loads the list", async () => {
    const backendEvents: Record<string, Array<{ id: string }>> = {};
    const getSpy = mockBackend(
      [liveSession("s1", "alice@example.com", "2026-11-26T10:00:00Z")],
      backendEvents
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByText("alice@example.com").length).toBeGreaterThan(0);
      expect(socketHandlers.has("session:events")).toBe(true);
    });
    expect(screen.queryByText(/^Events \(/)).toBeNull();
    expect(getSpy.mock.calls.some(([url]) => String(url).endsWith("/events"))).toBe(false);

    // By the time the batch is announced the backend has stored it, along
    // with an earlier event this dashboard never heard about.
    const stored = [
      testRunEvent("run-0", "s1", "2026-11-26T10:00:30.000Z"),
      testRunEvent("run-1", "s1", "2026-11-26T10:01:00.000Z"),
    ];
    backendEvents.s1 = stored;
    deliver({ sessionId: "s1", events: [stored[1]], counts: { test_run: 2 } });

    await waitFor(() => {
      expect(eventCards()).toEqual(["session-event-run-0", "session-event-run-1"]);
    });
    expect(screen.getByText("Events (2)")).toBeTruthy();
    expect(getSpy).toHaveBeenCalledWith(eventsUrl("s1"), expect.anything());
  });

  test("the content of an event is requested when it is opened", async () => {
    const getSpy = mockBackend(
      [
        liveSession("s1", "alice@example.com", "2026-11-26T10:00:00Z", {
          eventCounts: { clipboard_paste: 1 },
        }),
      ],
      { s1: [pasteEvent("paste-1", "s1", "2026-11-26T10:02:00.000Z")] },
      { "paste-1": "the whole pasted text" }
    );

    renderDashboard();

    const button = await screen.findByRole("button", { name: "View full text" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("the whole pasted text")).toBeTruthy();
    });
    expect(getSpy).toHaveBeenCalledWith(
      `${eventsUrl("s1")}/paste-1`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      })
    );
  });
});
