import { useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useLukeTool } from "./useLukeTool";

// Minimal subset of monaco's IStandaloneCodeEditor that we actually use.
// Avoids pulling the heavy monaco-editor type package as a direct dep.
interface MinimalEditor {
    getValue(): string;
    getSelection(): unknown | null;
    executeEdits(source: string, edits: Array<{
        range: unknown;
        text: string;
        forceMoveMarkers?: boolean;
    }>): boolean;
}

// A widget showing a Monaco editor and exposing three tools to the model:
//   - codeEditor.read           → full editor content
//   - codeEditor.addComment     → insert "// text" above a given line
//   - codeEditor.replaceSelection → overwrite current selection
//
// The component holds the editor handle in a ref; the tool handlers close
// over it via the ref-backed `useLukeTool` so LEIA always talks to the
// live editor instance.
export function CodeEditorWidget() {
    const editorRef = useRef<MinimalEditor | null>(null);
    const [language, setLanguage] = useState<string>("javascript");
    const defaultValue = `// Luke can read, comment on, and rewrite this file.\nfunction greet(name) {\n    return "Hello, " + name;\n}\n\nconsole.log(greet("LEIA"));\n`;

    useLukeTool(
        "codeEditor_read",
        "Reads the current full text of the in-page code editor. Returns { content, language }.",
        { type: "object", properties: {} },
        async () => ({
            content: editorRef.current?.getValue() ?? "",
            language,
        })
    );

    useLukeTool(
        "codeEditor_addComment",
        "Inserts a comment line above the given 1-based line number. Use to annotate code for the user.",
        {
            type: "object",
            properties: {
                line: { type: "number", description: "1-based line number to comment above" },
                text: { type: "string", description: "Comment text (without the leading //)" },
            },
            required: ["line", "text"],
        },
        async (args) => {
            const line = Math.max(1, Number(args.line ?? 1));
            const text = String(args.text ?? "");
            const ed = editorRef.current;
            if (!ed) return { ok: false, error: "editor-not-mounted" };
            const commentLine = `// ${text}\n`;
            ed.executeEdits("luke-add-comment", [
                {
                    range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
                    text: commentLine,
                    forceMoveMarkers: true,
                },
            ]);
            return { ok: true };
        }
    );

    useLukeTool(
        "codeEditor_replaceSelection",
        "Replaces the editor's current selection with the given text. If nothing is selected, inserts at the cursor.",
        {
            type: "object",
            properties: {
                text: { type: "string", description: "Replacement text" },
            },
            required: ["text"],
        },
        async (args) => {
            const text = String(args.text ?? "");
            const ed = editorRef.current;
            if (!ed) return { ok: false, error: "editor-not-mounted" };
            const sel = ed.getSelection();
            if (sel) {
                ed.executeEdits("luke-replace-selection", [
                    { range: sel, text, forceMoveMarkers: true },
                ]);
            }
            return { ok: true };
        }
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 360 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>Code editor</span>
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{ marginLeft: "auto", background: "rgba(0,0,0,0.3)", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: "2px 6px", fontSize: 12 }}
                >
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="python">Python</option>
                    <option value="json">JSON</option>
                </select>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
                <Editor
                    defaultValue={defaultValue}
                    language={language}
                    theme="vs-dark"
                    onMount={((ed) => {
                        editorRef.current = ed as unknown as MinimalEditor;
                    }) as OnMount}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                    }}
                />
            </div>
        </div>
    );
}
