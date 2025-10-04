import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import { scrollUtils } from "../lib/utils";

interface Message {
  text: string;
  timestamp: Date;
  isLeia: boolean;
  id?: string;
}

interface Session {
  isTest: boolean;
  startedAt: string;
  finishedAt: string | null;
  isRunnerInitialized: boolean;
  result: string | null;
  evaluation: string | null;
  score: number | null;
}

export const SpectatorView = () => {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [copied, setCopied] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      scrollUtils.scrollToElement(messagesEndRef.current);
    }
  }, []);

  // Fetch initial session data
  useEffect(() => {
    const fetchSession = async () => {
      if (!token) {
        setError("Spectate token is required");
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/spectator/sessions/${sessionId}?token=${token}`
        );

        setSession(response.data.session);
        setIsActive(response.data.isActive);

        // Extract messages from populated session
        const sessionMessages = response.data.session.messages || [];
        setMessages(
          sessionMessages.map((msg: any) => ({
            id: msg.id,
            text: msg.text,
            isLeia: msg.isLeia,
            timestamp: new Date(msg.timestamp),
          }))
        );

        setLoading(false);
        setTimeout(scrollToBottom, 100);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load session");
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId, token, scrollToBottom]);

  // Setup WebSocket
  useEffect(() => {
    if (!token || !sessionId) return;

    const newSocket = io(import.meta.env.VITE_APP_BACKEND, {
      auth: {
        token: token,
      },
    });

    newSocket.on("connect", () => {
      console.log("Spectator WebSocket connected");
      newSocket.emit("spectate:join", sessionId);
    });

    newSocket.on("spectate:joined", () => {
      console.log("Joined spectate room");
    });

    newSocket.on("message:new", (message: any) => {
      setMessages((prev) => [
        ...prev,
        {
          id: message.id,
          text: message.text,
          isLeia: message.isLeia,
          timestamp: new Date(message.timestamp),
        },
      ]);
      setTimeout(scrollToBottom, 100);
    });

    newSocket.on("session:finished", () => {
      setIsActive(false);
    });

    newSocket.on("disconnect", () => {
      console.log("Spectator WebSocket disconnected");
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit("spectate:leave", sessionId);
      newSocket.disconnect();
    };
  }, [sessionId, token, scrollToBottom]);

  const getElapsedTime = () => {
    if (!session) return "0m";
    const start = new Date(session.startedAt);
    const end = session.finishedAt ? new Date(session.finishedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg text-gray-600">Loading session...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-lg text-red-600 mb-4">{error}</div>
          <p className="text-sm text-gray-600">
            Please check your spectate link and try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold">
                🔴 SPECTATOR MODE
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>⏱️ {getElapsedTime()}</span>
                <span>•</span>
                <span>💬 {messages.length} messages</span>
                <span>•</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    isActive
                      ? "bg-green-500 text-white"
                      : "bg-gray-500 text-white"
                  }`}
                >
                  {isActive ? "Active" : "Finished"}
                </span>
              </div>
            </div>
            <button
              onClick={handleCopyLink}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                copied
                  ? "bg-green-500 text-white"
                  : "bg-white/10 hover:bg-white/20 backdrop-blur-sm"
              }`}
            >
              {copied ? "✓ Link Copied!" : "🔗 Copy Spectate Link"}
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-hidden">
        <div
          ref={messagesContainerRef}
          className="h-full overflow-y-auto px-6 py-6"
        >
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No messages yet...</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={message.id || index}
                  className={`flex ${message.isLeia ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      message.isLeia
                        ? "bg-white border border-gray-200 shadow-sm"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">
                        {message.isLeia ? "🤖 LEIA" : "👤 User"}
                      </span>
                      <span
                        className={`text-xs ${
                          message.isLeia ? "text-gray-400" : "text-blue-100"
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.text}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t px-6 py-3">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-500">
          You are viewing this conversation in spectator mode (read-only)
        </div>
      </footer>
    </div>
  );
};
