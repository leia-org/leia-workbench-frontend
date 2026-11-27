// Tells when the student leaves the page and comes back.
//
// "Away" means the page is hidden (another tab, a minimised window) or has
// lost focus (another window or application on top, the address bar, the
// developer tools). A leave and its return are two events, so an absence the
// student never comes back from is still on record.

export type PageLeaveReason = "hidden" | "blur";

export type PagePresenceEvent =
  | { type: "page_leave"; at: number; payload: { reason: PageLeaveReason }; urgent: boolean }
  | {
      type: "page_return";
      at: number;
      payload: { awayMs: number; reason: PageLeaveReason; becameHidden: boolean };
      urgent: boolean;
    };

export interface PageSnapshot {
  hidden: boolean;
  focused: boolean;
}

export interface PagePresenceDeps {
  emit: (event: PagePresenceEvent) => void;
  now: () => number;
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  /** A loss of focus shorter than this is not reported. */
  blurGraceMs: number;
}

export interface PagePresenceMachine {
  /** Feed it the state of the page every time it may have changed. */
  update(snapshot: PageSnapshot): void;
  /** Cancels a pending report. Emits nothing. */
  dispose(): void;
}

// Focus flickers: a native dialog, a permission prompt, a click on the
// browser chrome. Those are not the student going elsewhere.
export const BLUR_GRACE_MS = 1000;

type State =
  | { name: "present" }
  // Away since before tracking started: there is no leave to pair a return with.
  | { name: "absent" }
  // Focus lost, not reported yet.
  | { name: "blurring"; since: number; timer: unknown }
  | { name: "away"; since: number; reason: PageLeaveReason; becameHidden: boolean };

const isAway = (snapshot: PageSnapshot): boolean => snapshot.hidden || !snapshot.focused;

/** The state machine alone: no DOM, so it can be driven by hand. */
export function createPagePresence(
  initial: PageSnapshot,
  overrides: Partial<PagePresenceDeps> & Pick<PagePresenceDeps, "emit">,
): PagePresenceMachine {
  const deps: PagePresenceDeps = {
    emit: overrides.emit,
    now: overrides.now ?? (() => Date.now()),
    setTimeout: overrides.setTimeout ?? ((callback, ms) => setTimeout(callback, ms)),
    clearTimeout: overrides.clearTimeout ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)),
    blurGraceMs: overrides.blurGraceMs ?? BLUR_GRACE_MS,
  };

  let state: State = isAway(initial) ? { name: "absent" } : { name: "present" };
  let disposed = false;

  function leave(since: number, reason: PageLeaveReason) {
    state = { name: "away", since, reason, becameHidden: reason === "hidden" };
    // A hidden page may never run again: its leave cannot wait for a batch.
    deps.emit({ type: "page_leave", at: since, payload: { reason }, urgent: reason === "hidden" });
  }

  function update(snapshot: PageSnapshot) {
    if (disposed) return;
    const away = isAway(snapshot);

    switch (state.name) {
      case "present": {
        if (!away) return;
        const since = deps.now();
        if (snapshot.hidden) {
          leave(since, "hidden");
          return;
        }
        const timer = deps.setTimeout(() => {
          if (!disposed && state.name === "blurring") leave(state.since, "blur");
        }, deps.blurGraceMs);
        state = { name: "blurring", since, timer };
        return;
      }
      case "blurring": {
        if (!away) {
          // Back within the grace period: it never happened.
          deps.clearTimeout(state.timer);
          state = { name: "present" };
        } else if (snapshot.hidden) {
          // The absence began when focus was lost, and hiding settles it.
          deps.clearTimeout(state.timer);
          leave(state.since, "hidden");
        }
        return;
      }
      case "away": {
        if (away) {
          if (snapshot.hidden) state.becameHidden = true;
          return;
        }
        const at = deps.now();
        const { since, reason, becameHidden } = state;
        state = { name: "present" };
        deps.emit({
          type: "page_return",
          at,
          payload: { awayMs: Math.max(0, at - since), reason, becameHidden },
          urgent: false,
        });
        return;
      }
      case "absent": {
        if (!away) state = { name: "present" };
        return;
      }
    }
  }

  function dispose() {
    disposed = true;
    if (state.name === "blurring") deps.clearTimeout(state.timer);
  }

  return { update, dispose };
}

export interface PagePresenceOptions extends Partial<Omit<PagePresenceDeps, "emit">> {
  emit: (event: PagePresenceEvent) => void;
  document?: Document;
  window?: Window;
}

/** Watches the visibility and focus of the page. Returns its stop. */
export function startPagePresence(options: PagePresenceOptions): () => void {
  const doc = options.document ?? (typeof document !== "undefined" ? document : undefined);
  const win = options.window ?? (typeof window !== "undefined" ? window : undefined);
  if (!doc || !win) return () => undefined;

  const snapshot = (): PageSnapshot => {
    let focused = true;
    try {
      focused = doc.hasFocus();
    } catch { /* assume present */ }
    return { hidden: doc.hidden === true, focused };
  };

  const machine = createPagePresence(snapshot(), options);
  const onVisibilityChange = () => machine.update(snapshot());
  // `focus` and `blur` of inner elements do not concern the page as a whole.
  const onWindowFocusChange = (event: Event) => {
    if (event.target === win) machine.update(snapshot());
  };

  doc.addEventListener("visibilitychange", onVisibilityChange);
  win.addEventListener("blur", onWindowFocusChange);
  win.addEventListener("focus", onWindowFocusChange);

  return () => {
    doc.removeEventListener("visibilitychange", onVisibilityChange);
    win.removeEventListener("blur", onWindowFocusChange);
    win.removeEventListener("focus", onWindowFocusChange);
    machine.dispose();
  };
}
