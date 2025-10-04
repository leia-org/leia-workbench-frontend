import React from "react";
import { UserCircleIcon, ClockIcon, ChatBubbleLeftIcon } from "@heroicons/react/24/outline";

interface SessionCardProps {
  session: {
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
  };
  onWatch: () => void;
  onShareLink: () => void;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onWatch,
  onShareLink,
}) => {
  const getElapsedTime = () => {
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

  const getTimeAgo = () => {
    if (!session.lastMessage) return null;
    const now = new Date();
    const messageTime = new Date(session.lastMessage.timestamp);
    const diffMs = now.getTime() - messageTime.getTime();
    const minutes = Math.floor(diffMs / 60000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <UserCircleIcon className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {session.user.email}
            </p>
            <p className="text-xs text-gray-500">LEIA: {session.leia}</p>
          </div>
        </div>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            session.isActive
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {session.isActive ? "Active" : "Finished"}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <ChatBubbleLeftIcon className="w-4 h-4" />
          <span>{session.messageCount} messages</span>
        </div>
        <div className="flex items-center gap-1">
          <ClockIcon className="w-4 h-4" />
          <span>{getElapsedTime()}</span>
        </div>
        {session.lastMessage && (
          <span className="text-gray-400">{getTimeAgo()}</span>
        )}
      </div>

      {/* Last Message Preview */}
      {session.lastMessage && (
        <div className="bg-gray-50 rounded p-2 mb-3">
          <p className="text-xs text-gray-500 mb-1">
            {session.lastMessage.isLeia ? "🤖 LEIA" : "👤 User"}
          </p>
          <p className="text-sm text-gray-700 line-clamp-2">
            {session.lastMessage.text}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onWatch}
          className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
        >
          <svg
            className="w-4 h-4"
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
          Watch
        </button>
        <button
          onClick={onShareLink}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
          title="Share Link"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
