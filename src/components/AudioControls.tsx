import React, { memo } from "react";
import { AudioVisualizer } from "./AudioVisualizer";

interface AudioControlsProps {
  isConnected: boolean;
  isMuted: boolean;
  isLeiaSpeaking: boolean;
  audioElement?: HTMLAudioElement | null;
  mediaStream?: MediaStream | null;
  leiaAudioStream?: MediaStream | null;
  onToggleMute: () => void;
  onEndSession: () => void;
}

export const AudioControls: React.FC<AudioControlsProps> = memo(
  ({
    isConnected,
    isMuted,
    isLeiaSpeaking,
    audioElement,
    mediaStream,
    leiaAudioStream,
    onToggleMute,
    onEndSession,
  }) => {
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
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-3">
          <div className="w-full h-20 rounded-lg overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
            <AudioVisualizer
              isActive={isConnected}
              isSpeaking={isLeiaSpeaking}
              audioElement={audioElement}
              mediaStream={mediaStream}
              leiaAudioStream={leiaAudioStream}
            />
          </div>
        </div>

        <div className="text-center mb-3">
          <div className="flex items-center justify-center gap-2">
            {isLeiaSpeaking ? (
              <>
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
                <p className="text-sm font-medium text-gray-900">LEIA is speaking...</p>
              </>
            ) : isMuted ? (
              <>
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                </svg>
                <p className="text-sm font-medium text-gray-900">Microphone muted</p>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <p className="text-sm font-medium text-gray-900">Listening...</p>
              </>
            )}
          </div>
        </div>

        <button
          onClick={onToggleMute}
          disabled={!isConnected}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isMuted
              ? "bg-gray-600 hover:bg-gray-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
        >
          {isMuted ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
              </svg>
              Unmute Microphone
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Mute Microphone
            </span>
          )}
        </button>
      </div>
    );
  }
);

AudioControls.displayName = "AudioControls";
