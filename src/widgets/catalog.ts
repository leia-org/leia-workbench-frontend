import type { ComponentType } from "react";
import { CodeEditorWidget } from "./CodeEditorWidget";
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
        description: "Monaco editor (JavaScript, Python or plain text). LEIA can read, comment and rewrite the content while you talk.",
        Component: CodeEditorWidget,
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
