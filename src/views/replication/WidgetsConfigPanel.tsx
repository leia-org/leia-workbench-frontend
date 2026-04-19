import { WIDGET_CATALOG, SLOT_OPTIONS } from "../../widgets";
import type { SlotId } from "../../widgets";

export interface WidgetAssignment {
    widgetType: string;
    slot: SlotId;
}

interface WidgetsConfigPanelProps {
    widgets: WidgetAssignment[];
    onChange: (next: WidgetAssignment[]) => void;
}

// Admin panel to assign voice-mode widgets to slots for a single LEIA.
// Rendered inside the Replication detail view only when the LEIA's
// audioMode is "luke".
export function WidgetsConfigPanel({ widgets, onChange }: WidgetsConfigPanelProps) {
    const addWidget = () => {
        const defaultType = WIDGET_CATALOG[0]?.widgetType;
        if (!defaultType) return;
        // Pick the first slot that isn't taken yet, fall back to "right".
        const taken = new Set(widgets.map((w) => w.slot));
        const nextSlot = (SLOT_OPTIONS.find((s) => !taken.has(s.id))?.id ?? "right") as SlotId;
        onChange([...widgets, { widgetType: defaultType, slot: nextSlot }]);
    };

    const removeAt = (idx: number) => {
        onChange(widgets.filter((_, i) => i !== idx));
    };

    const updateAt = (idx: number, patch: Partial<WidgetAssignment>) => {
        onChange(widgets.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
    };

    return (
        <div className="mt-4 border-t border-gray-200 pt-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700">Voice widgets</h4>
                <button
                    type="button"
                    onClick={addWidget}
                    className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                    + Add widget
                </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
                Widgets mounted in the voice-mode UI for this LEIA. Each widget exposes tool-calls to LEIA so it can read from / act on it.
            </p>

            {widgets.length === 0 ? (
                <div className="text-xs text-gray-400 italic mt-3">No widgets configured.</div>
            ) : (
                <ul className="mt-3 space-y-2">
                    {widgets.map((w, i) => {
                        const entry = WIDGET_CATALOG.find((e) => e.widgetType === w.widgetType);
                        return (
                            <li key={i} className="flex items-center gap-2 text-sm">
                                <select
                                    value={w.widgetType}
                                    onChange={(e) => updateAt(i, { widgetType: e.target.value })}
                                    className="border border-gray-300 rounded px-2 py-1 text-sm flex-1"
                                >
                                    {WIDGET_CATALOG.map((c) => (
                                        <option key={c.widgetType} value={c.widgetType}>
                                            {c.label}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={w.slot}
                                    onChange={(e) => updateAt(i, { slot: e.target.value as SlotId })}
                                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                                >
                                    {SLOT_OPTIONS.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.label}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => removeAt(i)}
                                    className="text-xs text-red-600 hover:text-red-800 px-2"
                                    title="Remove widget"
                                >
                                    ×
                                </button>
                                {entry && (
                                    <span className="text-xs text-gray-400 truncate max-w-[200px]" title={entry.description}>
                                        {entry.description}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
