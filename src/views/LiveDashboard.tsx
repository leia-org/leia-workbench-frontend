import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import { SessionCard } from "../components/SessionCard";

interface LiveSession {
  id: string;
  user: { email: string; id: string };
  leia: string;
  startedAt: string;
  finishedAt?: string | null;
  isActive: boolean;
  messageCount: number;
  lastMessage?: {
    text: string;
    isLeia: boolean;
    timestamp: string;
  } | null;
}

interface CopyModalProps {
  isOpen: boolean;
  url: string;
  onClose: () => void;
}

const CopyModal: React.FC<CopyModalProps> = ({ isOpen, url, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full mx-4 shadow-xl">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Spectate Link Generated
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 mb-3">
            Share this link to allow others to spectate this session:
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
            <p className="text-sm font-mono text-gray-800 break-all">{url}</p>
          </div>
          <button
            onClick={handleCopy}
            className={`w-full px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              copied
                ? "bg-green-600 text-white"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {copied ? "✓ Copied!" : "Copy to Clipboard"}
          </button>
        </div>
      </div>
    </div>
  );
};

export const LiveDashboard = () => {
  const { id: replicationId } = useParams();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "finished">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [replicationName, setReplicationName] = useState("");
  const [copyModal, setCopyModal] = useState<{ isOpen: boolean; url: string }>({
    isOpen: false,
    url: "",
  });

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      const adminSecret = localStorage.getItem("adminSecret");
      const includeFinished = filter === "all" || filter === "finished";

      const response = await axios.get(
        `${
          import.meta.env.VITE_APP_BACKEND
        }/api/v1/spectator/replications/${replicationId}/sessions?includeFinished=${includeFinished}`,
        {
          headers: {
            Authorization: `Bearer ${adminSecret}`,
          },
        }
      );

      setSessions(response.data.sessions);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load sessions");
      setLoading(false);
    }
  }, [replicationId, filter]);

  // Get replication name
  useEffect(() => {
    const fetchReplication = async () => {
      try {
        const adminSecret = localStorage.getItem("adminSecret");
        const response = await axios.get(
          `${
            import.meta.env.VITE_APP_BACKEND
          }/api/v1/replications/${replicationId}`,
          {
            headers: {
              Authorization: `Bearer ${adminSecret}`,
            },
          }
        );
        setReplicationName(response.data.name);
      } catch (err) {
        console.error("Failed to fetch replication:", err);
      }
    };
    fetchReplication();
  }, [replicationId]);

  // Initial load
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Setup WebSocket
  useEffect(() => {
    const adminSecret = localStorage.getItem("adminSecret");
    if (!adminSecret || !replicationId) return;

    const newSocket = io(import.meta.env.VITE_APP_BACKEND, {
      auth: {
        token: adminSecret,
      },
    });

    newSocket.on("connect", () => {
      console.log("WebSocket connected");
      newSocket.emit("dashboard:join", replicationId);
    });

    newSocket.on(
      "session:message",
      (data: { sessionId: string; message: any }) => {
        setSessions((prev) =>
          prev.map((session) =>
            session.id === data.sessionId
              ? {
                  ...session,
                  messageCount: session.messageCount + 1,
                  lastMessage: data.message,
                }
              : session
          )
        );
      }
    );

    newSocket.on(
      "session:finished",
      (data: { sessionId: string; finishedAt: string }) => {
        setSessions((prev) =>
          prev.map((session) =>
            session.id === data.sessionId
              ? {
                  ...session,
                  finishedAt: data.finishedAt,
                  isActive: false,
                }
              : session
          )
        );
      }
    );

    newSocket.on("disconnect", () => {
      console.log("WebSocket disconnected");
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit("dashboard:leave", replicationId);
      newSocket.disconnect();
    };
  }, [replicationId]);

  const handleWatch = async (sessionId: string) => {
    try {
      const link = await handleShareLink(sessionId, false);
      window.open(link, "_blank");
    } catch (error) {
      console.error("Failed to open watch link:", error);
    }
  };

  const handleShareLink = async (sessionId: string, open: boolean = true) => {
    try {
      const adminSecret = localStorage.getItem("adminSecret");
      const response = await axios.post(
        `${
          import.meta.env.VITE_APP_BACKEND
        }/api/v1/spectator/sessions/${sessionId}/token`,
        { expiresIn: 3600 },
        {
          headers: {
            Authorization: `Bearer ${adminSecret}`,
          },
        }
      );
      if (!open) return response.data.spectateUrl;
      setCopyModal({
        isOpen: open,
        url: response.data.spectateUrl,
      });
    } catch (err: any) {
      alert("Failed to generate spectate link");
      console.error(err);
    }
  };

  const filteredSessions = sessions.filter((session) => {
    if (filter === "active") return session.isActive;
    if (filter === "finished") return !session.isActive;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading sessions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Live Sessions Dashboard
              </h1>
              <p className="text-sm text-gray-600 mt-1">{replicationName}</p>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              ← Back
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              All ({sessions.length})
            </button>
            <button
              onClick={() => setFilter("active")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === "active"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              Active ({sessions.filter((s) => s.isActive).length})
            </button>
          </div>
        </div>
      </div>

      {/* Sessions Grid */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No sessions found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onWatch={() => handleWatch(session.id)}
                onShareLink={() => handleShareLink(session.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Copy Modal */}
      <CopyModal
        isOpen={copyModal.isOpen}
        url={copyModal.url}
        onClose={() => setCopyModal({ isOpen: false, url: "" })}
      />
    </div>
  );
};
