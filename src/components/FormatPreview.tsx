import React, { memo } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import ReactMarkdown from 'react-markdown';

interface FormatPreviewProps {
  code: string;
  format: string;
  mermaidSvg?: string;
  error?: string | null;
  concluded?: boolean;
  renderControls?: (utils: any) => React.ReactNode;
}

export const FormatPreview: React.FC<FormatPreviewProps> = memo(
  ({ code, format, mermaidSvg, error, concluded, renderControls }) => {
    return (
      <div className="h-full bg-gray-50 flex flex-col relative">
        {concluded ? (
          <h2 className="text-gray-500 px-4 py-2">Your Solution</h2>
        ) : null}

        {/* Mermaid Preview with Zoom/Pan */}
        {format === 'mermaid' && (
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={4}
            centerOnInit={true}
            wheel={{ wheelDisabled: true }}
          >
            {(utils) => (
              <>
                <TransformComponent
                  wrapperClass="!w-full !h-full"
                  contentClass="flex items-center justify-center p-4"
                >
                  {mermaidSvg ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: mermaidSvg }}
                      className="transform-component-module_content__uCDPE"
                    />
                  ) : (
                    <div className="text-gray-500">Loading preview...</div>
                  )}
                </TransformComponent>
                {renderControls && renderControls(utils)}
              </>
            )}
          </TransformWrapper>
        )}

        {/* Markdown Preview */}
        {format === 'markdown' && (
          <div className="h-full overflow-auto p-6">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{code}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* HTML Preview */}
        {format === 'html' && (
          <div className="h-full overflow-auto p-6">
            <div className="border rounded bg-white p-4">
              <div dangerouslySetInnerHTML={{ __html: code }} />
            </div>
          </div>
        )}

        {/* JSON Preview - Formatted */}
        {format === 'json' && (
          <div className="h-full overflow-auto p-6">
            <div className="bg-white border rounded p-4">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(code), null, 2);
                  } catch {
                    return code;
                  }
                })()}
              </pre>
            </div>
          </div>
        )}

        {/* YAML, XML, Text - Plain Preview */}
        {(format === 'yaml' || format === 'xml' || format === 'text') && (
          <div className="h-full overflow-auto p-6">
            <div className="bg-white border rounded p-4">
              <pre className="text-sm font-mono whitespace-pre-wrap">{code}</pre>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg">
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
              <div className="text-sm text-red-600 font-medium">{error}</div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

FormatPreview.displayName = 'FormatPreview';
