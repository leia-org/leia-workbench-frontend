import React, { useEffect, useRef, useState } from "react";
import { useLuke } from "@leia-org/luke-client";
import type { FrontendTool, TranscriptionMessage } from "@leia-org/luke-client";
import { PersonaAvatar } from "./PersonaAvatar";

interface LukeConfig {
  provider: string;
  voice: string;
}

interface LukeAudioWidgetProps {
  wsUrl: string;
  token: string;
  lukeConfig: LukeConfig;
  /** Display name for the LEIA — used in the avatar fallback. */
  leiaName?: string;
  /** Persona avatar URL or storage key, when available. */
  avatarSrc?: string;
  /** Fallback avatar path to try before initials placeholder. */
  avatarFallbackSrc?: string;
  forceMute?: boolean;
  /** Initial visibility of the transcription side panel. */
  showTranscription?: boolean;
  /** Kept for backward compat with previous widget; not used by the new UI. */
  mode?: string;
  /** Frontend tools exposed to the model for this session. Changing the
   *  reference triggers a Luke reconnect so the new set is declared at
   *  provider setup (works for both OpenAI and Gemini). */
  tools?: Record<string, FrontendTool>;
  /** Content rendered in the left slot, next to the avatar. */
  leftSlot?: React.ReactNode;
  /** Content rendered in the right slot, next to the avatar. */
  rightSlot?: React.ReactNode;
  onTranscriptComplete?: (
    transcript: string,
    isLeia: boolean,
    timestamp: Date,
    sequence: number,
  ) => void;
  onError?: (error: Error) => void;
}

const MicIcon: React.FC<{ muted: boolean }> = ({ muted }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {muted ? (
      <>
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
        <line x1="12" y1="19" x2="12" y2="23" />
      </>
    ) : (
      <>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </>
    )}
  </svg>
);

const TranscriptIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);

const CloseIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * Bottom-anchored bokeh voice wave.
 *
 * Rises from the bottom of the screen with a height driven by the
 * smoothed user RMS level. Rendered as THREE stacked blurred layers so
 * the top edge feathers out like out-of-focus bokeh — the higher the
 * layer, the more blur and less opacity it carries.
 *
 * Layers (bottom → top):
 *   0. sharp base: light blur, highest opacity, defines the "liquid" body
 *   1. mid glow: heavier blur, medium opacity
 *   2. top haze: very heavy blur, low opacity, ranges well above the surface
 *
 * The surface of each layer is an animated sum of several sines so it
 * ripples organically.
 */
const UserWaveform: React.FC<{ level: number; active: boolean }> = ({ level, active }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const levelRef = useRef(0);
  const targetLevelRef = useRef(0);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
    targetLevelRef.current = active ? level : 0;
  }, [active, level]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let t = 0;

    // Draw a filled wave shape closed at the bottom of the canvas.
    // `heightFrac` is the fraction of the canvas height this particular
    // layer should reach at current level.
    const drawWaveShape = (
      w: number,
      h: number,
      heightFrac: number,
      rippleAmp: number,
      phaseOffset: number,
      freqScale: number,
    ) => {
      const maxHeight = h * heightFrac;
      const liveHeight = Math.min(levelRef.current * 7, 1) * maxHeight;
      // Idle breathing so it never fully collapses.
      const breathing = Math.sin(t * 0.015) * h * 0.015 + h * 0.07;
      const totalHeight = Math.max(breathing, liveHeight);
      const waveTop = h - totalHeight;

      ctx.beginPath();
      ctx.moveTo(0, h);
      const step = Math.max(2, Math.floor(w / 240));
      for (let x = 0; x <= w; x += step) {
        const px = x / w;
        const s1 = Math.sin(px * Math.PI * 2 * 1.3 * freqScale + t * 0.022 + phaseOffset);
        const s2 = Math.sin(px * Math.PI * 2 * 2.1 * freqScale + t * 0.015 + 1.1 + phaseOffset);
        const s3 = Math.sin(px * Math.PI * 2 * 0.7 * freqScale + t * 0.028 + 2.3 + phaseOffset);
        const ripple = s1 * 0.5 + s2 * 0.3 + s3 * 0.2;
        const y = waveTop + ripple * rippleAmp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
    };

    const loop = () => {
      t += 1;
      // Smooth toward target level, quick attack / slow decay so it never
      // snaps to zero the instant you stop speaking.
      const target = targetLevelRef.current;
      const smoothing = target > levelRef.current ? 0.35 : 0.06;
      levelRef.current += (target - levelRef.current) * smoothing;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Layer 2 — top haze: heavy blur, very transparent
      ctx.save();
      ctx.filter = `blur(${32 * dpr}px)`;
      drawWaveShape(w, h, 0.85, h * 0.05, 0.6, 0.85);
      let grad = ctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, "rgba(99, 102, 241, 0.45)");
      grad.addColorStop(0.5, "rgba(59, 130, 246, 0.2)");
      grad.addColorStop(1, "rgba(6, 182, 212, 0)");
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      // Layer 1 — mid glow
      ctx.save();
      ctx.filter = `blur(${18 * dpr}px)`;
      drawWaveShape(w, h, 0.65, h * 0.04, 0.3, 0.95);
      grad = ctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, "rgba(99, 102, 241, 0.6)");
      grad.addColorStop(0.5, "rgba(59, 130, 246, 0.3)");
      grad.addColorStop(1, "rgba(6, 182, 212, 0)");
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      // Layer 0 — base body
      ctx.save();
      ctx.filter = `blur(${9 * dpr}px)`;
      drawWaveShape(w, h, 0.48, h * 0.03, 0, 1.0);
      grad = ctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, "rgba(99, 102, 241, 0.8)");
      grad.addColorStop(0.5, "rgba(59, 130, 246, 0.4)");
      grad.addColorStop(1, "rgba(6, 182, 212, 0)");
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute bottom-0 left-0 w-full h-[32%] pointer-events-none"
      aria-hidden="true"
    />
  );
};

export const LukeAudioWidget: React.FC<LukeAudioWidgetProps> = ({
  wsUrl,
  token,
  lukeConfig,
  leiaName,
  avatarSrc,
  avatarFallbackSrc,
  forceMute = false,
  showTranscription: initialShowTranscription = false,
  tools,
  leftSlot,
  rightSlot,
  onTranscriptComplete,
  onError,
}) => {
  const {
    connectionState,
    isConnected,
    providers,
    selectedProvider,
    selectProvider,
    reload,
    isRecording,
    startRecording,
    stopRecording,
    audioLevel,
    assistantAudioLevel,
    transcription,
    sessionId,
  } = useLuke({
    serverUrl: wsUrl,
    authToken: token,
    autoConnect: true,
    tools,
    onError,
  });

  // Auto-selection is keyed on `sessionId` rather than a boolean flag.
  // When the WS reconnects (tools change → reload), `sessionId` flips,
  // re-triggering the effect; a stale flag would let connection N+1
  // inherit a "done" state and never re-select the configured provider.
  const lastSelectedSessionRef = useRef<string | null>(null);
  const lastStartedSessionRef = useRef<string | null>(null);

  // Track the tools set that the provider currently has declared.
  // Only commit a new snapshot once we've actually re-opened the WS
  // with it — otherwise a tools change during "connecting" would
  // silently overwrite the ref and we'd never reload.
  const committedToolsRef = useRef(tools);
  useEffect(() => {
    if (connectionState !== "connected") return;
    if (committedToolsRef.current === tools) return;
    committedToolsRef.current = tools;
    reload();
  }, [tools, connectionState, reload]);
  const prevForceMuteRef = useRef(forceMute);
  const sequenceCounterRef = useRef(0);
  const emittedCountRef = useRef(0);
  const [showTranscription, setShowTranscription] = useState(initialShowTranscription);
  const transcriptListRef = useRef<HTMLDivElement | null>(null);

  // Autoscroll the transcript panel to the latest message whenever it
  // grows OR re-opens.
  useEffect(() => {
    if (!showTranscription) return;
    const el = transcriptListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [transcription, showTranscription]);

  // Auto-select the configured provider/voice once connected. Runs
  // once per session — when reload() opens a new WS, sessionId changes
  // and the effect fires again on the fresh connection.
  useEffect(() => {
    if (
      isConnected &&
      providers.length > 0 &&
      lukeConfig &&
      sessionId &&
      lastSelectedSessionRef.current !== sessionId
    ) {
      const target = providers.find((p) => p.name === lukeConfig.provider);
      if (target) {
        selectProvider(target.id, lukeConfig.voice);
        lastSelectedSessionRef.current = sessionId;
      }
    }
  }, [isConnected, providers, lukeConfig, selectProvider, sessionId]);

  // Auto-start recording ONCE per session, after the configured
  // provider has been auto-selected.
  useEffect(() => {
    if (
      selectedProvider &&
      !isRecording &&
      sessionId &&
      lastSelectedSessionRef.current === sessionId &&
      lastStartedSessionRef.current !== sessionId &&
      !forceMute
    ) {
      lastStartedSessionRef.current = sessionId;
      startRecording().catch((err) => {
        console.error("Failed to start recording:", err);
      });
    }
  }, [selectedProvider, isRecording, startRecording, forceMute, sessionId]);

  // Edge-triggered forceMute handler — does NOT re-fire on isRecording changes.
  useEffect(() => {
    const prev = prevForceMuteRef.current;
    prevForceMuteRef.current = forceMute;
    if (!prev && forceMute) {
      if (isRecording) stopRecording();
    } else if (prev && !forceMute) {
      if (selectedProvider && lastSelectedSessionRef.current && !isRecording) {
        startRecording().catch(console.error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceMute]);

  // Emit new final transcriptions upward as the hook's transcription state grows.
  useEffect(() => {
    if (!onTranscriptComplete) {
      emittedCountRef.current = transcription.length;
      return;
    }
    for (let i = emittedCountRef.current; i < transcription.length; i++) {
      const msg: TranscriptionMessage = transcription[i];
      if (msg.final) {
        onTranscriptComplete(
          msg.text,
          msg.role === "assistant",
          new Date(msg.timestamp || Date.now()),
          sequenceCounterRef.current++,
        );
      }
    }
    emittedCountRef.current = transcription.length;
  }, [transcription, onTranscriptComplete]);

  // Halo around the avatar pulses with the ASSISTANT's audio level so you
  // can tell when the LEIA is speaking. The user's own level drives the
  // bottom waveform visualizer instead.
  const haloScale = 1 + Math.min(assistantAudioLevel * 6, 1.4);
  const haloOpacity = 0.15 + Math.min(assistantAudioLevel * 3, 0.4);

  const statusText =
    connectionState === "connecting"
      ? "Connecting..."
      : connectionState === "error"
      ? "Connection error"
      : !selectedProvider
      ? "Initializing..."
      : forceMute
      ? "Muted"
      : isRecording
      ? "Listening"
      : "Microphone off";

  const toggleMute = () => {
    if (forceMute) return;
    if (isRecording) stopRecording();
    else startRecording().catch(console.error);
  };

  return (
    <div className="flex-1 relative flex flex-col bg-neutral-900 text-white overflow-hidden">
      {/* Top bar — transcription toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => setShowTranscription((v) => !v)}
          className="p-2 rounded-full bg-neutral-800/80 hover:bg-neutral-700 backdrop-blur border border-neutral-700 transition-colors"
          title={showTranscription ? "Hide transcript" : "Show transcript"}
        >
          <TranscriptIcon />
        </button>
      </div>

      {/* Main stage with optional left/right widget slots */}
      <div className="flex-1 flex items-stretch min-h-0">
        {leftSlot && (
          <div className="w-1/2 max-w-[50%] h-full border-r border-neutral-800 bg-neutral-900/90 flex flex-col overflow-hidden z-10">
            {leftSlot}
          </div>
        )}
        <div className="flex-1 flex flex-col items-center justify-center px-6 select-none relative">
        <div className="relative flex items-center justify-center">
          {/* Animated halo — scales with audioLevel */}
          <div
            className="absolute w-44 h-44 rounded-full bg-blue-500 pointer-events-none"
            style={{
              transform: `scale(${haloScale})`,
              opacity: haloOpacity,
              transition: "transform 90ms ease-out, opacity 90ms ease-out",
              filter: "blur(2px)",
            }}
          />
          <div
            className="absolute w-44 h-44 rounded-full border-2 border-blue-400/30 pointer-events-none"
            style={{
              transform: `scale(${haloScale * 1.15})`,
              opacity: haloOpacity * 0.8,
              transition: "transform 120ms ease-out, opacity 120ms ease-out",
            }}
          />

          <PersonaAvatar
            src={avatarSrc}
            fallbackSrc={avatarFallbackSrc}
            alt={`${leiaName || "LEIA"} avatar`}
            label={leiaName || "LEIA"}
            size="xl"
            className="relative text-white shadow-2xl"
            fallbackClassName="bg-gradient-to-br from-blue-500 to-blue-900"
          />
        </div>

        {leiaName && (
          <div className="mt-8 text-lg font-medium text-neutral-200">
            {leiaName}
          </div>
        )}
        <div className="mt-2 text-sm text-neutral-500">{statusText}</div>
        </div>
        {rightSlot && (
          <div className="w-1/2 max-w-[50%] h-full border-l border-neutral-800 bg-neutral-900/90 flex flex-col overflow-hidden z-10">
            {rightSlot}
          </div>
        )}
      </div>

      {/* Animated user voice wave: rises from the bottom, fades upward */}
      <UserWaveform level={audioLevel} active={isRecording && !forceMute} />

      {/* Bottom controls — just mute/unmute */}
      <div className="relative py-6 flex items-center justify-center z-10">
        <button
          onClick={toggleMute}
          disabled={!selectedProvider || forceMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
            forceMute || !selectedProvider
              ? "bg-neutral-700 text-neutral-400 cursor-not-allowed"
              : isRecording
              ? "bg-white text-neutral-900 hover:bg-neutral-200"
              : "bg-red-500 text-white hover:bg-red-600"
          }`}
          title={isRecording ? "Mute microphone" : "Unmute microphone"}
          aria-label={isRecording ? "Mute" : "Unmute"}
        >
          <MicIcon muted={!isRecording} />
        </button>
      </div>

      {/* Transcription side panel */}
      {showTranscription && (
        <div className="absolute top-0 right-0 h-full w-80 max-w-[85%] bg-neutral-900/95 backdrop-blur border-l border-neutral-800 flex flex-col z-30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
            <div className="font-medium">Transcript</div>
            <button
              onClick={() => setShowTranscription(false)}
              className="p-1 rounded-full hover:bg-neutral-800 transition-colors"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
          <div ref={transcriptListRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {transcription.length === 0 ? (
              <div className="text-sm text-neutral-500 italic">
                No transcript yet.
              </div>
            ) : (
              transcription.map((msg, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="text-xs text-neutral-500">
                    {msg.role === "assistant" ? leiaName || "LEIA" : "You"}
                  </div>
                  <div
                    className={`text-sm leading-relaxed ${
                      msg.role === "assistant"
                        ? "text-blue-200"
                        : "text-neutral-100"
                    } ${msg.final ? "" : "opacity-70 italic"}`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
