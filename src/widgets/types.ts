import type { ComponentType } from "react";
import type { FrontendTool } from "@leia-org/luke-client";

export type SlotId = "left" | "right" | "main";

// A widget declaration authored by the workbench. `Component` is mounted
// when the widget is assigned to a slot. Tools are registered dynamically
// by the component itself via `useLukeTool`.
export interface WidgetDefinition {
    id: string;
    slot: SlotId;
    title?: string;
    Component: ComponentType;
}

// A namespaced tool entry in the registry. The key is the fully-qualified
// tool name that the LLM sees (e.g. "codeEditor.read").
export type ToolsMap = Record<string, FrontendTool>;
