import type { ComponentType } from "react";
import { CodeEditorWidget } from "./CodeEditorWidget";
import { CodeEditorWithTreeWidget } from "./CodeEditorWithTreeWidget";
import { MermaidViewerWidget } from "./MermaidViewerWidget";
import { ProjectTreeWidget } from "./ProjectTreeWidget";
import type { SlotId } from "./types";

// Catalog of widgets available to voice mode. The admin UI lists these
// by key so an operator can assign them to a slot per LEIA. Adding a
// new widget = add an entry here and (if needed) create the React
// component plus its `useLukeTool` declarations.
export interface WidgetCatalogEntry {
    widgetType: string;
    label: string;
    description: string;
    Component: ComponentType;
}

export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
    {
        widgetType: "codeEditor",
        label: "Editor",
        description: "Monaco editor (JavaScript, Python, Java or plain text). LEIA can read, comment and rewrite the content while you talk.",
        Component: CodeEditorWidget,
    },
    {
        widgetType: "mermaidViewer",
        label: "UML Diagram",
        description: "Student-editable Mermaid source with a live preview. Only the student draws the diagram — LEIA can read it (for Socratic feedback) but has no tool to author or edit it.",
        Component: MermaidViewerWidget,
    },
    {
        widgetType: "projectTree",
        label: "Project Tree",
        description: "Read-only file/folder structure for realistic project context. Files that also exist in a sibling Editor widget are clickable and switch its active file; LEIA can read the tree but not change it.",
        Component: ProjectTreeWidget,
    },
    {
        widgetType: "codeEditorWithTree",
        label: "Editor + Project Tree (combined)",
        description: "A single panel combining the Editor and Project Tree, stacked with a resizable divider. Same tools and behavior as the two separate widgets (codeEditor_*, projectTree_read) — just one slot instead of two.",
        Component: CodeEditorWithTreeWidget,
    },
];

export const SLOT_OPTIONS: { id: SlotId; label: string }[] = [
    { id: "left", label: "Left" },
    { id: "right", label: "Right" },
    { id: "main", label: "Main (center)" },
];

export function findCatalogEntry(widgetType: string): WidgetCatalogEntry | undefined {
    return WIDGET_CATALOG.find((e) => e.widgetType === widgetType);
}
