import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";

const getParentOrigin = (): string | null => {
  if (window.parent === window) return null;
  try {
    return new URL(document.referrer).origin;
  } catch {
    return null;
  }
};

const postToParent = (parentOrigin: string | null, message: object) => {
  if (!parentOrigin || window.parent === window) return;
  window.parent.postMessage(message, parentOrigin);
};

export const PrairieLearnEmbed = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const launchToken = searchParams.get("launch")?.trim() || "";
  const parentOrigin = useMemo(getParentOrigin, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!parentOrigin) {
      setError("This launch must be opened inside PrairieLearn.");
      return;
    }

    if (!launchToken) {
      const message = "The signed PrairieLearn launch token is missing.";
      setError(message);
      postToParent(parentOrigin, { type: "leia:error", message });
      return;
    }

    postToParent(parentOrigin, { type: "leia:ready" });

    const startSession = async () => {
      try {
        const response = await axios.post(
          `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions`,
          {
            integration: {
              platform: "prairielearn",
              launchToken,
            },
          },
        );
        const sessionId = response.data?.sessionId;
        if (typeof sessionId !== "string" || !sessionId) {
          throw new Error("LEIA did not return a session ID.");
        }

        localStorage.setItem("sessionId", sessionId);
        postToParent(parentOrigin, { type: "leia:progress" });
        const query = new URLSearchParams({
          embed: "prairielearn",
          parentOrigin,
        });
        navigate(`/chat/${encodeURIComponent(sessionId)}?${query.toString()}`, {
          replace: true,
        });
      } catch (caughtError: unknown) {
        const message = axios.isAxiosError(caughtError)
          ? caughtError.response?.data?.message ||
            caughtError.response?.data?.error ||
            "LEIA could not start this activity."
          : caughtError instanceof Error
            ? caughtError.message
            : "LEIA could not start this activity.";
        setError(message);
        postToParent(parentOrigin, { type: "leia:error", message });
      }
    };

    void startSession();
  }, [launchToken, navigate, parentOrigin]);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <section className="max-w-md w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-red-700">
              LEIA could not start
            </h1>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <h1 className="mt-4 text-lg font-semibold text-gray-900">
              Opening LEIA
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Preparing your activity session.
            </p>
          </>
        )}
      </section>
    </main>
  );
};
