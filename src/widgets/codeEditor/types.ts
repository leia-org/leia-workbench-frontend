export interface TestCase {
    name: string;
    args: unknown[];
    expected: unknown;
}

export interface TestResult {
    name: string;
    ok: boolean;
    error?: string;
    expected?: unknown;
    actual?: unknown;
}

export interface TestRunSummary {
    passed: number;
    failed: number;
    total: number;
    results: TestResult[];
    /** Compile / load error that prevented any test from running. */
    error?: string;
    /** Total wall-clock time of the run, ms. */
    durationMs: number;
}

/** Editor language. "text" is a plain-text editor with no execution/tests.
 *  "java" provides syntax highlighting only — no in-browser execution. */
export type EditorLanguage = "javascript" | "python" | "text" | "java";

/** One file in a multi-file problem. `path` is shown on its editor tab and
 *  is what a sibling ProjectTreeWidget references to open it. */
export interface ProblemFile {
    path: string;
    language: EditorLanguage;
    content: string;
}

export interface ProblemDef {
    /** Function name the user must implement (single-file JS/Python problems). */
    fnName: string;
    description: string;
    /** Language the instructor fixed for this activity. The student cannot change it.
     *  Only meaningful in legacy single-file mode (no `files`). */
    language?: EditorLanguage;
    /** Legacy single-file starter, keyed by language. Superseded by `files`
     *  — kept so problems authored before multi-file support still work. */
    starter?: {
        javascript: string;
        python: string;
        text?: string;
        java?: string;
    };
    /** Multi-file mode. When present, takes priority over `starter`. */
    files?: ProblemFile[];
    tests: TestCase[];
}
