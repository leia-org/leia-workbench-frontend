import React, { memo } from "react";

interface LukeAudioControlsProps {
  isConnected: boolean;
  isMuted: boolean;
  forceMute: boolean;
  onToggleMute: () => void;
  onEndSession: () => void;
}

export const LukeAudioControls: React.FC<LukeAudioControlsProps> = memo(
  ({ isConnected, isMuted, forceMute, onToggleMute, onEndSession }) => {
    return (
      <div className="fixed bottom-8 right-8 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 w-80 z-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500 animate-pulse" : "bg-gray-300"
              }`}
            />
            <span className="text-xs font-medium text-gray-700">
              {isConnected ? "Connected" : "Connecting..."}
            </span>
          </div>
          <button
            onClick={onEndSession}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="End session"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="text-center mb-3">
          <div className="flex items-center justify-center gap-2">
            {isMuted ? (
              <>
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3l18 18"
                  />
                </svg>
                <p className="text-sm font-medium text-gray-900">
                  Microphone muted
                </p>
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
                <p className="text-sm font-medium text-gray-900">
                  Listening...
                </p>
              </>
            )}
          </div>
        </div>

        <button
          onClick={onToggleMute}
          disabled={!isConnected || forceMute}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isMuted
              ? "bg-gray-600 hover:bg-gray-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
        >
          {isMuted ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3l18 18"
                />
              </svg>
              Unmute Microphone
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              Mute Microphone
            </span>
          )}
        </button>
      </div>
    );
  },
);

LukeAudioControls.displayName = "LukeAudioControls";
