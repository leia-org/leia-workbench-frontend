import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Rnd } from "react-rnd";
import axios from "axios";
import { UserCircleIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { ChatMarkdown } from "../components/ChatMarkdown";
import { PersonaAvatar } from "../components/PersonaAvatar";
import { buildOriginalAvatarPath } from "../lib/avatar";

export interface PreviousConversationMessage {
  id?: string;
  text: string;
  isLeia: boolean;
  timestamp?: string | Date;
  sequence?: number;
  senderType?: "participant" | "agent" | "system";
  senderId?: string;
  senderName?: string;
}

export interface PreviousConversationActor {
  id: string;
  name: string;
  avatar?: string | null;
  leiaId?: string | null;
  personaId?: string | null;
}

export interface PreviousConversationPayload {
  stage: {
    number: number;
    total: number;
  };
  availability: "chat" | "editor" | "both";
  interactionMode: "single" | "multi";
  mode: string;
  audioMode?: "realtime" | "luke" | null;
  leiaName: string;
  personaAvatar?: string | null;
  leiaId?: string | null;
  personaId?: string | null;
  actors?: PreviousConversationActor[];
  externalTranscriptionLink?: string | null;
  messages: PreviousConversationMessage[];
}

export interface PreviousConversationWidgetProps {
  sessionId: string;
  stageNumber: number;
  view: "chat" | "editor";
  onClose: () => void;
}

function getInitialWindowRect() {
  if (typeof window === "undefined") {
    return { x: 352, y: 64, width: 420, height: 480 };
  }
  const width = Math.min(420, Math.max(280, window.innerWidth - 32));
  const height = Math.min(480, Math.max(260, window.innerHeight - 120));
  const x = Math.max(16, Math.min(window.innerWidth - width - 16, 352));
  return { x, y: 64, width, height };
}

function formatMessageTime(value?: string | Date): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const PreviousConversationWidget: React.FC<PreviousConversationWidgetProps> = ({
  sessionId,
  stageNumber,
  view,
  onClose,
}) => {
  const [initialRect] = useState(getInitialWindowRect);
  const [data, setData] = useState<PreviousConversationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<PreviousConversationPayload>(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/${sessionId}/previous-conversation`,
        { params: { view } },
      );
      setData(response.data);
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ||
          err.response?.data?.error ||
          "Could not load the previous conversation."
        : "Could not load the previous conversation.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [sessionId, view]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get<PreviousConversationPayload>(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/${sessionId}/previous-conversation`,
          { params: { view } },
        );
        if (active) setData(response.data);
      } catch (err: unknown) {
        if (!active) return;
        const message = axios.isAxiosError(err)
          ? err.response?.data?.message ||
            err.response?.data?.error ||
            "Could not load the previous conversation."
          : "Could not load the previous conversation.";
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [sessionId, view]);

  const actorsById = useMemo(
    () => new Map((data?.actors || []).map((actor) => [actor.id, actor])),
    [data?.actors],
  );

  const fallbackAvatar = useMemo(() => {
    if (!data) return null;
    return (
      buildOriginalAvatarPath("personas", data.personaId || "") ||
      buildOriginalAvatarPath("leias", data.leiaId || "") ||
      null
    );
  }, [data]);

  const sortedMessages = useMemo(() => {
    if (!data?.messages?.length) return [];
    return [...data.messages].sort((a, b) => {
      if (a.sequence !== undefined && b.sequence !== undefined) {
        return a.sequence - b.sequence;
      }
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });
  }, [data?.messages]);

  const displayStageNumber = data?.stage?.number ?? stageNumber;
  const renderMarkdownForLeia =
    data?.audioMode !== "realtime" && data?.audioMode !== "luke";

  return (
    <Rnd
      default={initialRect}
      minWidth={280}
      minHeight={220}
      bounds="window"
      dragHandleClassName="previous-conversation-drag-handle"
      style={{ zIndex: 60 }}
      className="rounded-lg border border-gray-300 bg-white shadow-lg overflow-hidden"
    >
      <div
        className="flex flex-col h-full w-full"
        role="region"
        aria-label={`Stage ${displayStageNumber} conversation`}
      >
        <div className="previous-conversation-drag-handle cursor-move bg-gray-100 border-b border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 select-none flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <ChatBubbleLeftRightIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />
            <span className="truncate">
              Conversation · Stage {displayStageNumber}
            </span>
            {!loading && !error && data && (
              <span className="text-[11px] font-normal text-gray-500 flex-shrink-0">
                ({sortedMessages.length})
              </span>
            )}
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            aria-label="Close conversation"
            className="text-gray-500 hover:text-gray-700 p-0.5 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 bg-gray-50 space-y-3">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500 py-8">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Loading conversation...</span>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-4 py-8">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => void loadConversation()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : data?.externalTranscriptionLink && sortedMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-4 py-8">
              <p className="text-sm text-gray-600">
                Stage {displayStageNumber} used an external transcription.
              </p>
              <button
                type="button"
                onClick={() =>
                  window.open(
                    data.externalTranscriptionLink!,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Open Transcription
              </button>
            </div>
          ) : sortedMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center px-4 py-8">
              <p className="text-sm text-gray-500">
                No messages were recorded in Stage {displayStageNumber}.
              </p>
            </div>
          ) : (
            sortedMessages.map((msg, index) => {
              const actor = msg.senderId
                ? actorsById.get(msg.senderId)
                : undefined;
              const actorName =
                msg.senderName || actor?.name || data?.leiaName || "LEIA";
              const actorAvatar = actor?.avatar || data?.personaAvatar || null;
              const actorAvatarFallback = actor
                ? buildOriginalAvatarPath("personas", actor.personaId || "") ||
                  buildOriginalAvatarPath("leias", actor.leiaId || "")
                : fallbackAvatar;
              const timeLabel = formatMessageTime(msg.timestamp);

              return (
                <div
                  key={msg.id || index}
                  className={`flex items-end gap-2 ${
                    msg.isLeia ? "flex-row" : "flex-row-reverse"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ${
                      msg.isLeia ? "bg-blue-50" : "bg-blue-600"
                    }`}
                  >
                    {msg.isLeia ? (
                      actorAvatar || actorAvatarFallback ? (
                        <PersonaAvatar
                          src={actorAvatar}
                          fallbackSrc={actorAvatarFallback}
                          alt={`${actorName} avatar`}
                          label={actorName}
                          size="sm"
                        />
                      ) : (
                        <UserCircleIcon className="w-5 h-5 text-blue-700" />
                      )
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4 text-white"
                      >
                        <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                      </svg>
                    )}
                  </div>

                  <div
                    className={`min-w-0 max-w-[85%] px-3 py-2 break-words ${
                      msg.isLeia
                        ? "bg-white border border-gray-200 text-gray-900 rounded-t-2xl rounded-r-2xl rounded-bl-md shadow-sm"
                        : "bg-blue-600 text-white rounded-t-2xl rounded-l-2xl rounded-br-md shadow-sm"
                    }`}
                  >
                    {msg.isLeia && (
                      <p className="mb-0.5 text-[11px] font-semibold text-blue-700">
                        {actorName}
                      </p>
                    )}
                    {msg.isLeia && renderMarkdownForLeia ? (
                      <div className="text-sm leading-relaxed">
                        <ChatMarkdown text={msg.text} />
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.text}
                      </p>
                    )}
                    {timeLabel && (
                      <p
                        className={`mt-1 text-[10px] ${
                          msg.isLeia ? "text-gray-400" : "text-blue-100"
                        }`}
                      >
                        {timeLabel}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Rnd>
  );
};

export default PreviousConversationWidget;
