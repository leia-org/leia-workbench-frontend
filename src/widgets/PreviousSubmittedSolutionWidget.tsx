import React, { useCallback, useEffect, useId, useState } from "react";
import { Rnd } from "react-rnd";
import axios from "axios";
import mermaid from "mermaid";
import { XMarkIcon } from "@heroicons/react/24/solid";
import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { FormatPreview } from "../components/FormatPreview";

export interface PreviousSubmittedSolutionPayload {
  stage: {
    number: number;
    total: number;
  };
  availability: "chat" | "editor" | "both";
  solution: string | null;
  solutionFormat: string;
  submittedAt?: string | null;
}

export interface PreviousSubmittedSolutionWidgetProps {
  sessionId: string;
  stageNumber: number;
  view: "chat" | "editor";
  onClose: () => void;
}

const SUPPORTED_PREVIEW_FORMATS = new Set([
  "mermaid",
  "markdown",
  "html",
  "json",
  "yaml",
  "xml",
  "text",
]);

function getInitialWindowRect() {
  if (typeof window === "undefined") {
    return { x: 392, y: 96, width: 460, height: 480 };
  }
  const width = Math.min(460, Math.max(300, window.innerWidth - 32));
  const height = Math.min(480, Math.max(260, window.innerHeight - 120));
  const x = Math.max(16, Math.min(window.innerWidth - width - 16, 392));
  return { x, y: 96, width, height };
}

const PreviousSubmittedSolutionWidget: React.FC<
  PreviousSubmittedSolutionWidgetProps
> = ({ sessionId, stageNumber, view, onClose }) => {
  const rawInstanceId = useId();
  const mermaidIdPrefix = `prev-sol-${rawInstanceId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [initialRect] = useState(getInitialWindowRect);
  const [data, setData] = useState<PreviousSubmittedSolutionPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mermaidSvg, setMermaidSvg] = useState<string | null>(null);
  const [mermaidError, setMermaidError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadSubmittedSolution = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<PreviousSubmittedSolutionPayload>(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/${sessionId}/previous-submitted-solution`,
        { params: { view } },
      );
      setData(response.data);
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message ||
          err.response?.data?.error ||
          "Could not load the previous submitted solution."
        : "Could not load the previous submitted solution.";
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
        const response = await axios.get<PreviousSubmittedSolutionPayload>(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/${sessionId}/previous-submitted-solution`,
          { params: { view } },
        );
        if (active) setData(response.data);
      } catch (err: unknown) {
        if (!active) return;
        const message = axios.isAxiosError(err)
          ? err.response?.data?.message ||
            err.response?.data?.error ||
            "Could not load the previous submitted solution."
          : "Could not load the previous submitted solution.";
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

  const rawFormat = (data?.solutionFormat || "text").toLowerCase();
  const displayFormat = SUPPORTED_PREVIEW_FORMATS.has(rawFormat)
    ? rawFormat
    : "text";
  const solutionText = data?.solution ?? "";
  const hasSolution = solutionText.trim().length > 0;

  useEffect(() => {
    if (displayFormat !== "mermaid" || !hasSolution) {
      setMermaidSvg(null);
      setMermaidError(null);
      return;
    }
    let active = true;
    const renderDiagram = async () => {
      try {
        const { svg } = await mermaid.render(
          `${mermaidIdPrefix}-diagram`,
          solutionText,
        );
        if (active) {
          setMermaidSvg(svg);
          setMermaidError(null);
        }
      } catch (err: unknown) {
        if (!active) return;
        setMermaidSvg(null);
        setMermaidError(
          err instanceof Error
            ? err.message
            : "Could not render the submitted diagram.",
        );
      }
    };
    void renderDiagram();
    return () => {
      active = false;
    };
  }, [displayFormat, hasSolution, mermaidIdPrefix, solutionText]);

  const handleCopy = async () => {
    if (!hasSolution || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(solutionText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures in restricted environments.
    }
  };

  const displayStageNumber = data?.stage?.number ?? stageNumber;

  return (
    <Rnd
      default={initialRect}
      minWidth={300}
      minHeight={220}
      bounds="window"
      dragHandleClassName="previous-solution-drag-handle"
      style={{ zIndex: 60 }}
      className="rounded-lg border border-gray-300 bg-white shadow-lg overflow-hidden"
    >
      <div
        className="flex flex-col h-full w-full"
        role="region"
        aria-label={`Stage ${displayStageNumber} submitted solution`}
      >
        <div className="previous-solution-drag-handle cursor-move bg-gray-100 border-b border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 select-none flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <DocumentTextIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />
            <span className="truncate">
              Submitted solution · Stage {displayStageNumber}
            </span>
            {!loading && !error && hasSolution && data?.solutionFormat && (
              <span className="text-[11px] font-normal text-gray-500 flex-shrink-0">
                ({data.solutionFormat})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!loading && !error && hasSolution && (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => void handleCopy()}
                aria-label="Copy submitted solution"
                title={copied ? "Copied" : "Copy submitted solution"}
                className="text-gray-500 hover:text-gray-700 p-0.5 rounded hover:bg-gray-200 transition-colors"
              >
                {copied ? (
                  <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-600" />
                ) : (
                  <ClipboardDocumentIcon className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onClose}
              aria-label="Close submitted solution"
              className="text-gray-500 hover:text-gray-700 p-0.5 rounded hover:bg-gray-200 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden bg-gray-50">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500 py-8">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Loading submitted solution...</span>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-4 py-8">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => void loadSubmittedSolution()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : !hasSolution ? (
            <div className="h-full flex items-center justify-center text-center px-4 py-8">
              <p className="text-sm text-gray-500">
                No solution was submitted in Stage {displayStageNumber}.
              </p>
            </div>
          ) : (
            <FormatPreview
              code={solutionText}
              format={displayFormat}
              mermaidSvg={mermaidSvg}
              error={mermaidError}
            />
          )}
        </div>
      </div>
    </Rnd>
  );
};

export default PreviousSubmittedSolutionWidget;
