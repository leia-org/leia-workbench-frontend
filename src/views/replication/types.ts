// Shared types between Replication.tsx and its sections.

export interface ReplicationLeia {
  configuration: {
    mode: string;
    data?: unknown;
    askSolution: boolean;
    evaluateSolution: boolean;
  };
  leia: {
    id: unknown;
    metadata: { name: string };
    spec: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  runnerConfiguration: {
    provider: string;
    audioMode?: "realtime" | "luke" | null;
    hideAudioTranscription?: boolean | null;
    realtimeConfig?: {
      model?: string;
      voice?: string;
      instructions?: string;
      turnDetection?: {
        type?: "server_vad" | "none";
        threshold?: number;
        prefix_padding_ms?: number;
        silence_duration_ms?: number;
      };
    };
    lukeConfig?: {
      provider: string;
      voice: string;
      // Legacy: widgets are now authored per activity in the problem
      // definition (Designer). Kept only so pre-migration replications still
      // type-check on load; the workbench no longer edits this here.
      widgets?: Array<{
        widgetType: string;
        slot: "left" | "right" | "main";
      }>;
    };
  };
  sessionCount: number;
  id: string;
}

export interface ReplicationData {
  id: string;
  name: string;
  isActive: boolean;
  duration: number | null;
  isRepeatable: boolean;
  isShared: boolean;
  shareToken?: string | null;
  code: string;
  createdAt: string;
  updatedAt: string;
  form: string | undefined | null;
  experiment: {
    name: string;
    leias: ReplicationLeia[];
  };
}
