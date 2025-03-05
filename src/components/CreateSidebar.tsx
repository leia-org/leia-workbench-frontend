import React, { useRef } from 'react';
import { Editor, OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api';

interface CreateSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  yaml: string;
  onSave: (yaml: string) => void;
}

export const CreateSidebar: React.FC<CreateSidebarProps> = ({
  isOpen,
  onClose,
  title,
  yaml,
  onSave,
}) => {
  const [editedYaml, setEditedYaml] = React.useState(yaml);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configurar el esquema de validación para YAML
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      schemas: [{
        uri: "http://leia-schema/item",
        fileMatch: ['*'],
        schema: {
          type: 'object',
          required: ['kind', 'apiVersion', 'metadata', 'spec'],
          properties: {
            kind: { type: 'string' },
            apiVersion: { type: 'string' },
            metadata: {
              type: 'object',
              required: ['name', 'version'],
              properties: {
                name: { type: 'string' },
                version: { type: 'string' }
              }
            },
            spec: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                fullName: { type: 'string' }
              }
            }
          }
        }
      }]
    });
  };

  const handleSave = () => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      const markers = monacoRef.current?.editor.getModelMarkers({ resource: model?.uri });
      
      // Solo guardar si no hay errores de validación
      if (!markers?.length) {
        onSave(editedYaml);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-[9998] transition-opacity"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div 
        className={`fixed right-0 top-0 h-full w-[600px] bg-white shadow-xl z-[9999] 
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Editor */}
          <div className="flex-1 p-6">
            <Editor
              height="100%"
              language="yaml"
              theme="vs-dark"
              value={editedYaml}
              onChange={(value) => setEditedYaml(value || '')}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                wordWrap: 'on',
                formatOnPaste: true,
                formatOnType: true
              }}
            />
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end space-x-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </>
  );
}; 