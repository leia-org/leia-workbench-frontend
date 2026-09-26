import type { ProblemFile } from "./types";
import type { ProjectTreeNode } from "../ProjectTreeWidget";

// Fetches scenario files for the given session via our own backend
// (GET /interactions/:sessionId/scenario-files) — never a source repo
// directly from the browser. Which repo/folder a session's files come from
// names the answer the exercise expects, so the backend resolves that
// server-side and returns only file contents; a client-side request or
// payload naming it would leak the answer to anyone reading the Network tab.
//
// Returns null when this session's problem has no scenario source configured
// (backend responds 404) — the normal case for most problems, meaning "use
// the static codeEditor/projectTree params instead", not an error.
export async function fetchScenarioFiles(
    sessionId: string,
): Promise<{ files: ProblemFile[]; tree: ProjectTreeNode[] } | null> {
    const res = await fetch(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions/${sessionId}/scenario-files`,
    );
    if (res.status === 404) return null;
    if (!res.ok) {
        throw new Error(`Could not load scenario files (HTTP ${res.status})`);
    }
    const data = (await res.json()) as { files: ProblemFile[] };
    const tree: ProjectTreeNode[] = data.files.map((f) => ({
        name: f.path,
        type: "file",
        path: f.path,
    }));
    return { files: data.files, tree };
}
