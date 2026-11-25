import React, { useEffect, useState, useCallback, useRef, memo } from "react";
import { useNavigate } from "react-router-dom";
import mermaid from "mermaid";
import axios from "axios";
import { FormatEditor } from "../components/FormatEditor";
import { FormatPreview } from "../components/FormatPreview";
import { SessionTimer } from "../components/SessionTimer";
import type { StageProgress } from "../components/ContinueStage";
import { ActivityProgress, type ActivityProgressProps, type ActivityStagePhase } from "../components/ActivityProgress";
import { ActivityCompletion, ActivityEvaluation, ConversationViewerLink } from "../components/ActivityScreen";
import type { RubricEvaluationResult } from "../components/RubricEvaluationView";
import NotesWidget from "../widgets/NotesWidget";
import PreviousConversationWidget from "../widgets/PreviousConversationWidget";
import {
  ChatBubbleLeftRightIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
mermaid.initialize({
  startOnLoad: true,
  theme: "default",
  securityLevel: "loose",
});

const fallbackCode = `classDiagram
    class Person {
        +String firstName
        +String lastName
        +int age
        +getFullName(): String
    }
    class Employee {
        +int employeeId
        +calculateSalary(): float
    }
    class Client {
        +int clientId
        +placeOrder(): void
    }
    class Product {
        +int productId
        +String description
        +float price
    }
    class Order {
        +int orderId
        +Date date
        +calculateTotal(): float
    }

    Person <|-- Employee
    Person <|-- Client
    Client "1" --> "*" Order : places
    Order "1" --> "*" Product : contains`;

const clearStudentSessionStorage = () => {
  [
    "sessionId",
    "runId",
    "session",
    "exercise",
    "configuration",
    "replication",
    "mermaid_code",
    "editor_width",
    "showReferenceSolution",
  ].forEach((key) => localStorage.removeItem(key));
};

const getDefaultCode = () => {
  const savedExercise = localStorage.getItem("exercise");
  if (savedExercise) {
    try {
      const parsedExercise = JSON.parse(savedExercise);
      const initialSolution =
        typeof parsedExercise?.initialSolution === "string"
          ? parsedExercise.initialSolution.trim()
          : "";
      if (initialSolution) {
        return initialSolution;
      }
    } catch (error) {
      console.warn("Failed to parse exercise from localStorage:", error);
    }
  }
  return fallbackCode;
};

interface DiagramControlsProps {
  zoomIn: () => void;
  zoomOut: () => void;
  resetTransform: () => void;
}

const DiagramControls: React.FC<DiagramControlsProps> = memo(
  ({ zoomIn, zoomOut, resetTransform }) => {
    return (
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          onClick={zoomIn}
          className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 text-gray-700"
          title="Zoom In"
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
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </button>
        <button
          onClick={zoomOut}
          className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 text-gray-700"
          title="Zoom Out"
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
              d="M18 12H6"
            />
          </svg>
        </button>
        <button
          onClick={resetTransform}
          className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 text-gray-700"
          title="Reset Zoom"
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
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>
    );
  }
);

DiagramControls.displayName = "DiagramControls";

interface HeaderProps {
  progress: ActivityProgressProps;
  onAlert: () => void;
  submitting: boolean;
  onBackToCompletion?: () => void;
  sessionTime?: number | null;
  sessionStartedAt?: string | null;
  onTimerExpire?: () => void;
  onNotesToggle?: () => void;
  canShowPreviousConversation?: boolean;
  showPreviousConversation?: boolean;
  previousConversationStageNumber?: number;
  onPreviousConversationToggle?: () => void;
}

const Header: React.FC<HeaderProps> = memo(({ progress, submitting, onBackToCompletion, onAlert, sessionTime, sessionStartedAt, onTimerExpire, onNotesToggle, canShowPreviousConversation, showPreviousConversation, previousConversationStageNumber, onPreviousConversationToggle }) => (
  <header className="bg-white border-b px-4 py-3">
    <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap">
      <div className="flex w-full min-w-0 items-center gap-3">
        <img src="/logo/leia_main_dark.png" alt="LEIA Logo" className="h-6 w-6 shrink-0" />
        <ActivityProgress {...progress} />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {sessionTime && sessionStartedAt && onTimerExpire && (
          <SessionTimer
            durationMinutes={sessionTime}
            sessionStartedAt={sessionStartedAt}
            onExpire={onTimerExpire}
          />
        )}
        <button
          onClick={onNotesToggle}
          className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </svg>
          <span className="hidden sm:inline">Notes</span>
        </button>
        {canShowPreviousConversation && (
          <button
            type="button"
            onClick={onPreviousConversationToggle}
            aria-pressed={showPreviousConversation}
            aria-label="Conversation"
            title={
              previousConversationStageNumber
                ? `View Stage ${previousConversationStageNumber} conversation`
                : "View previous conversation"
            }
            className={`px-3 py-1.5 text-sm border rounded-md flex items-center gap-1 ${
              showPreviousConversation
                ? "text-blue-700 bg-blue-50 border-blue-300 hover:bg-blue-100"
                : "text-gray-700 bg-white border-gray-300 hover:bg-gray-50"
            }`}
          >
            <ChatBubbleLeftRightIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Conversation</span>
          </button>
        )}
        {onBackToCompletion ? (
          <button type="button" onClick={onBackToCompletion}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Back to completion
          </button>
        ) : (
          <button type="button" onClick={onAlert} disabled={submitting}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            Send solution
          </button>
        )}
      </div>
    </div>
  </header>
));

Header.displayName = "Header";

interface ErrorMessageProps {
  message: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = memo(({ message }) => (
  <div className="absolute bottom-0 left-0 right-0 bg-red-50 border-t border-red-200 p-3">
    <div className="flex items-start gap-2">
      <svg
        className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div className="text-sm text-red-600 font-medium">{message}</div>
    </div>
  </div>
));

ErrorMessage.displayName = "ErrorMessage";

interface Configuration {
  mode: string;
  askSolution: boolean;
  evaluateSolution: boolean;
  evaluationMode?: "none" | "classic" | "rubric";
  showSolution?: boolean;
  data: {
    messages?: unknown[];
    link?: string;
  };
}

export const Edit = () => {
  const navigate = useNavigate();
  const [formUrl, setFormUrl] = useState<string | null>(null);
  const [solutionFormat, setSolutionFormat] = useState<string>("text");
  const [code, setCode] = useState(() => {
    const savedCode = localStorage.getItem("mermaid_code");
    if (savedCode) {
      return savedCode;
    }
    return getDefaultCode();
  });
  const [mermaidSvg, setMermaidSvg] = useState<string>("");
  const lastValidSvg = useRef("");
  const [error, setError] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [editorWidth, setEditorWidth] = useState(() => {
    const savedWidth = localStorage.getItem("editor_width");
    return savedWidth ? Number(savedWidth) : 50;
  });
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);
  const [evaluation, setEvaluation] = useState<string | null>(null);
  const [rubricEvaluation, setRubricEvaluation] = useState<RubricEvaluationResult | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const [concludedSvg, setConcludedSvg] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [solutionError, setSolutionError] = useState<string | null>(null);
  const submissionPendingRef = useRef(false);
  const [configuration, setConfiguration] = useState<Configuration | null>(
    null
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [spectateUrl, setSpectateUrl] = useState<string | null>(null);
  const [problemSolution, setProblemSolution] = useState<string | null>(null);
  const [sessionTime, setSessionTime] = useState<number | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [sessionFinishedAt, setSessionFinishedAt] = useState<string | null>(null);
  const [stage, setStage] = useState<StageProgress>();
  const [stagePlan, setStagePlan] = useState<ActivityStagePhase[]>();
  const [reviewingSolution, setReviewingSolution] = useState(false);
  const [submittedOnTimeout, setSubmittedOnTimeout] = useState(false);
  const [showReferenceSolution, setShowReferenceSolution] = useState(true);
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [previousConversation, setPreviousConversation] = useState<{
    enabled: boolean;
    stageNumber: number;
    availability: "chat" | "both";
  } | null>(null);
  const [showPreviousConversation, setShowPreviousConversation] = useState<boolean>(false);
  const codeRef = useRef(code);
  codeRef.current = code;
  // Load initial data from localStorage
  useEffect(() => {
    const savedConfiguration = localStorage.getItem("configuration");
    const savedReplication = localStorage.getItem("replication");
    const savedSessionId = localStorage.getItem("sessionId");
    const savedExercise = localStorage.getItem("exercise");
    const savedShowReferenceSolution = localStorage.getItem("showReferenceSolution");

    if (savedShowReferenceSolution !== null) {
      try {
        setShowReferenceSolution(Boolean(JSON.parse(savedShowReferenceSolution)));
      } catch {
        setShowReferenceSolution(true);
      }
    }

    if (savedConfiguration) {
      const parsedConfiguration = JSON.parse(savedConfiguration);
      setConfiguration(parsedConfiguration);
    }
    if (savedReplication) {
      const parsedReplication = JSON.parse(savedReplication);
      setFormUrl(parsedReplication.form);
      const durationSeconds = parsedReplication.duration;
      if (typeof durationSeconds === "number" && durationSeconds > 0) {
        setSessionTime(durationSeconds / 60);
      }
    }
    if (savedSessionId) {
      setSessionId(savedSessionId);
    }
    const savedSession = localStorage.getItem("session");
    if (savedSession) {
      const parsedSession = JSON.parse(savedSession);
      setStage(parsedSession.stage);
      setStagePlan(parsedSession.stagePlan);
      setSessionFinishedAt(parsedSession.finishedAt || null);
      setSpectateUrl(parsedSession.spectateUrl || null);
      if (parsedSession.finishedAt && typeof parsedSession.result === "string") {
        setCode(parsedSession.result);
        setConcluded(true);
      }
      if (parsedSession.startedAt) {
        setSessionStartedAt(parsedSession.startedAt);
      }
      if (parsedSession.previousConversation?.enabled) {
        setPreviousConversation(parsedSession.previousConversation);
      }
    }
    if (savedExercise) {
      const parsedExercise = JSON.parse(savedExercise);
      const format = parsedExercise.solutionFormat || "mermaid";
      setSolutionFormat(format);
    }

  }, []);

  useEffect(() => {
    localStorage.setItem("mermaid_code", code);
  }, [code]);

  useEffect(() => {
    localStorage.setItem("editor_width", String(editorWidth));
  }, [editorWidth]);

  useEffect(() => {
    return () => {
      localStorage.removeItem("mermaid_code");
      localStorage.removeItem("editor_width");
    };
  }, []);

  const onHome = useCallback(() => {
    clearStudentSessionStorage();
    navigate("/");
  }, [navigate]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value) {
      setCode(value);
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const submitSolution = useCallback(async (timedOut = false) => {
    if (!sessionId || sessionFinishedAt || submissionPendingRef.current) return;
    submissionPendingRef.current = true;
    setSubmissionError(null);
    setLoadingEvaluation(true);
    try {
      const result = codeRef.current;
      const { data } = await axios.post(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/${sessionId}/result`,
        { result },
      );
      const finishedAt = data.finishedAt || new Date().toISOString();
      const savedSession = { ...JSON.parse(localStorage.getItem("session") || "{}"), ...data, result, finishedAt };
      localStorage.setItem("session", JSON.stringify(savedSession));
      setStage(savedSession.stage);
      setStagePlan(savedSession.stagePlan);
      setSpectateUrl(data.spectateUrl || null);
      setCode(result);
      setConcluded(true);
      setShowAlert(false);
      setSubmittedOnTimeout(timedOut);
      setSessionFinishedAt(finishedAt);
    } catch (error) {
      setSubmissionError(axios.isAxiosError(error)
        ? error.response?.data?.message || error.response?.data?.error || error.message
        : "Could not send your solution. Please try again.");
    } finally {
      submissionPendingRef.current = false;
      setLoadingEvaluation(false);
    }
  }, [sessionId, sessionFinishedAt]);

  const handleTimerExpire = useCallback(() => void submitSolution(true), [submitSolution]);

  useEffect(() => {
    if (!sessionId || !sessionFinishedAt || !concluded) return;
    let active = true;
    const baseUrl = `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/${sessionId}`;
    if (showReferenceSolution) {
      const loadReferenceSolution = async () => {
        try {
          const { data } = await axios.get(`${baseUrl}/solution`);
          if (!active) return;
          setProblemSolution(data.solution);
          setSolutionFormat(data.solutionFormat || "text");
          if (data.solutionFormat === "mermaid") {
            const svg = await mermaid.render("mermaid2-diagram", data.solution);
            if (active) setConcludedSvg(svg.svg);
          }
        } catch (error) {
          console.error("Failed to display the reference solution:", error);
          if (active) setSolutionError("The reference solution could not be displayed.");
        }
      };
      void loadReferenceSolution();
    }
    return () => { active = false; };
  }, [sessionId, sessionFinishedAt, concluded, showReferenceSolution]);

  const loadEvaluation = useCallback(async () => {
    if (!sessionId || !sessionFinishedAt || !concluded) return;
    const hasAutomaticEvaluation = configuration?.evaluationMode
      ? configuration.evaluationMode !== "none"
      : Boolean(configuration?.evaluateSolution);
    if (!hasAutomaticEvaluation || configuration?.showSolution === false) return;
    setLoadingEvaluation(true);
    setSubmissionError(null);
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/${sessionId}/evaluation/`,
      );
      setEvaluation(data.evaluation ?? null);
      setRubricEvaluation(data.rubricEvaluation ?? null);
    } catch (error) {
      console.error("Failed to get evaluation:", error);
      setSubmissionError("Your solution was submitted, but the evaluation could not be loaded.");
    } finally {
      setLoadingEvaluation(false);
    }
  }, [sessionId, sessionFinishedAt, concluded, configuration]);

  useEffect(() => {
    void loadEvaluation();
  }, [loadEvaluation]);

  useEffect(() => {
    const renderMermaid = async () => {
      if (solutionFormat !== "mermaid") {
        // For non-mermaid formats, clear mermaid preview
        setMermaidSvg("");
        setError(null);
        return;
      }

      try {
        const { svg } = await mermaid.render("mermaid-diagram", code);
        setMermaidSvg(svg);
        lastValidSvg.current = svg;
        setError(null);
      } catch (error) {
        console.error("Error rendering mermaid diagram:", error);
        setMermaidSvg(lastValidSvg.current);

        let errorMessage = error instanceof Error ? error.message : "Error al renderizar el diagrama";
        if (errorMessage.includes("Syntax error in")) {
          errorMessage =
            errorMessage.split("Parse error:").pop()?.trim() || errorMessage;
        }
        setError(errorMessage);
      }
    };

    renderMermaid();
  }, [code, solutionFormat]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const windowWidth = window.innerWidth;
      const percentage = (e.clientX / windowWidth) * 100;

      const boundedPercentage = Math.min(Math.max(percentage, 30), 70);
      setEditorWidth(boundedPercentage);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const progress: ActivityProgressProps = {
    stage,
    stagePlan,
    currentStage: {
      askSolution: true,
      mode: configuration?.mode === "transcription" ? "transcription" : "conversation",
    },
    phase: sessionFinishedAt ? "completed" : "solution",
    solutionSubmitted: concluded,
  };

  if (sessionFinishedAt && !reviewingSolution) {
    const reviewLabel = showReferenceSolution ? "Review your solution and the reference" : "Review your solution";
    const isFinalStage = !stage?.hasNext;
    const conversationLink = isFinalStage && spectateUrl ? <ConversationViewerLink url={spectateUrl} /> : undefined;

    return (
      <ActivityCompletion
        progress={progress}
        sessionId={sessionId ?? undefined}
        formUrl={formUrl}
        onHome={onHome}
        footerContent={conversationLink}
        reviewAction={concluded
          ? { label: reviewLabel, onClick: () => setReviewingSolution(true) }
          : undefined}
        notice={submittedOnTimeout
          ? "Time is up. Your current solution was submitted automatically."
          : concluded ? "Your solution was submitted." : undefined}
      >
        {loadingEvaluation && <p role="status" className="shrink-0">Loading evaluation…</p>}
        {submissionError && (
          <div className="shrink-0 rounded-lg bg-red-50 p-4 text-red-700">
            <p role="alert">{submissionError}</p>
            <button type="button" className="mt-2 font-semibold underline" onClick={() => void loadEvaluation()}>
              Retry evaluation
            </button>
          </div>
        )}
        <ActivityEvaluation evaluation={evaluation} rubricEvaluation={rubricEvaluation} />
      </ActivityCompletion>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {showNotes && <NotesWidget />}
      {showPreviousConversation &&
        sessionId &&
        previousConversation?.enabled &&
        previousConversation.availability === "both" && (
          <PreviousConversationWidget
            sessionId={sessionId}
            stageNumber={previousConversation.stageNumber}
            view="editor"
            onClose={() => setShowPreviousConversation(false)}
          />
        )}
      <Header
        progress={progress}
        onAlert={() => setShowAlert(true)}
        submitting={loadingEvaluation}
        onBackToCompletion={sessionFinishedAt ? () => setReviewingSolution(false) : undefined}
        sessionTime={sessionFinishedAt ? null : sessionTime}
        sessionStartedAt={sessionStartedAt}
        onTimerExpire={handleTimerExpire}
        onNotesToggle={() => setShowNotes((prev) => !prev)}
        canShowPreviousConversation={Boolean(
          previousConversation?.enabled &&
            previousConversation.availability === "both",
        )}
        showPreviousConversation={showPreviousConversation}
        previousConversationStageNumber={previousConversation?.stageNumber}
        onPreviousConversationToggle={() =>
          setShowPreviousConversation((prev) => !prev)
        }
      />

      {submissionError && <div role="alert" className="bg-red-50 text-red-700 p-3">{submissionError}</div>}

      {showAlert && (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-solution"
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full mx-4 shadow-xl">
            <div className="px-6 py-4 border-b">
              <h2 id="confirm-solution" className="text-xl font-semibold text-gray-900">
                Send your solution?
              </h2>
              <p className="text-gray-600">
                {stage?.hasNext
                  ? `Sending your solution completes Stage ${stage.number}. Stage ${stage.number + 1} comes next.`
                  : "Sending your solution completes this activity."}
              </p>
              <div className="flex justify-end mt-4 gap-2">
                {submissionError && <p role="alert" className="text-red-700">{submissionError}</p>}
                <button
                  onClick={() => setShowAlert(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-600 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void submitSolution()}
                  disabled={loadingEvaluation}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  {loadingEvaluation ? "Submitting..." : "Send solution"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main
        className="flex-1 flex"
        style={{ height: !concluded ? "100%" : "calc(100% - 300px)" }}
      >

        {/* Editor Panel */}
        {!concluded ? (
          <div style={{ width: `${editorWidth}%` }} className="h-full relative">
            <FormatEditor
              value={code}
              onChange={handleEditorChange}
              format={solutionFormat}
              onError={(err) => setError(err)}
            />
          </div>
        ) : (
          <div style={{ width: `${editorWidth}%` }} className="h-full relative">
            <h2 className="text-gray-500 px-4 py-2">Problem Solution</h2>
            {showReferenceSolution ? (
              <FormatPreview
                code={problemSolution || ""}
                format={solutionFormat}
                mermaidSvg={concludedSvg}
                error={solutionError}
                renderControls={(utils) => <DiagramControls {...utils} />}
              />
            ) : (
              <div className="px-4 py-6 text-sm text-gray-600">
                Your solution has been submitted. The reference solution and evaluation are not shown for this stage.
              </div>
            )}
          </div>
        )}

        {/* Resizer */}
        <div
          className={`w-1 hover:bg-blue-500 cursor-col-resize transition-colors ${
            isResizing ? "bg-blue-500" : "bg-gray-200"
          }`}
          onMouseDown={handleMouseDown}
        />

        {/* Preview Panel */}
        <div style={{ width: `${100 - editorWidth}%` }} className="h-full">
          {concluded && (
            <h2 className="text-gray-500 px-4 py-2">Your Solution</h2>
          )}
          <FormatPreview
            code={code}
            format={solutionFormat}
            mermaidSvg={mermaidSvg}
            error={error}
            renderControls={(utils) => <DiagramControls {...utils} />}
          />
        </div>
      </main>

    </div>
  );
};
