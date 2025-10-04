import React, { useEffect, memo } from 'react';
import Editor from '@monaco-editor/react';

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

// Format-specific editor configurations
const getEditorConfig = (format: string) => {
  const baseConfig = {
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 14,
    lineNumbers: 'on' as const,
    automaticLayout: true,
    wordWrap: 'on' as const,
  };

  switch (format) {
    case 'json':
      return {
        ...baseConfig,
        formatOnPaste: true,
        formatOnType: true,
        autoIndent: 'full' as const,
      };
    case 'yaml':
      return {
        ...baseConfig,
        insertSpaces: true,
        tabSize: 2,
        detectIndentation: true,
      };
    case 'xml':
    case 'html':
      return {
        ...baseConfig,
        formatOnPaste: true,
        autoIndent: 'full' as const,
      };
    default:
      return baseConfig;
  }
};

// Validator functions for each format
const validators: Record<string, (value: string) => string | null> = {
  json: (value: string) => {
    if (!value.trim()) return null;
    try {
      JSON.parse(value);
      return null;
    } catch (e: any) {
      return `Invalid JSON: ${e.message}`;
    }
  },
  yaml: (value: string) => {
    if (!value.trim()) return null;
    // Basic YAML validation (check for common syntax errors)
    if (value.includes('\t')) {
      return 'YAML does not support tabs, use spaces for indentation';
    }
    return null;
  },
  xml: (value: string) => {
    if (!value.trim()) return null;
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
    if (!value.trim()) return null;
    // Basic HTML validation
    try {
      const parser = new DOMParser();
      parser.parseFromString(value, 'text/html');
      return null;
    } catch (e: any) {
      return `Invalid HTML: ${e.message}`;
    }
  },
};

export const FormatEditor: React.FC<FormatEditorProps> = memo(
  ({ value, onChange, format, onError }) => {
    // Validate content when it changes
    useEffect(() => {
      const validator = validators[format];
      if (validator) {
        const error = validator(value);
        onError?.(error);
      } else {
        onError?.(null);
      }
    }, [value, format, onError]);

    const monacoLanguage = getMonacoLanguage(format);
    const editorConfig = getEditorConfig(format);

    return (
      <div className="h-full relative">
        <Editor
          value={value}
          onChange={(val) => onChange(val || '')}
          language={monacoLanguage}
          theme="vs-light"
          options={editorConfig}
        />
      </div>
    );
  }
);

FormatEditor.displayName = 'FormatEditor';
