import { useCallback, useEffect, useState } from "react";
import { appendLiveEvents, type SessionEventRecord } from "../../lib/events";

// Events of the session an instructor has selected. They are fetched when the
// session is selected (lists only carry counters), a response for a session
// that is no longer selected is dropped, and events arriving live are merged
// in without duplicates.

type Status = "idle" | "loading" | "loaded" | "error";

interface State {
  sessionId: string | null;
  events: SessionEventRecord[];
  status: Status;
}

const NO_EVENTS: SessionEventRecord[] = [];

export interface SessionEventList {
  events: SessionEventRecord[];
  loading: boolean;
  error: boolean;
  /** Asks for the list again after a failure. */
  retry: () => void;
  /** Adds events received live; ignored unless they belong to the session shown. */
  append: (sessionId: string, events: SessionEventRecord[] | undefined | null) => void;
}

export function useSessionEventList(
  sessionId: string | null | undefined,
  /** False while the session has no events: nothing is requested. */
  enabled: boolean,
  fetchEvents: (sessionId: string) => Promise<SessionEventRecord[]>,
): SessionEventList {
  const id = sessionId ?? null;
  const [state, setState] = useState<State>({ sessionId: id, events: NO_EVENTS, status: "idle" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id || !enabled) {
      setState((prev) =>
        prev.sessionId === id ? prev : { sessionId: id, events: NO_EVENTS, status: "idle" }
      );
      return;
    }
    let cancelled = false;
    setState((prev) => ({
      sessionId: id,
      events: prev.sessionId === id ? prev.events : NO_EVENTS,
      status: "loading",
    }));
    fetchEvents(id).then(
      (fetched) => {
        if (cancelled) return;
        // Events that came live while the request was on its way are kept.
        setState((prev) => ({
          sessionId: id,
          events: appendLiveEvents(fetched, prev.sessionId === id ? prev.events : NO_EVENTS),
          status: "loaded",
        }));
      },
      () => {
        if (cancelled) return;
        setState((prev) => (prev.sessionId === id ? { ...prev, status: "error" } : prev));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [id, enabled, fetchEvents, attempt]);

  const append = useCallback(
    (targetSessionId: string, incoming: SessionEventRecord[] | undefined | null) => {
      setState((prev) => {
        if (prev.sessionId !== targetSessionId) return prev;
        const events = appendLiveEvents(prev.events, incoming);
        return events === prev.events ? prev : { ...prev, events };
      });
    },
    []
  );

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Until the effect catches up with a new selection, the state still holds
  // the previous session's events: never show those.
  const current = state.sessionId === id;
  return {
    events: current ? state.events : NO_EVENTS,
    loading: current ? state.status === "loading" : id !== null && enabled,
    error: current && state.status === "error",
    retry,
    append,
  };
}
