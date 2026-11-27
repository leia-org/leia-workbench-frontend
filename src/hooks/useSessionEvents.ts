import { useEffect } from "react";
import { clipboardCapture } from "../lib/clipboardCapture";
import { startPagePresence } from "../lib/pagePresence";
import { sessionEvents } from "../lib/sessionEvents";
import type { SessionEventView } from "../lib/sessionEvents";

export interface UseSessionEventsOptions {
  /** The backend offers the feature for this session (`leia.eventsEnabled`)
   *  and the session can still take events. */
  enabled: boolean;
  view: SessionEventView;
  /** false when the student declined the data usage consent: test runs are
   *  still sent, but the clipboard and the page presence are not watched. */
  observe?: boolean;
}

// Records the interaction events of one session while the view is mounted:
// starts the tracker and, unless only functional events are allowed, the
// clipboard capture and the page presence watcher.
export function useSessionEvents(sessionId: string | null | undefined, options: UseSessionEventsOptions): void {
  const { enabled, view, observe = true } = options;

  useEffect(() => {
    if (!sessionId || !enabled) return;

    const stopTracker = sessionEvents.start(sessionId, { view, observe });
    if (!observe) return stopTracker;

    const stopClipboard = clipboardCapture.start(sessionId);
    const stopPresence = startPagePresence({
      emit: (event) => {
        sessionEvents.track(sessionId, {
          type: event.type,
          source: "page",
          payload: event.payload,
          clientAt: event.at,
          urgent: event.urgent,
        });
      },
    });

    return () => {
      stopPresence();
      stopClipboard();
      stopTracker();
    };
  }, [sessionId, enabled, view, observe]);
}
