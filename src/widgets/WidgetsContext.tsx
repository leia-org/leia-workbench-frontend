import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { FrontendTool } from "@leia-org/luke-client";
import type { SlotId, ToolsMap, WidgetDefinition } from "./types";

interface WidgetsContextValue {
    widgets: WidgetDefinition[];
    /** All widgets assigned to a slot. Usually one, but instructors can
     *  stack several in the same slot. */
    widgetsForSlot: (slot: SlotId) => WidgetDefinition[];
    tools: ToolsMap;
    registerTool: (name: string, tool: FrontendTool) => void;
    unregisterTool: (name: string) => void;
    /** Path of the file currently open in a CodeEditorWidget. Shared so a
     *  sibling ProjectTreeWidget can highlight/switch it by clicking a
     *  file node. */
    activeFile: string | null;
    setActiveFile: (path: string | null) => void;
    /** The student's current answer, as published by whichever widget owns
     *  the submission format (e.g. MermaidViewerWidget). Read by Chat.tsx's
     *  SubmissionBridge to post to /result. */
    submissionContent: string | null;
    setSubmissionContent: (code: string | null) => void;
    /** The current session's id, so a widget can ask the backend for its
     *  scenario files (GET /interactions/:sessionId/scenario-files) without
     *  ever knowing which pattern/scenario it got — the client must never
     *  see that (it names the answer), so resolution stays server-side. */
    sessionId: string | null;
}

const WidgetsContext = createContext<WidgetsContextValue | null>(null);

interface WidgetsProviderProps {
    widgets: WidgetDefinition[];
    /** See WidgetsContextValue.sessionId. Passed in from outside (Chat.tsx's
     *  `sessionId` route param) rather than owned here. */
    sessionId?: string | null;
    children: ReactNode;
}

// Hosts the tool registry shared by all mounted widgets. When a widget
// mounts it calls `useLukeTool` which registers here; on unmount it
// unregisters. The `tools` object reference changes whenever the set
// changes, so consumers can depend on it to trigger a Luke reload.
export function WidgetsProvider({ widgets, sessionId = null, children }: WidgetsProviderProps) {
    const [tools, setTools] = useState<ToolsMap>({});
    const [activeFile, setActiveFile] = useState<string | null>(null);
    const [submissionContent, setSubmissionContent] = useState<string | null>(null);

    const registerTool = useCallback((name: string, tool: FrontendTool) => {
        setTools((prev) => ({ ...prev, [name]: tool }));
    }, []);

    const unregisterTool = useCallback((name: string) => {
        setTools((prev) => {
            if (!(name in prev)) return prev;
            const next = { ...prev };
            delete next[name];
            return next;
        });
    }, []);

    const widgetsForSlot = useCallback(
        (slot: SlotId) => widgets.filter((w) => w.slot === slot),
        [widgets]
    );

    const value = useMemo<WidgetsContextValue>(
        () => ({
            widgets,
            widgetsForSlot,
            tools,
            registerTool,
            unregisterTool,
            activeFile,
            setActiveFile,
            submissionContent,
            setSubmissionContent,
            sessionId,
        }),
        [widgets, widgetsForSlot, tools, registerTool, unregisterTool, activeFile, submissionContent, sessionId]
    );

    return <WidgetsContext.Provider value={value}>{children}</WidgetsContext.Provider>;
}

export function useWidgetsContext(): WidgetsContextValue {
    const ctx = useContext(WidgetsContext);
    if (!ctx) throw new Error("useWidgetsContext must be used inside <WidgetsProvider>");
    return ctx;
}

// Optional variant for components that can live without a provider
// (returns an empty registry).
export function useWidgetsContextOptional(): WidgetsContextValue | null {
    return useContext(WidgetsContext);
}
