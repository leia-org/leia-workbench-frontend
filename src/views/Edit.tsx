import React, { useEffect, useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import mermaid from "mermaid";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

mermaid.initialize({
  startOnLoad: true,
  theme: "default",
  securityLevel: "loose",
});

const defaultCode = `classDiagram
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

interface EvaluationModalProps {
  evaluation: string;
  onClose: () => void;
  onHome: () => void;
  onOpenForm?: () => void;
}

const EvaluationModal: React.FC<EvaluationModalProps> = memo(
  ({ evaluation, onClose, onHome, onOpenForm }) => {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl max-w-2xl w-full mx-4 shadow-xl">
          <div className="flex justify-between items-center px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">
              Solution Submitted
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
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto prose prose-blue">
            <ReactMarkdown>{evaluation}</ReactMarkdown>
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <button
              onClick={onHome}
              className="px-4 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-600 rounded-md hover:bg-gray-50 flex items-center gap-1.5"
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
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Home
            </button>

            {onOpenForm && (
              <button
                onClick={onOpenForm}
                className="px-4 py-1.5 text-sm font-medium text-blue-600 bg-white border border-blue-600 rounded-md hover:bg-blue-50"
              >
                Open Form
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

EvaluationModal.displayName = "EvaluationModal";

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
  onHome: () => void;
  onOpenForm: () => void;
  onEvaluate: () => void;
  formUrl: string;
  loadingEvaluation: boolean;
  onAlert: () => void;
}

const Header: React.FC<HeaderProps> = memo(({ loadingEvaluation, onAlert }) => (
  <header className="bg-white border-b px-4 py-3">
    <div className="max-w-full mx-auto flex justify-between items-center">
      <div className="flex items-center space-x-2">
        <img
          src="/logo/leia_main_dark.png"
          alt="LEIA Logo"
          className="w-6 h-6"
        />
        <h1 className="text-xl font-semibold text-gray-900">Editor</h1>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onAlert}
          disabled={loadingEvaluation}
          className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loadingEvaluation ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Evaluating...
            </>
          ) : (
            "Send Solution"
          )}
        </button>
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
}

export const Edit = () => {
  const navigate = useNavigate();
  const [formUrl, setFormUrl] = useState<string | null>(null);
  const [code, setCode] = useState(() => {
    const savedCode = localStorage.getItem("mermaid_code");
    if (savedCode) {
      return savedCode;
    }
    return defaultCode;
  });
  const [mermaidSvg, setMermaidSvg] = useState<string>("");
  const [lastValidSvg, setLastValidSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [editorWidth, setEditorWidth] = useState(() => {
    const savedWidth = localStorage.getItem("editor_width");
    return savedWidth ? Number(savedWidth) : 50;
  });
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);
  const [evaluation, setEvaluation] = useState<string | null>(null);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const [concludedSvg, setConcludedSvg] = useState<string | null>(null);
  const [configuration, setConfiguration] = useState<Configuration | null>(
    null
  );
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Load initial data from localStorage
  useEffect(() => {
    const savedConfiguration = localStorage.getItem("configuration");
    const savedReplication = localStorage.getItem("replication");
    const savedSessionId = localStorage.getItem("sessionId");
    if (savedConfiguration) {
      const parsedConfiguration = JSON.parse(savedConfiguration);
      setConfiguration(parsedConfiguration);
    }
    if (savedReplication) {
      const parsedReplication = JSON.parse(savedReplication);
      setFormUrl(parsedReplication.form);
    }
    if (savedSessionId) {
      setSessionId(savedSessionId);
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
    localStorage.clear();
    navigate("/");
  }, [navigate]);

  const onOpenForm = useCallback(() => {
    if (formUrl) {
      window.open(formUrl, "_blank");
    }
  }, [formUrl]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value) {
      setCode(value);
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const handleCloseEvaluation = useCallback(() => {
    setShowEvaluation(false);
  }, []);

  const handleHome = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleOpenForm = useCallback(() => {
    if (formUrl) {
      window.open(formUrl, "_blank");
    }
  }, [formUrl]);

  const concludeProblem = useCallback(async () => {
    try {
      const sessionId = localStorage.getItem("sessionId");
      const response = await axios.post(
        `${
          import.meta.env.VITE_APP_BACKEND
        }/api/v1/interactions/${sessionId}/result`,
        {
          result: code,
        }
      );
      if (response.status === 200) {
        const updatedDataResponse = await axios.get(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/${sessionId}`
        );
        console.log(updatedDataResponse.data);
        const exerciseSolution =
          updatedDataResponse.data.leia.leia.spec.problem.spec.solution;
        const svg = await mermaid.render("mermaid2-diagram", exerciseSolution);
        setConcluded(true);
        setShowAlert(false);

        setConcludedSvg(svg.svg);
      }
    } catch (error) {
      console.error("Failed to conclude the problem:", error);
      throw error;
    }
  }, [code]);

  const getEvaluation = useCallback(async () => {
    setLoadingEvaluation(true);
    try {
      await concludeProblem();
      console.log(configuration);
      if (configuration?.evaluateSolution) {
        const response = await axios.get(
          `${
            import.meta.env.VITE_APP_BACKEND
          }/api/v1/interactions/${sessionId}/evaluation/`
        );
        if (response.status === 200) {
          setEvaluation(response.data.evaluation);
          setShowEvaluation(true);
        }
      } else {
        setEvaluation("Solution submitted successfully.");
        setShowEvaluation(true);
      }
    } catch (error) {
      console.error("Failed to get evaluation:", error);
    } finally {
      setLoadingEvaluation(false);
    }
  }, [concludeProblem, configuration, sessionId]);
  useEffect(() => {
    const renderMermaid = async () => {
      try {
        const { svg } = await mermaid.render("mermaid-diagram", code);
        setMermaidSvg(svg);
        setLastValidSvg(svg);
        setError(null);
      } catch (error: any) {
        console.error("Error rendering mermaid diagram:", error);
        setMermaidSvg(lastValidSvg);

        let errorMessage = error.message || "Error al renderizar el diagrama";
        if (errorMessage.includes("Syntax error in")) {
          errorMessage =
            errorMessage.split("Parse error:").pop()?.trim() || errorMessage;
        }
        setError(errorMessage);
      }
    };

    renderMermaid();
  }, [code]);

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

  return (
    <div className="flex flex-col h-screen bg-white">
      <Header
        onHome={handleHome}
        onOpenForm={handleOpenForm}
        onEvaluate={getEvaluation}
        onAlert={() =>
          evaluation ? setShowEvaluation(true) : setShowAlert(true)
        }
        formUrl={formUrl || ""}
        loadingEvaluation={loadingEvaluation}
      />

      {showAlert && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full mx-4 shadow-xl">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                ¿Are you sure you want to conclude the problem?
              </h2>
              <p className="text-gray-600">
                This action will conclude the problem and you will not be able
                to continue working on it.
              </p>
              <div className="flex justify-end mt-4 gap-2">
                <button
                  onClick={() => setShowAlert(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-600 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={getEvaluation}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Conclude Problem
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
            <Editor
              height="100%"
              defaultLanguage="mermaid"
              value={code}
              onChange={handleEditorChange}
              theme="vs-light"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: "on",
              }}
            />
            {error && <ErrorMessage message={error} />}
          </div>
        ) : (
          <div style={{ width: `${editorWidth}%` }} className="h-full relative">
            <h2 className="text-gray-500 px-4 py-2">Problem Solution</h2>
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit={true}
              wheel={{ wheelDisabled: true }}
            >
              <TransformComponent
                wrapperClass="!w-full !h-full"
                contentClass="flex items-center justify-center p-4"
              >
                {concludedSvg ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: concludedSvg }}
                    className="transform-component-module_content__uCDPE"
                  />
                ) : (
                  <div className="text-gray-500">
                    Loading concluded diagram...
                  </div>
                )}
              </TransformComponent>
            </TransformWrapper>
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
        <div
          style={{ width: `${100 - editorWidth}%` }}
          className="h-full bg-gray-50 flex flex-col relative"
        >
          {concluded ? (
            <h2 className="text-gray-500 px-4 py-2">Your Solution</h2>
          ) : null}
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={4}
            centerOnInit={true}
            wheel={{ wheelDisabled: true }}
          >
            {(utils) => (
              <>
                <TransformComponent
                  wrapperClass="!w-full !h-full"
                  contentClass="flex items-center justify-center p-4"
                >
                  {mermaidSvg ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: mermaidSvg }}
                      className="transform-component-module_content__uCDPE"
                    />
                  ) : (
                    <div className="text-gray-500">Loading preview...</div>
                  )}
                </TransformComponent>
                <DiagramControls {...utils} />
              </>
            )}
          </TransformWrapper>
        </div>
      </main>
      {concluded ? (
        <div className="h-[300px] w-full">
          <Editor
            height="100%"
            defaultLanguage="mermaid"
            value={code}
            theme="vs-light"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
            }}
          />
        </div>
      ) : null}

      {showEvaluation && evaluation && (
        <EvaluationModal
          evaluation={evaluation}
          onClose={handleCloseEvaluation}
          onHome={onHome}
          onOpenForm={formUrl && (formUrl.startsWith('http://') || formUrl.startsWith('https://')) ? onOpenForm : undefined}
        />
      )}
    </div>
  );
};
