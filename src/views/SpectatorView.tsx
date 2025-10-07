import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { UserCircleIcon } from "@heroicons/react/24/solid";
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
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="flex justify-between items-center px-4 py-3 border-b bg-white sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <img
            src="/logo/leia_main_dark.png"
            alt="LEIA Logo"
            className="w-6 h-6"
          />
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900">Spectator Mode</h1>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {isActive ? "Active" : "Finished"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
            <span>{getElapsedTime()}</span>
            <span>•</span>
            <span>{messages.length} messages</span>
          </div>
          <button
            onClick={handleCopyLink}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              copied
                ? "bg-green-600 text-white"
                : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
            }`}
          >
            {copied ? "✓ Copied!" : "Copy Link"}
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 pb-6 bg-gray-50">
        <div
          ref={messagesContainerRef}
          className="max-w-3xl mx-auto space-y-4 py-4"
        >
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No messages yet...</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={message.id || index}
                className={`flex items-end gap-2 ${
                  message.isLeia ? "flex-row" : "flex-row-reverse"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.isLeia ? "bg-blue-50" : "bg-blue-600"
                  }`}
                >
                  {message.isLeia ? (
                    <UserCircleIcon className="w-5 h-5 text-blue-700" />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-5 h-5 text-white"
                    >
                      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                    </svg>
                  )}
                </div>
                <div
                  className={`max-w-[85%] sm:max-w-[80%] px-4 py-2 break-words ${
                    message.isLeia
                      ? "bg-white border border-gray-200 text-gray-900 rounded-t-2xl rounded-r-2xl rounded-bl-md shadow-sm"
                      : "bg-blue-600 text-white rounded-t-2xl rounded-l-2xl rounded-br-md shadow-sm"
                  }`}
                >
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                    {message.text}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
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
