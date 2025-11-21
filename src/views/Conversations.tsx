import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import axios, { AxiosRequestConfig } from "axios";
import { Navbar } from "../components/Navbar";
import { ArrowDownTrayIcon, ArrowLeftIcon, UserCircleIcon } from "@heroicons/react/24/solid";

interface Message {
  id: string;
  text: string;
  isLeia: boolean;
  timestamp: string;
}

interface Session {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  result: string | null;
  evaluation: string | null;
  score: number | null;
  messages: Message[];
  user: {
    email: string;
  } | null;
}

const REPLICATION_TOKENS_KEY = "replicationTokens";

const readStoredReplicationTokens = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(REPLICATION_TOKENS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const Conversations: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [conversations, setConversations] = useState<Session[]>([]);
  const [replicationName, setReplicationName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [editingScore, setEditingScore] = useState<string | null>(null);
  const [scoreValue, setScoreValue] = useState<string>("");
  const adminSecret = localStorage.getItem("adminSecret");
  const isAdmin = Boolean(adminSecret);
  const [replicationToken, setReplicationToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (!id) return;
    setTokenReady(false);
    const tokens = readStoredReplicationTokens();
    const searchParams = new URLSearchParams(location.search);
    const tokenFromQuery = searchParams.get("token");

    if (tokenFromQuery) {
      tokens[id] = tokenFromQuery;
      localStorage.setItem(REPLICATION_TOKENS_KEY, JSON.stringify(tokens));
      setReplicationToken(tokenFromQuery);
    } else {
      setReplicationToken(tokens[id] || null);
    }
    setTokenReady(true);
  }, [id, location.search]);

  const buildRequestConfig = (
    config: AxiosRequestConfig = {}
  ): AxiosRequestConfig => {
    const headers = { ...(config.headers || {}) };
    if (adminSecret) {
      headers.Authorization = `Bearer ${adminSecret}`;
    }

    const params = { ...(config.params || {}) };
    if (replicationToken) {
      params.token = replicationToken;
    }

    const finalConfig: AxiosRequestConfig = { ...config };
    if (Object.keys(headers).length > 0) {
      finalConfig.headers = headers;
    }
    if (Object.keys(params).length > 0) {
      finalConfig.params = params;
    }
    return finalConfig;
  };

  useEffect(() => {
    if (!tokenReady || !id) return;
    const fetchConversations = async () => {
      try {
        const repResp = await axios.get(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}`,
          buildRequestConfig()
        );
        setReplicationName(repResp.data.name);

        const convResp = await axios.get<Session[]>(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/conversations`,
          buildRequestConfig()
        );
        setConversations(convResp.data);
      } catch (err: any) {
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          if (replicationToken) {
            alert("Invalid or expired replication token");
          } else {
            navigate("/login");
          }
        } else {
          console.error("Load error:", err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, [id, adminSecret, navigate, replicationToken, tokenReady]);

  const handleDownloadCSV = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/conversations/csv`,
        buildRequestConfig({ responseType: "blob" })
      );

      const blob = new Blob([response.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${replicationName.replace(/\s+/g, "_")}_conversations.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleEditScore = (sessionId: string, currentScore: number | null) => {
    setEditingScore(sessionId);
    setScoreValue(currentScore?.toString() || '');
  };

  const handleSaveScore = async (sessionId: string) => {
    try {
      const score = parseFloat(scoreValue);
      if (isNaN(score) || score < 0 || score > 100) {
        alert('Please enter a valid score between 0 and 100');
        return;
      }

      await axios.patch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/replications/${id}/sessions/${sessionId}/score`,
        { score },
        buildRequestConfig()
      );

      // Update local state
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === sessionId ? { ...conv, score } : conv
        )
      );

      setEditingScore(null);
      setScoreValue('');
    } catch (err) {
      console.error("Error updating score:", err);
      alert("Failed to update score");
    }
  };

  const handleCancelEdit = () => {
    setEditingScore(null);
    setScoreValue('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        {isAdmin && <Navbar />}
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {isAdmin && <Navbar />}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/replications/${id}`}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Conversations</h1>
              <p className="text-gray-600">{replicationName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/replications/${id}/live`}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              Live Dashboard
            </Link>
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Download CSV
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Sessions</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{conversations.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Completed</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {conversations.filter(c => c.finishedAt).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Avg Score</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {conversations.filter(c => c.score !== null).length > 0
                ? (conversations.reduce((acc, c) => acc + (c.score || 0), 0) /
                    conversations.filter(c => c.score !== null).length).toFixed(1)
                : 'N/A'}
            </p>
          </div>
        </div>

        {/* Conversations List */}
        <div className="space-y-4">
          {conversations.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No conversations yet
            </div>
          ) : (
            conversations.map((session) => (
              <div key={session.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Session Header */}
                <div
                  className="p-4 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <UserCircleIcon className="w-8 h-8 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {session.user?.email || 'Anonymous'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Started: {formatDate(session.startedAt)}
                          {session.finishedAt && ` • Finished: ${formatDate(session.finishedAt)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {editingScore === session.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={scoreValue}
                            onChange={(e) => setScoreValue(e.target.value)}
                            min="0"
                            max="100"
                            step="0.1"
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveScore(session.id);
                            }}
                            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelEdit();
                            }}
                            className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                            Score: {session.score ?? 'N/A'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditScore(session.id, session.score);
                            }}
                            className="text-gray-500 hover:text-blue-600 transition-colors"
                            title="Edit score"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                        </div>
                      )}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        session.finishedAt
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {session.finishedAt ? 'Completed' : 'In Progress'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Messages (Expandable) */}
                {expandedSession === session.id && (
                  <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                    {session.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.isLeia ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-lg px-4 py-2 rounded-lg ${
                            message.isLeia
                              ? 'bg-gray-100 text-gray-900'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          <p className="text-sm">{message.text}</p>
                          <p className={`text-xs mt-1 ${
                            message.isLeia ? 'text-gray-500' : 'text-blue-200'
                          }`}>
                            {formatDate(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {session.evaluation && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-semibold text-blue-900 mb-2">Evaluation</h4>
                        <p className="text-sm text-blue-800 whitespace-pre-wrap">{session.evaluation}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
