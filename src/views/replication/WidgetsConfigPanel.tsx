import { useState } from "react";
import Editor from "@monaco-editor/react";
import { WIDGET_CATALOG, SLOT_OPTIONS } from "../../widgets";
import type { SlotId } from "../../widgets";

export interface WidgetAssignment {
    widgetType: string;
    slot: SlotId;
    params?: Record<string, unknown>;
}

interface WidgetsConfigPanelProps {
    widgets: WidgetAssignment[];
    onChange: (next: WidgetAssignment[]) => void;
}

// Default params shipped per widget type. Used when an admin first adds
// a widget — they get something usable to edit instead of an empty
// object.
interface CodeEditorParams {
    fnName: string;
    description: string;
    starter: { javascript: string; python: string };
    tests: Array<{ name: string; args: unknown[]; expected: unknown }>;
}

const DEFAULT_PARAMS: Record<string, Record<string, unknown>> = {
    codeEditor: {
        fnName: "twoSum",
        description:
            "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.",
        starter: {
            javascript:
                "function twoSum(nums, target) {\n    // your code here\n    return [];\n}\n",
            python: "def twoSum(nums, target):\n    # your code here\n    return []\n",
        },
        tests: [
            { name: "[2,7,11,15], target=9", args: [[2, 7, 11, 15], 9], expected: [0, 1] },
            { name: "[3,2,4], target=6", args: [[3, 2, 4], 6], expected: [1, 2] },
            { name: "[3,3], target=6", args: [[3, 3], 6], expected: [0, 1] },
        ] satisfies CodeEditorParams["tests"],
    } satisfies CodeEditorParams,
};

function asCodeEditorParams(value: Record<string, unknown> | undefined): CodeEditorParams {
    const def = DEFAULT_PARAMS.codeEditor as unknown as CodeEditorParams;
    if (!value) return def;
    const v = value as Partial<CodeEditorParams>;
    return {
        fnName: typeof v.fnName === "string" ? v.fnName : def.fnName,
        description: typeof v.description === "string" ? v.description : def.description,
        starter: {
            javascript: v.starter?.javascript ?? def.starter.javascript,
            python: v.starter?.python ?? def.starter.python,
        },
        tests: Array.isArray(v.tests) ? v.tests : def.tests,
    };
}

function pretty(obj: unknown): string {
    return JSON.stringify(obj, null, 2);
}

interface CodeEditorParamsFormProps {
    value: Record<string, unknown> | undefined;
    onChange: (next: Record<string, unknown>) => void;
}

function CodeEditorParamsForm({ value, onChange }: CodeEditorParamsFormProps) {
    const params = asCodeEditorParams(value);

    const update = (patch: Partial<CodeEditorParams>) => {
        onChange({ ...params, ...patch });
    };

    const updateStarter = (lang: keyof CodeEditorParams["starter"], code: string) => {
        update({ starter: { ...params.starter, [lang]: code } });
    };

    const addTest = () => {
        update({
            tests: [...params.tests, { name: `test ${params.tests.length + 1}`, args: [], expected: null }],
        });
    };

    const removeTest = (idx: number) => {
        update({ tests: params.tests.filter((_, i) => i !== idx) });
    };

    const updateTest = (idx: number, patch: Partial<CodeEditorParams["tests"][number]>) => {
        update({
            tests: params.tests.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
        });
    };

    return (
        <div className="mt-2 space-y-3">
            <div>
                <label className="block text-xs font-medium text-gray-700">Function name</label>
                <input
                    type="text"
                    value={params.fnName}
                    onChange={(e) => update({ fnName: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono"
                    placeholder="twoSum"
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-700">Problem description</label>
                <textarea
                    value={params.description}
                    onChange={(e) => update({ description: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    rows={3}
                    placeholder="Given an array..."
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-700">JavaScript starter</label>
                    <div className="mt-1 border border-gray-300 rounded overflow-hidden">
                        <Editor
                            height="120px"
                            defaultLanguage="javascript"
                            value={params.starter.javascript}
                            onChange={(v) => updateStarter("javascript", v ?? "")}
                            options={{ minimap: { enabled: false }, fontSize: 12, automaticLayout: true, scrollBeyondLastLine: false }}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700">Python starter</label>
                    <div className="mt-1 border border-gray-300 rounded overflow-hidden">
                        <Editor
                            height="120px"
                            defaultLanguage="python"
                            value={params.starter.python}
                            onChange={(v) => updateStarter("python", v ?? "")}
                            options={{ minimap: { enabled: false }, fontSize: 12, automaticLayout: true, scrollBeyondLastLine: false }}
                        />
                    </div>
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-gray-700">Tests</label>
                    <button
                        type="button"
                        onClick={addTest}
                        className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                        + Add test
                    </button>
                </div>
                {params.tests.length === 0 ? (
                    <div className="text-xs text-gray-400 italic mt-2">No tests defined.</div>
                ) : (
                    <ul className="mt-2 space-y-2">
                        {params.tests.map((t, i) => (
                            <TestRow
                                key={i}
                                test={t}
                                onChange={(patch) => updateTest(i, patch)}
                                onRemove={() => removeTest(i)}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

interface TestRowProps {
    test: CodeEditorParams["tests"][number];
    onChange: (patch: Partial<CodeEditorParams["tests"][number]>) => void;
    onRemove: () => void;
}

function TestRow({ test, onChange, onRemove }: TestRowProps) {
    const [argsDraft, setArgsDraft] = useState<string>(() => JSON.stringify(test.args));
    const [argsErr, setArgsErr] = useState<string | null>(null);
    const [expectedDraft, setExpectedDraft] = useState<string>(() => JSON.stringify(test.expected));
    const [expectedErr, setExpectedErr] = useState<string | null>(null);

    const commitArgs = (s: string) => {
        setArgsDraft(s);
        try {
            const parsed = JSON.parse(s);
            if (!Array.isArray(parsed)) throw new Error("Must be a JSON array (the function call arguments)");
            setArgsErr(null);
            onChange({ args: parsed });
        } catch (e) {
            setArgsErr(e instanceof Error ? e.message : String(e));
        }
    };

    const commitExpected = (s: string) => {
        setExpectedDraft(s);
        try {
            const parsed = JSON.parse(s);
            setExpectedErr(null);
            onChange({ expected: parsed });
        } catch (e) {
            setExpectedErr(e instanceof Error ? e.message : String(e));
        }
    };

    return (
        <li className="border border-gray-200 rounded p-2 space-y-2">
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={test.name}
                    onChange={(e) => onChange({ name: e.target.value })}
                    placeholder="test name"
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                />
                <button
                    type="button"
                    onClick={onRemove}
                    className="text-xs text-red-600 hover:text-red-800 px-2"
                    title="Remove test"
                >
                    ×
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                    <label className="block text-[11px] font-medium text-gray-600">args (JSON array)</label>
                    <input
                        type="text"
                        value={argsDraft}
                        onChange={(e) => commitArgs(e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                        placeholder='[[2,7,11,15], 9]'
                    />
                    {argsErr && <div className="text-[11px] text-red-600 mt-1">{argsErr}</div>}
                </div>
                <div>
                    <label className="block text-[11px] font-medium text-gray-600">expected (JSON)</label>
                    <input
                        type="text"
                        value={expectedDraft}
                        onChange={(e) => commitExpected(e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                        placeholder="[0, 1]"
                    />
                    {expectedErr && <div className="text-[11px] text-red-600 mt-1">{expectedErr}</div>}
                </div>
            </div>
        </li>
    );
}

interface JsonParamsEditorProps {
    widgetType: string;
    value: Record<string, unknown> | undefined;
    onChange: (next: Record<string, unknown> | undefined) => void;
}

function JsonParamsEditor({ widgetType, value, onChange }: JsonParamsEditorProps) {
    const [draft, setDraft] = useState<string>(() =>
        pretty(value ?? DEFAULT_PARAMS[widgetType] ?? {}),
    );
    const [err, setErr] = useState<string | null>(null);

    const apply = () => {
        try {
            const parsed = draft.trim() === "" ? undefined : JSON.parse(draft);
            setErr(null);
            onChange(parsed);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        }
    };

    return (
        <div>
            <div style={{ border: "1px solid #d1d5db", borderRadius: 6, overflow: "hidden" }}>
                <Editor
                    height="180px"
                    defaultLanguage="json"
                    value={draft}
                    onChange={(v) => setDraft(v ?? "")}
                    options={{ minimap: { enabled: false }, fontSize: 12, automaticLayout: true }}
                />
            </div>
            {err && <div className="text-xs text-red-600 mt-1">JSON error: {err}</div>}
            <button
                type="button"
                onClick={apply}
                className="mt-2 text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
                Apply
            </button>
        </div>
    );
}

interface ParamsSectionProps {
    widgetType: string;
    value: Record<string, unknown> | undefined;
    onChange: (next: Record<string, unknown> | undefined) => void;
}

function ParamsSection({ widgetType, value, onChange }: ParamsSectionProps) {
    const [open, setOpen] = useState(false);
    const reset = () => {
        const def = DEFAULT_PARAMS[widgetType];
        if (def) onChange(def);
    };
    const hasDefault = Boolean(DEFAULT_PARAMS[widgetType]);
    return (
        <div style={{ marginTop: 4 }}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="text-xs text-blue-600 hover:underline"
            >
                {open ? "▾" : "▸"} Configure problem &amp; tests
            </button>
            {open && (
                <div className="mt-2">
                    {widgetType === "codeEditor" ? (
                        <CodeEditorParamsForm value={value} onChange={onChange} />
                    ) : (
                        <JsonParamsEditor widgetType={widgetType} value={value} onChange={onChange} />
                    )}
                    {hasDefault && (
                        <button
                            type="button"
                            onClick={reset}
                            className="mt-3 text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                        >
                            Reset to default
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// Admin panel to assign voice-mode widgets to slots for a single LEIA.
// Rendered inside the Replication detail view only when the LEIA's
// audioMode is "luke".
export function WidgetsConfigPanel({ widgets, onChange }: WidgetsConfigPanelProps) {
    const addWidget = () => {
        const defaultType = WIDGET_CATALOG[0]?.widgetType;
        if (!defaultType) return;
        const taken = new Set(widgets.map((w) => w.slot));
        const nextSlot = (SLOT_OPTIONS.find((s) => !taken.has(s.id))?.id ?? "right") as SlotId;
        const params = DEFAULT_PARAMS[defaultType];
        onChange([...widgets, { widgetType: defaultType, slot: nextSlot, params }]);
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
                <ul className="mt-3 space-y-3">
                    {widgets.map((w, i) => {
                        const entry = WIDGET_CATALOG.find((e) => e.widgetType === w.widgetType);
                        return (
                            <li key={i} className="border border-gray-200 rounded p-2">
                                <div className="flex items-center gap-2 text-sm">
                                    <select
                                        value={w.widgetType}
                                        onChange={(e) =>
                                            updateAt(i, {
                                                widgetType: e.target.value,
                                                params: DEFAULT_PARAMS[e.target.value],
                                            })
                                        }
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
                                </div>
                                {entry && (
                                    <div className="text-xs text-gray-500 mt-1">{entry.description}</div>
                                )}
                                <ParamsSection
                                    widgetType={w.widgetType}
                                    value={w.params}
                                    onChange={(next) => updateAt(i, { params: next })}
                                />
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
