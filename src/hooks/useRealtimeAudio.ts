import { useState, useRef, useCallback, useEffect } from "react";
import axios from "axios";

interface RealtimeEvent {
  type: string;
  [key: string]: any;
}

interface UseRealtimeAudioProps {
  sessionId: string;
  enabled?: boolean;
  onTranscriptDelta?: (delta: string, isLeia: boolean) => void;
  onTranscriptComplete?: (transcript: string, isLeia: boolean, timestamp: Date, sequence: number) => void;
  onError?: (error: Error) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export const useRealtimeAudio = ({
  sessionId,
  enabled = false,
  onTranscriptDelta,
  onTranscriptComplete,
  onError,
  onConnectionChange,
}: UseRealtimeAudioProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLeiaSpeaking, setIsLeiaSpeaking] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const leiaAudioStreamRef = useRef<MediaStream | null>(null);

  const [userTranscriptBuffer, setUserTranscriptBuffer] = useState("");
  const [leiaTranscriptBuffer, setLeiaTranscriptBuffer] = useState("");

  const [conversationHistory, setConversationHistory] = useState<Array<{text: string, isLeia: boolean}>>([]);

  const sequenceCounterRef = useRef(0);
  const userSequenceRef = useRef<number | null>(null);
  const leiaSequenceRef = useRef<number | null>(null);

 
  const saveTranscription = useCallback(
    async (transcript: string, isLeia: boolean) => {
      try {
        await axios.post(
          `${
            import.meta.env.VITE_APP_BACKEND
          }/api/v1/realtime/transcriptions/${sessionId}`,
          {
            transcript,
            isLeia,
          }
        );
      } catch (error) {
        console.error("Failed to save transcription:", error);
        onError?.(
          error instanceof Error ? error : new Error("Failed to save transcription")
        );
      }
    },
    [sessionId, onError]
  );

  const pendingSessionConfigRef = useRef<any>(null);


  const handleDataChannelMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const realtimeEvent: RealtimeEvent = JSON.parse(event.data);
        console.log("Realtime event:", realtimeEvent);

        switch (realtimeEvent.type) {
          // Session created
          case "session.created":
            console.log("Session created, configuring with LEIA instructions...");
            if (dcRef.current && pendingSessionConfigRef.current) {
              // Send full config with LEIA instructions
              const sessionUpdateEvent = {
                type: "session.update",
                session: {
                  type: 'realtime',
                  instructions: pendingSessionConfigRef.current.instructions || 'CRITICAL: You MUST speak ONLY in English at all times. ALL your responses MUST be in English.',
                  audio: {
                    input: {
                      transcription: {
                        model: 'whisper-1',
                        language: 'en',
                      },
                      turn_detection: pendingSessionConfigRef.current.turn_detection || {
                        type: 'server_vad',
                        threshold: 0.5,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 500,
                      },
                    },
                    output: {
                      voice: pendingSessionConfigRef.current.voice || 'marin',
                    },
                  },
                },
              };
              try {
                dcRef.current.send(JSON.stringify(sessionUpdateEvent));
                console.log("Full session config sent with LEIA instructions");
                pendingSessionConfigRef.current = null; // Clear pending config
              } catch (error) {
                console.error("Failed to send session.update:", error);
              }
            }
            break;

          // User's speech transcription (general event) - assign sequence when user starts
          case "conversation.item.input_audio_transcription":
            console.log("User transcription event:", realtimeEvent);
            // This event comes when user starts speaking - assign sequence here
            if (userSequenceRef.current === null) {
              userSequenceRef.current = sequenceCounterRef.current++;
              console.log("User started speaking with sequence:", userSequenceRef.current);
            }
            break;

          // User's speech transcription (incremental)
          case "conversation.item.input_audio_transcription.delta":
            console.log("User transcription delta:", realtimeEvent.delta);
            if (realtimeEvent.delta) {
              // Assign sequence number if not already assigned
              if (userSequenceRef.current === null) {
                userSequenceRef.current = sequenceCounterRef.current++;
                console.log("User transcription started with sequence:", userSequenceRef.current);
              }
              setUserTranscriptBuffer((prev) => prev + realtimeEvent.delta);
              onTranscriptDelta?.(realtimeEvent.delta, false);
            }
            break;

          // User's speech transcription (complete)
          case "conversation.item.input_audio_transcription.completed":
            console.log("User transcription completed:", realtimeEvent.transcript);
            if (realtimeEvent.transcript) {
              const fullTranscript = realtimeEvent.transcript;
              const timestamp = new Date();
              const sequence = userSequenceRef.current ?? sequenceCounterRef.current++;
              console.log("User transcription completed with sequence:", sequence);
              // Add to conversation history
              setConversationHistory(prev => [...prev, { text: fullTranscript, isLeia: false }]);
              onTranscriptComplete?.(fullTranscript, false, timestamp, sequence);
              // Save to database
              saveTranscription(fullTranscript, false);
              // Clear buffer and sequence
              setUserTranscriptBuffer("");
              userSequenceRef.current = null;
            }
            break;

          // Response started - LEIA is starting to respond
          case "response.created":
            console.log("LEIA response created");
            // Assign sequence to LEIA when response is created
            if (leiaSequenceRef.current === null) {
              if (userSequenceRef.current === null) {
                console.warn("User sequence not assigned yet, assigning now");
                userSequenceRef.current = sequenceCounterRef.current++;
              }
              leiaSequenceRef.current = sequenceCounterRef.current++;
              console.log("LEIA response started with sequence:", leiaSequenceRef.current);
            }
            break;

          // LEIA's response transcription (incremental)
          case "response.output_audio_transcript.delta":
            console.log("LEIA transcription delta:", realtimeEvent.delta);
            if (realtimeEvent.delta) {
              // Assign sequence number if not already assigned
              if (leiaSequenceRef.current === null) {
                leiaSequenceRef.current = sequenceCounterRef.current++;
                console.log("LEIA transcription started with sequence:", leiaSequenceRef.current);
              }
              setLeiaTranscriptBuffer((prev) => prev + realtimeEvent.delta);
              onTranscriptDelta?.(realtimeEvent.delta, true);
            }
            break;

          // LEIA's response transcription (complete)
          case "response.output_audio_transcript.done":
            console.log("LEIA transcription done:", realtimeEvent.transcript);
            if (realtimeEvent.transcript) {
              const fullTranscript = realtimeEvent.transcript;
              const timestamp = new Date();
              const sequence = leiaSequenceRef.current ?? sequenceCounterRef.current++;
              console.log("LEIA transcription completed with sequence:", sequence);
              // Add to conversation history
              setConversationHistory(prev => [...prev, { text: fullTranscript, isLeia: true }]);
              onTranscriptComplete?.(fullTranscript, true, timestamp, sequence);
              // Save to database
              saveTranscription(fullTranscript, true);
              // Clear buffer and sequence
              setLeiaTranscriptBuffer("");
              leiaSequenceRef.current = null;
            }
            break;

          // Response started - LEIA is speaking
          case "response.audio.delta":
            setIsLeiaSpeaking(true);
            break;

          // Response completed - LEIA finished speaking
          case "response.audio.done":
          case "response.done":
            setIsLeiaSpeaking(false);
            break;

          // Error handling
          case "error":
            console.error("OpenAI Realtime error:", realtimeEvent.error);
            onError?.(
              new Error(
                realtimeEvent.error?.message || "Unknown Realtime API error"
              )
            );
            break;

          default:
            if (realtimeEvent.type.startsWith("conversation") || realtimeEvent.type.startsWith("response")) {
              console.log("Event:", realtimeEvent.type, "| User seq:", userSequenceRef.current, "| LEIA seq:", leiaSequenceRef.current, "| Counter:", sequenceCounterRef.current);
            }
        }
      } catch (error) {
        console.error("Error parsing data channel message:", error);
        onError?.(
          error instanceof Error
            ? error
            : new Error("Failed to parse data channel message")
        );
      }
    },
    [onTranscriptDelta, onTranscriptComplete, onError, saveTranscription]
  );

  const connect = useCallback(async () => {
    if (!enabled || isConnected) return;

    try {
      console.log("Connecting to Realtime API...");

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      if (!audioElementRef.current) {
        audioElementRef.current = document.createElement("audio");
        audioElementRef.current.autoplay = true;
      }

      pc.ontrack = (e) => {
        console.log("Received remote track");
        leiaAudioStreamRef.current = e.streams[0];
        if (audioElementRef.current) {
          audioElementRef.current.srcObject = e.streams[0];
        }
      };

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = mediaStream;

        const audioTrack = mediaStream.getAudioTracks()[0];
        pc.addTrack(audioTrack, mediaStream);
        console.log("Added microphone track");
      } catch (error) {
        console.error("Failed to get microphone access:", error);
        throw new Error(
          "Microphone access denied. Please grant microphone permissions."
        );
      }

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        console.log("Data channel opened");
      };

      dc.onmessage = handleDataChannelMessage;

      dc.onerror = (error) => {
        console.error("Data channel error:", error);
        onError?.(new Error("Data channel error"));
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log("Created SDP offer, sending to backend...");

      const response = await axios.post(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/realtime/session`,
        offer.sdp,
        {
          headers: {
            "Content-Type": "application/sdp",
            "X-Session-Id": sessionId,
          },
        }
      );

      const { sdpAnswer, sessionConfig } = response.data;

      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: sdpAnswer,
      };
      await pc.setRemoteDescription(answer);

      // Store session config to apply after session.created event
      pendingSessionConfigRef.current = sessionConfig;
      console.log("Session config stored, waiting for session.created event...");

      console.log("WebRTC connection established");
      setIsConnected(true);
      onConnectionChange?.(true);
    } catch (error) {
      console.error("Failed to connect to Realtime API:", error);
      disconnect();
      onError?.(
        error instanceof Error ? error : new Error("Failed to connect")
      );
    }
  }, [
    enabled,
    sessionId,
    isConnected,
    handleDataChannelMessage,
    onError,
    onConnectionChange,
  ]);

  const disconnect = useCallback(() => {
    console.log("Disconnecting from Realtime API...");

    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (leiaAudioStreamRef.current) {
      leiaAudioStreamRef.current = null;
    }

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.srcObject = null;
    }

    setIsConnected(false);
    setIsLeiaSpeaking(false);
    onConnectionChange?.(false);
  }, [onConnectionChange]);

  /**
   * Toggle microphone mute
   */
  const toggleMute = useCallback(() => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  /**
   * Send text message via data channel
   */
  const sendTextMessage = useCallback(
    (text: string) => {
      if (!isConnected || !dcRef.current) {
        console.warn("Cannot send message: not connected");
        return;
      }

      const event = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text,
            },
          ],
        },
      };

      try {
        dcRef.current.send(JSON.stringify(event));
        console.log("Sent text message:", text);
      } catch (error) {
        console.error("Failed to send text message:", error);
        onError?.(
          error instanceof Error
            ? error
            : new Error("Failed to send text message")
        );
      }
    },
    [isConnected, onError]
  );

  /**
   * Auto-connect when enabled
   */
  useEffect(() => {
    if (enabled && !isConnected) {
      connect();
    }

    return () => {
      if (isConnected) {
        disconnect();
      }
    };
  }, [enabled]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isMuted,
    isLeiaSpeaking,
    userTranscriptBuffer,
    leiaTranscriptBuffer,
    conversationHistory,
    connect,
    disconnect,
    toggleMute,
    sendTextMessage,
    audioElement: audioElementRef.current,
    mediaStream: mediaStreamRef.current,
    leiaAudioStream: leiaAudioStreamRef.current,
  };
};
