import React, { useEffect, useRef, useCallback } from "react";
import {
  LukeProvider,
  useLukeContext,
  VoiceClientUI,
} from "@leia-org/luke-client";
import type { TranscriptionMessage, LukeUIMode } from "@leia-org/luke-client";
import "@leia-org/luke-client/style.css";

interface LukeConfig {
  provider: string;
  voice: string;
}

interface LukeAudioWidgetProps {
  wsUrl: string;
  token: string;
  lukeConfig: LukeConfig;
  forceMute?: boolean;
  mode?: LukeUIMode;
  onTranscriptComplete?: (
    transcript: string,
    isLeia: boolean,
    timestamp: Date,
    sequence: number,
  ) => void;
  onError?: (error: Error) => void;
}

// Inner component that uses LukeContext
const LukeAudioInner: React.FC<{
  lukeConfig: LukeConfig;
  forceMute?: boolean;
  mode?: LukeUIMode;
  onTranscriptComplete?: (
    transcript: string,
    isLeia: boolean,
    timestamp: Date,
    sequence: number,
  ) => void;
}> = ({ lukeConfig, forceMute = false, mode = "inline", onTranscriptComplete }) => {
  const {
    isConnected,
    providers,
    selectedProvider,
    selectProvider,
    isRecording,
    startRecording,
    stopRecording,
  } = useLukeContext();

  const hasAutoSelectedRef = useRef(false);
  const sequenceCounterRef = useRef(0);

  // Auto-select provider and voice after connection
  useEffect(() => {
    if (
      isConnected &&
      providers.length > 0 &&
      lukeConfig &&
      !hasAutoSelectedRef.current
    ) {
      const targetProvider = providers.find(
        (p) => p.name === lukeConfig.provider,
      );
      if (targetProvider) {
        selectProvider(targetProvider.id, lukeConfig.voice);
        hasAutoSelectedRef.current = true;
      }
    }
  }, [isConnected, providers, lukeConfig, selectProvider]);

  // Auto-start recording after provider is selected
  useEffect(() => {
    if (
      selectedProvider &&
      !isRecording &&
      hasAutoSelectedRef.current &&
      !forceMute
    ) {
      startRecording().catch((err) => {
        console.error("Failed to start recording:", err);
      });
    }
  }, [selectedProvider, isRecording, startRecording, forceMute]);

  // Handle forceMute
  useEffect(() => {
    if (forceMute && isRecording) {
      stopRecording();
    } else if (
      !forceMute &&
      !isRecording &&
      selectedProvider &&
      hasAutoSelectedRef.current
    ) {
      startRecording().catch(console.error);
    }
  }, [forceMute, isRecording, selectedProvider, startRecording, stopRecording]);

  // Handle transcription callback
  const handleTranscription = useCallback(
    (msg: TranscriptionMessage) => {
      if (!msg.final) return;
      const isLeia = msg.role === "assistant";
      const timestamp = new Date();
      const sequence = sequenceCounterRef.current++;
      onTranscriptComplete?.(msg.text, isLeia, timestamp, sequence);
    },
    [onTranscriptComplete],
  );

  return (
    <VoiceClientUI
      mode={mode}
      showTranscription={true}
      showProviderSelector={false}
      showExpandButton={false}
      onTranscription={handleTranscription}
    />
  );
};

// Outer component that provides the LukeProvider with autoConnect
export const LukeAudioWidget: React.FC<LukeAudioWidgetProps> = ({
  wsUrl,
  token,
  lukeConfig,
  forceMute,
  mode = "inline",
  onTranscriptComplete,
}) => {
  return (
    <LukeProvider serverUrl={wsUrl} authToken={token} autoConnect>
      <LukeAudioInner
        lukeConfig={lukeConfig}
        forceMute={forceMute}
        mode={mode}
        onTranscriptComplete={onTranscriptComplete}
      />
    </LukeProvider>
  );
};
