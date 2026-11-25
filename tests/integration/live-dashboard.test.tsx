import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import axios from "axios";

const { mockIo, mockAuthState } = vi.hoisted(() => ({
  mockIo: vi.fn(() => ({
    on: vi.fn(),
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
}));

vi.mock("socket.io-client", () => ({
  io: mockIo,
}));

vi.mock("../../src/context/useAuth", () => ({
  useAuth: () => mockAuthState,
}));

import { LiveDashboard } from "../../src/views/LiveDashboard";

describe("LiveDashboard staged activities", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockIo.mockClear();
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
