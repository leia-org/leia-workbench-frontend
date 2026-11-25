import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckIcon, UserCircleIcon } from "@heroicons/react/24/solid";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { io } from "socket.io-client";
import RubricEvaluationView, {
  type RubricEvaluationResult,
} from "../components/RubricEvaluationView";

interface Message {
  text: string;
  timestamp: Date | string;
  isLeia: boolean;
  id?: string;
  session?: string;
  senderName?: string;
}

interface Session {
  id?: string;
  isTest: boolean;
  startedAt: string;
  finishedAt: string | null;
  isRunnerInitialized: boolean;
  result: string | null;
  evaluation: string | null;
  evaluationMode?: "none" | "classic" | "rubric" | null;
  rubricEvaluation?: RubricEvaluationResult | null;
  score: number | null;
  runId?: string;
  stage?: {
    number: number;
    total: number;
    hasNext: boolean;
  };
}

interface RunStageSummary {
  sessionId: string;
  stageId: string | null;
  stageIndex: number;
  stageNumber: number;
  stageTotal: number;
  startedAt: string;
  finishedAt: string | null;
  isActive: boolean;
  messageCount: number;
  hasSubmittedSolution: boolean;
  mode?: string;
  leiaName?: string | null;
}

interface LeiaConfiguration {
  mode?: string;
  askSolution?: boolean;
  evaluateSolution?: boolean;
  evaluationMode?: "none" | "classic" | "rubric";
  showSolution?: boolean;
  data?: {
    messages?: Message[];
    link?: string;
  };
}

interface SpectatorLeiaData {
  showEvaluation?: boolean;
  configuration?: LeiaConfiguration;
  leia?: {
    spec?: {
      problem?: {
        spec?: {
          solutionFormat?: string;
        };
      };
    };
  };
}

function resolveCanShowEvaluation(leia?: SpectatorLeiaData | null): boolean {
  if (typeof leia?.showEvaluation === "boolean") {
    return leia.showEvaluation;
  }
  const cfg = leia?.configuration;
  if (!cfg) return false;
  const evaluationMode =
    cfg.evaluationMode ?? (cfg.evaluateSolution ? "classic" : "none");
  if (evaluationMode === "none") return false;
  return (
    (Boolean(cfg.askSolution) || evaluationMode === "rubric") &&
    cfg.showSolution !== false
  );
}

export const SpectatorView = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingStage, setSwitchingStage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [runStages, setRunStages] = useState<RunStageSummary[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [canShowEvaluation, setCanShowEvaluation] = useState(false);
  const [solutionFormat, setSolutionFormat] = useState<string | null>(null);
  const [externalTranscriptionLink, setExternalTranscriptionLink] = useState<
    string | null
  >(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState("standard");

  const hasLoadedOnceRef = useRef(false);
  const canShowEvaluationRef = useRef(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    canShowEvaluationRef.current = canShowEvaluation;
  }, [canShowEvaluation]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, []);

  const liveStage = useMemo(() => {
    if (runStages.length === 0) return null;
    return runStages.find((stage) => stage.isActive) ?? runStages[runStages.length - 1];
  }, [runStages]);

  const liveSessionId = liveStage?.sessionId ?? sessionId ?? null;

  const totalStages = useMemo(() => {
    const fromSession = session?.stage?.total ?? 0;
    const fromRun = runStages.reduce(
      (max, item) => Math.max(max, item.stageTotal || 0, item.stageNumber || 0),
      0
    );
    return Math.max(fromSession, fromRun);
  }, [session?.stage?.total, runStages]);

  const isStaged = totalStages > 1 || runStages.length > 1;

  const isViewingPreviousStage = Boolean(
    liveStage &&
      sessionId &&
      liveStage.sessionId !== sessionId &&
      liveStage.isActive
  );

  const navigateToStage = useCallback(
    (targetSessionId: string) => {
      if (!token || !targetSessionId || targetSessionId === sessionId) return;
      navigate(
        `/spectate/${targetSessionId}?token=${encodeURIComponent(token)}`,
        { replace: true }
      );
    },
    [navigate, sessionId, token]
  );

  // Fetch session data whenever sessionId or token changes
  useEffect(() => {
    let cancelled = false;

    const fetchSession = async () => {
      if (!token) {
        setError("Spectate token is required");
        setLoading(false);
        return;
      }

      if (!sessionId) {
        setError("Session ID is required");
        setLoading(false);
        return;
      }

      if (hasLoadedOnceRef.current) {
        setSwitchingStage(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await axios.get(
          `${
            import.meta.env.VITE_APP_BACKEND
          }/api/v1/spectator/sessions/${sessionId}?token=${encodeURIComponent(token)}`
        );

        if (cancelled) return;

        const fetchedSession: Session = response.data.session;
        const fetchedLeia: SpectatorLeiaData | undefined = response.data.leia;
        const stageCanShowEvaluation = resolveCanShowEvaluation(fetchedLeia);

        setSession(fetchedSession);
        setIsActive(!fetchedSession.finishedAt);
        setCanShowEvaluation(stageCanShowEvaluation);
        canShowEvaluationRef.current = stageCanShowEvaluation;

        const leiaMode = fetchedLeia?.configuration?.mode || "standard";
        setMode(leiaMode);

        const format =
          fetchedLeia?.leia?.spec?.problem?.spec?.solutionFormat ?? null;
        setSolutionFormat(
          typeof format === "string" && format.trim() ? format.trim() : null
        );

        let rawMessages: Message[] = Array.isArray(response.data.messages)
          ? response.data.messages
          : [];
        let extLink: string | null = null;

        if (leiaMode === "transcription") {
          if (Array.isArray(fetchedLeia?.configuration?.data?.messages)) {
            rawMessages = fetchedLeia.configuration.data.messages;
          } else if (
            typeof fetchedLeia?.configuration?.data?.link === "string" &&
            fetchedLeia.configuration.data.link.trim()
          ) {
            extLink = fetchedLeia.configuration.data.link.trim();
          }
        }
        setExternalTranscriptionLink(extLink);

        const sortedMessages = [...rawMessages]
          .sort(
            (a: Message, b: Message) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          )
          .map((msg: Message, index: number) => ({
            ...msg,
            id:
              msg.id ||
              `msg-${index}-${new Date(msg.timestamp || 0).getTime()}`,
          }));
        setMessages(sortedMessages);

        if (Array.isArray(response.data.runStages)) {
          setRunStages(response.data.runStages);
        }

        hasLoadedOnceRef.current = true;
        setLoading(false);
        setSwitchingStage(false);
        setTimeout(scrollToBottom, 100);
      } catch (err: unknown) {
        if (cancelled) return;
        const message =
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : "Failed to load session";
        setError(message);
        setLoading(false);
        setSwitchingStage(false);
      }
    };

    void fetchSession();

    return () => {
      cancelled = true;
    };
  }, [sessionId, token, scrollToBottom]);

  // Setup WebSocket — join the currently viewed session room, plus the live stage
  // session room when inspecting a previous stage so live stage transitions stay synced.
  useEffect(() => {
    if (!token || !sessionId) return;

    const watchedRooms = [sessionId];
    if (liveSessionId && liveSessionId !== sessionId) {
      watchedRooms.push(liveSessionId);
    }

    const newSocket = io(import.meta.env.VITE_APP_BACKEND, {
      auth: {
        jwt: token,
      },
    });

    newSocket.on("connect", () => {
      for (const roomSessionId of watchedRooms) {
        newSocket.emit("spectate:join", roomSessionId);
      }
    });

    newSocket.on("message:new", (message: Message) => {
      const msgSessionId = message?.session
        ? String(message.session)
        : sessionId;

      if (msgSessionId === sessionId) {
        setMessages((prev) => {
          if (message.id && prev.some((existing) => existing.id === message.id)) {
            return prev;
          }
          return [
            ...prev,
            {
              id: message.id,
              text: message.text,
              isLeia: message.isLeia,
              senderName: message.senderName,
              session: msgSessionId,
              timestamp: new Date(message.timestamp),
            },
          ];
        });
        setTimeout(scrollToBottom, 100);
      }

      setRunStages((prev) =>
        prev.map((stage) =>
          stage.sessionId === msgSessionId
            ? { ...stage, messageCount: stage.messageCount + 1 }
            : stage
        )
      );
    });

    newSocket.on(
      "session:finished",
      (payload?: {
        sessionId?: string;
        finishedAt?: string;
        result?: string | null;
      }) => {
        const finishedId = payload?.sessionId
          ? String(payload.sessionId)
          : sessionId;
        const finishedAt = payload?.finishedAt || new Date().toISOString();

        if (finishedId === sessionId) {
          setIsActive(false);
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  finishedAt,
                  ...(payload?.result !== undefined
                    ? { result: payload.result }
                    : {}),
                }
              : prev
          );
        }

        setRunStages((prev) =>
          prev.map((stage) =>
            stage.sessionId === finishedId
              ? {
                  ...stage,
                  isActive: false,
                  finishedAt,
                  hasSubmittedSolution:
                    stage.hasSubmittedSolution ||
                    Boolean(
                      typeof payload?.result === "string" &&
                        payload.result.trim()
                    ),
                }
              : stage
          )
        );
      }
    );

    newSocket.on(
      "session:evaluated",
      (payload: {
        sessionId?: string;
        evaluation?: string | null;
        score?: number | null;
        evaluationMode?: "none" | "classic" | "rubric" | null;
        rubricEvaluation?: RubricEvaluationResult | null;
      }) => {
        const evaluatedId = payload?.sessionId
          ? String(payload.sessionId)
          : sessionId;
        if (evaluatedId !== sessionId || !canShowEvaluationRef.current) {
          return;
        }
        setSession((prev) =>
          prev
            ? {
                ...prev,
                evaluation: payload.evaluation ?? prev.evaluation,
                score: payload.score ?? prev.score,
                evaluationMode: payload.evaluationMode ?? prev.evaluationMode,
                rubricEvaluation:
                  payload.rubricEvaluation ?? prev.rubricEvaluation,
              }
            : prev
        );
      }
    );

    newSocket.on(
      "run:stageChanged",
      (payload: {
        previousSessionId?: string | null;
        nextSessionId?: string;
        stageId?: string | null;
        stageNumber?: number;
        stageTotal?: number;
      }) => {
        if (!payload?.nextSessionId) return;
        const nextId = String(payload.nextSessionId);
        const prevId = payload.previousSessionId
          ? String(payload.previousSessionId)
          : null;

        setRunStages((prev) => {
          const updated = prev.map((stage) =>
            prevId && stage.sessionId === prevId
              ? {
                  ...stage,
                  isActive: false,
                  finishedAt: stage.finishedAt || new Date().toISOString(),
                }
              : stage
          );
          if (updated.some((stage) => stage.sessionId === nextId)) {
            return updated;
          }
          const stageNumber = payload.stageNumber ?? updated.length + 1;
          const stageTotal =
            payload.stageTotal ??
            Math.max(
              stageNumber,
              updated[0]?.stageTotal ?? 0
            );
          return [
            ...updated,
            {
              sessionId: nextId,
              stageId: payload.stageId ?? null,
              stageIndex: stageNumber - 1,
              stageNumber,
              stageTotal,
              startedAt: new Date().toISOString(),
              finishedAt: null,
              isActive: true,
              messageCount: 0,
              hasSubmittedSolution: false,
            },
          ].sort((a, b) => a.stageNumber - b.stageNumber);
        });

        // Auto-follow into the next stage only if the spectator was watching the
        // live stage that just transitioned; do not yank them out of an earlier
        // historical stage they are inspecting.
        const wasFollowingLiveStage = !prevId || prevId === sessionId;
        if (wasFollowingLiveStage && nextId !== sessionId) {
          navigate(
            `/spectate/${nextId}?token=${encodeURIComponent(token)}`,
            { replace: true }
          );
        }
      }
    );

    return () => {
      for (const roomSessionId of watchedRooms) {
        newSocket.emit("spectate:leave", roomSessionId);
      }
      newSocket.disconnect();
    };
  }, [sessionId, liveSessionId, token, scrollToBottom, navigate]);

  const getElapsedTime = () => {
    if (!session) return "0m";
    const start = new Date(session.startedAt);
    const end = session.finishedAt ? new Date(session.finishedAt) : new Date();
    const diffMs = Math.max(0, end.getTime() - start.getTime());
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

  const submittedResult =
    typeof session?.result === "string" && session.result.trim().length > 0
      ? session.result
      : null;

  const shouldRenderEvaluation = Boolean(
    !isActive &&
      canShowEvaluation &&
      (session?.rubricEvaluation || session?.evaluation)
  );

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
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-gray-900">
              Spectator Mode
            </h1>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {isActive ? "Active" : "Finished"}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                mode === "standard"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-orange-100 text-orange-700"
              }`}
            >
              {mode}
            </span>
            {session?.stage && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                Stage {session.stage.number}/{session.stage.total}
              </span>
            )}
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

      {/* Stage selector bar for multi-stage activities */}
      {isStaged && (
        <nav
          aria-label="Activity stages"
          className="border-b bg-slate-50 px-4 py-2"
        >
          <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {Array.from({ length: totalStages }, (_, idx) => {
                const stageNumber = idx + 1;
                const stageEntry = runStages.find(
                  (item) => item.stageNumber === stageNumber
                );
                const isSelected = Boolean(
                  stageEntry && stageEntry.sessionId === sessionId
                );

                if (!stageEntry) {
                  return (
                    <button
                      key={`stage-pending-${stageNumber}`}
                      type="button"
                      disabled
                      title="Not started yet"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                    >
                      <span>Stage {stageNumber}</span>
                    </button>
                  );
                }

                return (
                  <button
                    key={stageEntry.sessionId}
                    type="button"
                    aria-current={isSelected ? "step" : undefined}
                    onClick={() => navigateToStage(stageEntry.sessionId)}
                    title={
                      stageEntry.leiaName
                        ? `Stage ${stageNumber} — ${stageEntry.leiaName}`
                        : `Stage ${stageNumber}`
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-indigo-50 hover:border-indigo-300"
                    }`}
                  >
                    {stageEntry.isActive ? (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? "bg-green-300" : "bg-green-500"
                        } animate-pulse`}
                      />
                    ) : (
                      <CheckIcon
                        className={`w-3.5 h-3.5 ${
                          isSelected ? "text-indigo-100" : "text-gray-400"
                        }`}
                      />
                    )}
                    <span>Stage {stageNumber}</span>
                    {stageEntry.isActive && (
                      <span
                        className={`text-[10px] uppercase tracking-wide font-semibold ${
                          isSelected ? "text-green-200" : "text-green-700"
                        }`}
                      >
                        Live
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {isViewingPreviousStage && liveStage && (
              <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                <span>
                  Viewing previous stage · Student is live in Stage{" "}
                  {liveStage.stageNumber}
                </span>
                <button
                  type="button"
                  onClick={() => navigateToStage(liveStage.sessionId)}
                  className="font-semibold text-indigo-700 hover:text-indigo-900 underline"
                >
                  Go to live
                </button>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* Messages, submitted solution, and evaluation */}
      <main className="flex-1 overflow-y-auto px-4 pb-6 bg-gray-50">
        <div
          ref={messagesContainerRef}
          className="max-w-3xl mx-auto space-y-4 py-4"
        >
          {switchingStage ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading stage...</p>
            </div>
          ) : (
            <>
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  {externalTranscriptionLink ? (
                    <div className="space-y-2">
                      <p className="text-gray-600">
                        This stage uses an external transcription.
                      </p>
                      <a
                        href={externalTranscriptionLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Open transcription
                      </a>
                    </div>
                  ) : (
                    <p className="text-gray-500">No messages yet...</p>
                  )}
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
                      {message.isLeia && message.senderName && (
                        <p className="text-xs font-semibold text-blue-700 mb-0.5">
                          {message.senderName}
                        </p>
                      )}
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                        {message.text}
                      </p>
                    </div>
                  </div>
                ))
              )}

              {submittedResult && (
                <section
                  aria-label="Submitted Solution"
                  className="mt-6 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-gray-900">
                      Submitted Solution
                    </h2>
                    {solutionFormat && solutionFormat !== "text" && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {solutionFormat}
                      </span>
                    )}
                  </div>
                  <pre className="text-sm font-mono whitespace-pre-wrap break-words text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-100 m-0">
                    {submittedResult}
                  </pre>
                </section>
              )}

              {shouldRenderEvaluation && session && (
                <section
                  aria-label="Evaluation"
                  className="mt-6 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-gray-900">
                      Evaluation
                    </h2>
                    {!session.rubricEvaluation &&
                      session.score !== null &&
                      session.score !== undefined && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          {session.score} / 10
                        </span>
                      )}
                  </div>
                  {session.rubricEvaluation ? (
                    <RubricEvaluationView
                      rubricEvaluation={session.rubricEvaluation}
                    />
                  ) : (
                    <div className="prose prose-sm max-w-none text-gray-800">
                      <ReactMarkdown>{session.evaluation || ""}</ReactMarkdown>
                    </div>
                  )}
                </section>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
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
