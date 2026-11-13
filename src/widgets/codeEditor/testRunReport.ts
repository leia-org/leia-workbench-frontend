import type { EditorLanguage, TestRunSummary } from "./types";

// Builds the JSON-safe report of one test run that the host persists. Pure:
// no I/O and no React, so the widget stays unaware of sessions and backends.

/** Who started the run: the student's button or the LEIA's tool. */
export type TestRunTrigger = "student" | "leia";

export interface TestRunReportResult {
    name: string;
    ok: boolean;
    error?: string;
    /** Serialised with `safeStringify`; only present on a failed comparison. */
    expected?: string;
    actual?: string;
}

export interface TestRunReport {
    /** Makes a retried report idempotent on the server. */
    clientRunId: string;
    trigger: TestRunTrigger;
    language: Exclude<EditorLanguage, "text">;
    fnName: string;
    /** Editor content when the run started. */
    code: string;
    codeTruncated: boolean;
    results: TestRunReportResult[];
    /** Suite-level failure (syntax error, timeout). */
    error: string | null;
    durationMs: number;
    clientRunAt: string;
}

// Server-side limits (see the backend's testRunValidator).
export const MAX_CODE_LENGTH = 60000;
export const MAX_RESULTS = 200;
export const MAX_STRING_LENGTH = 2000;
// The backend parses JSON bodies up to 100 kb; stay clearly below.
export const MAX_REPORT_BYTES = 90000;
// Per-value sizes tried, in order, when a report has to shrink to fit.
const COMPACT_STRING_LENGTHS = [300, 100, 40];
// Room kept for the code once the per-test values are as small as they get:
// past this point the values are dropped rather than the code.
const CODE_RESERVE_BYTES = 30000;

const truncate = (text: string, maxLength: number): string =>
    text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 1))}…` : text;

// Like JSON.stringify, but never throws and never returns undefined: test
// values can be BigInt, Map, Set, functions, undefined or circular.
export function safeStringify(value: unknown, maxLength = MAX_STRING_LENGTH): string {
    let text: string | undefined;
    try {
        const ancestors: unknown[] = [];
        text = JSON.stringify(value, function (this: unknown, _key: string, current: unknown) {
            if (typeof current === "bigint") return `${current}n`;
            if (typeof current === "function") return `[Function ${current.name || "anonymous"}]`;
            if (typeof current === "symbol") return current.toString();
            if (current === undefined) return "[undefined]";
            if (typeof current === "number" && !Number.isFinite(current)) return String(current);
            if (current instanceof Map) return { "[Map]": Array.from(current.entries()) };
            if (current instanceof Set) return { "[Set]": Array.from(current.values()) };
            if (current !== null && typeof current === "object") {
                // `this` is the holder of `current`: drop ancestors that are
                // no longer on the path, then a repeat means a real cycle.
                while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) ancestors.pop();
                if (ancestors.includes(current)) return "[Circular]";
                ancestors.push(current);
            }
            return current;
        });
    } catch {
        text = undefined;
    }
    if (text === undefined) {
        try {
            text = String(value);
        } catch {
            text = "[unserializable]";
        }
    }
    // A bare `undefined` reads better without the placeholder quotes.
    if (value === undefined) text = "undefined";
    return truncate(text, maxLength);
}

const byteLength = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;

function newRunId(): string {
    try {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    } catch { /* not available in insecure contexts */ }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function toReportResults(summary: TestRunSummary, maxLength: number): TestRunReportResult[] {
    return summary.results.slice(0, MAX_RESULTS).map((result) => {
        const entry: TestRunReportResult = {
            name: truncate(String(result.name ?? ""), maxLength),
            ok: result.ok === true,
        };
        if (result.ok) return entry;
        if (result.error) {
            entry.error = truncate(String(result.error), maxLength);
        } else {
            entry.expected = safeStringify(result.expected, maxLength);
            entry.actual = safeStringify(result.actual, maxLength);
        }
        return entry;
    });
}

export interface BuildTestRunReportInput {
    trigger: TestRunTrigger;
    language: Exclude<EditorLanguage, "text">;
    fnName: string;
    code: string;
    summary: TestRunSummary;
    startedAt: Date;
    clientRunId?: string;
}

export function buildTestRunReport(input: BuildTestRunReportInput): TestRunReport {
    const { trigger, language, fnName, summary, startedAt } = input;
    const fullCode = input.code ?? "";

    const report: TestRunReport = {
        clientRunId: input.clientRunId ?? newRunId(),
        trigger,
        language,
        fnName: truncate(String(fnName ?? ""), 200),
        code: fullCode.slice(0, MAX_CODE_LENGTH),
        codeTruncated: fullCode.length > MAX_CODE_LENGTH,
        results: toReportResults(summary, MAX_STRING_LENGTH),
        error: summary.error ? truncate(String(summary.error), MAX_STRING_LENGTH) : null,
        durationMs: Math.max(0, Math.round(summary.durationMs || 0)),
        clientRunAt: startedAt.toISOString(),
    };

    if (byteLength(report) <= MAX_REPORT_BYTES) return report;

    // Over budget. The code matters more than long expected/actual values, so
    // those shrink first.
    for (const maxLength of COMPACT_STRING_LENGTHS) {
        report.results = toReportResults(summary, maxLength);
        if (byteLength(report) <= MAX_REPORT_BYTES) return report;
    }
    // Still too big with tiny values: keep only each test's name and verdict
    // if the results alone would leave no room for the code.
    if (byteLength({ ...report, code: "" }) > MAX_REPORT_BYTES - CODE_RESERVE_BYTES) {
        report.results = report.results.map(({ name, ok }) => ({ name, ok }));
    }
    // Finally cut the code. Dropping a character removes at least one byte,
    // so this always converges.
    let excess = byteLength(report) - MAX_REPORT_BYTES;
    while (excess > 0 && report.code.length > 0) {
        report.code = report.code.slice(0, Math.max(0, report.code.length - excess - 16));
        report.codeTruncated = true;
        excess = byteLength(report) - MAX_REPORT_BYTES;
    }
    return report;
}
