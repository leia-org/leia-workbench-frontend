import axios from "axios";
import type {
  TestRunReport,
  TestRunReportResult,
  TestRunTrigger,
} from "../widgets/codeEditor/testRunReport";

// Test runs of the code editor as the backend stores and returns them.

export type TestRunStatus = "passed" | "failed" | "error";

export interface TestRunRecord {
  id: string;
  session: string;
  trigger: TestRunTrigger;
  language: string;
  fnName: string;
  /** Editor content at the run. Absent in list payloads, loaded on demand. */
  code?: string;
  codeTruncated?: boolean;
  status: TestRunStatus;
  passed: number;
  failed: number;
  total: number;
  results: TestRunReportResult[];
  error: string | null;
  durationMs: number;
  clientRunAt?: string;
  /** When a student-triggered run was passed to the LEIA as context. */
  reportedToLeiaAt?: string | null;
  createdAt: string;
}

const RETRY_DELAY_MS = 1500;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Sends a test run to the backend. Best effort: one retry on a network or
// server error, never throws, so recording can never disturb the student.
export async function postTestRun(sessionId: string, report: TestRunReport): Promise<boolean> {
  const url = `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/${sessionId}/test-runs`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await axios.post(url, report);
      return true;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      // A 4xx will not succeed on retry (finished session, validation, cap).
      const retriable = status === undefined || status >= 500;
      if (!retriable || attempt === 1) {
        console.warn("Test run could not be recorded", status ?? error);
        return false;
      }
      await wait(RETRY_DELAY_MS);
    }
  }
  return false;
}

/** "3/8 passed", or "error" when the suite could not run. */
export function describeTestRun(run: Pick<TestRunRecord, "status" | "passed" | "total">): string {
  return run.status === "error" ? "error" : `${run.passed}/${run.total} passed`;
}

export const triggerLabel = (trigger: TestRunTrigger): string => (trigger === "leia" ? "LEIA" : "Student");

export type TimelineItem<M> =
  | { kind: "message"; key: string; message: M }
  | { kind: "testRun"; key: string; run: TestRunRecord };

const toTime = (value: string | undefined): number => {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
};

// Interleaves test runs into a transcript. Messages keep the order they came
// in; each run goes right before the first message sent after it.
export function mergeTimeline<M extends { id: string; timestamp: string }>(
  messages: M[],
  testRuns: TestRunRecord[] = [],
): TimelineItem<M>[] {
  const runs = [...testRuns].sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt));
  const items: TimelineItem<M>[] = [];
  let next = 0;

  for (const message of messages) {
    const messageTime = toTime(message.timestamp);
    while (next < runs.length && toTime(runs[next].createdAt) < messageTime) {
      items.push({ kind: "testRun", key: `run-${runs[next].id}`, run: runs[next] });
      next++;
    }
    items.push({ kind: "message", key: `msg-${message.id}`, message });
  }
  for (; next < runs.length; next++) {
    items.push({ kind: "testRun", key: `run-${runs[next].id}`, run: runs[next] });
  }
  return items;
}

// Adds a run received live to a session's list: no duplicates (the same run
// can arrive by socket and by refresh), chronological, optionally capped to
// the most recent ones.
export function appendLiveRun(
  runs: TestRunRecord[] | undefined,
  run: TestRunRecord,
  maxLength?: number,
): TestRunRecord[] {
  const current = runs ?? [];
  if (current.some((existing) => existing.id === run.id)) return current;
  const merged = [...current, run].sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt));
  return typeof maxLength === "number" && merged.length > maxLength ? merged.slice(-maxLength) : merged;
}
