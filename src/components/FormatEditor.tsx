import React, { useEffect, useState, memo } from 'react';
import Editor from '@monaco-editor/react';
import mermaid from 'mermaid';
import ReactMarkdown from 'react-markdown';

mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
});

interface FormatEditorProps {
  value: string;
  onChange: (value: string) => void;
  format: string;
  onError?: (error: string | null) => void;
}

// Language mapping for Monaco Editor
const getMonacoLanguage = (format: string): string => {
  const languageMap: Record<string, string> = {
    text: 'plaintext',
    mermaid: 'plaintext',
    yaml: 'yaml',
    markdown: 'markdown',
    html: 'html',
    json: 'json',
    xml: 'xml',
  };
  return languageMap[format] || 'plaintext';
};

// Validator functions for each format
const validators: Record<string, (value: string) => string | null> = {
  json: (value: string) => {
    try {
      JSON.parse(value);
      return null;
    } catch (e: any) {
      return `Invalid JSON: ${e.message}`;
    }
  },
  yaml: (value: string) => {
    // Basic YAML validation (check for common syntax errors)
    if (value.includes('\t')) {
      return 'YAML does not support tabs, use spaces for indentation';
    }
    return null;
  },
  xml: (value: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(value, 'text/xml');
      const error = doc.querySelector('parsererror');
      if (error) {
        return `Invalid XML: ${error.textContent}`;
      }
      return null;
    } catch (e: any) {
      return `Invalid XML: ${e.message}`;
    }
  },
  html: (value: string) => {
    // Basic HTML validation
    try {
      const parser = new DOMParser();
      parser.parseFromString(value, 'text/html');
      return null;
    } catch (e: any) {
      return `Invalid HTML: ${e.message}`;
    }
  },
  mermaid: (value: string) => {
    // Mermaid validation will be done through rendering
    return null;
  },
};

export const FormatEditor: React.FC<FormatEditorProps> = memo(
  ({ value, onChange, format, onError }) => {
    const [preview, setPreview] = useState<string>('');
    const [validationError, setValidationError] = useState<string | null>(null);

    // Validate content when it changes
    useEffect(() => {
      const validator = validators[format];
      if (validator) {
        const error = validator(value);
        setValidationError(error);
        onError?.(error);
      } else {
        setValidationError(null);
        onError?.(null);
      }
    }, [value, format, onError]);

    // Render Mermaid preview
    useEffect(() => {
      if (format === 'mermaid' && value) {
        const renderMermaid = async () => {
          try {
            const { svg } = await mermaid.render('mermaid-preview', value);
            setPreview(svg);
            setValidationError(null);
            onError?.(null);
          } catch (error: any) {
            let errorMessage = error.message || 'Error rendering diagram';
            if (errorMessage.includes('Syntax error in')) {
              errorMessage =
                errorMessage.split('Parse error:').pop()?.trim() || errorMessage;
            }
            setValidationError(errorMessage);
            onError?.(errorMessage);
            setPreview('');
          }
        };
        renderMermaid();
      }
    }, [value, format, onError]);

    const monacoLanguage = getMonacoLanguage(format);

    return (
      <div className="h-full flex flex-col">
        {/* Editor */}
        <div className={`${format === 'mermaid' ? 'h-1/2' : 'h-full'} relative`}>
          <Editor
            value={value}
            onChange={(val) => onChange(val || '')}
            language={monacoLanguage}
            theme="vs-light"
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              lineNumbers: 'on',
              automaticLayout: true,
              wordWrap: 'on',
            }}
          />
          {validationError && format !== 'mermaid' && (
            <div className="absolute bottom-0 left-0 right-0 bg-red-50 border-t border-red-200 p-3">
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="text-sm text-red-600 font-medium">{validationError}</div>
              </div>
            </div>
          )}
        </div>

        {/* Preview for Mermaid and Markdown */}
        {format === 'mermaid' && (
          <div className="h-1/2 border-t overflow-auto bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview</h3>
            {validationError ? (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <div className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="text-sm text-red-600 font-medium">{validationError}</div>
                </div>
              </div>
            ) : preview ? (
              <div dangerouslySetInnerHTML={{ __html: preview }} />
            ) : (
              <div className="text-gray-500 text-sm">Start typing to see preview...</div>
            )}
          </div>
        )}

        {format === 'markdown' && (
          <div className="h-1/2 border-t overflow-auto bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview</h3>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{value}</ReactMarkdown>
            </div>
          </div>
        )}

        {format === 'html' && (
          <div className="h-1/2 border-t overflow-auto bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview</h3>
            <div className="border rounded p-4">
              <div dangerouslySetInnerHTML={{ __html: value }} />
            </div>
          </div>
        )}
      </div>
    );
  }
);

FormatEditor.displayName = 'FormatEditor';
