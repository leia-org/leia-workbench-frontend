// Shared types between Replication.tsx and its sections.

export type EvaluationMode = "none" | "classic" | "rubric";

export interface ReplicationLeia {
  stageId?: string;
  configuration: {
    mode: string;
    data?: unknown;
    askSolution: boolean;
    evaluateSolution: boolean;
    evaluationMode?: EvaluationMode;
    showSolution?: boolean;
  };
  leia: {
    id: unknown;
    metadata: { name: string };
    spec: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  runnerConfiguration: {
    // Legacy provider field — superseded by `modelName` (BYOK) but kept so
    // pre-migration replications still type-check on load.
    provider?: string;
    modelName?: string;
    apiKeyId?: string | null;
    audioMode?: "realtime" | "luke" | null;
    hideAudioTranscription?: boolean | null;
    infographic?: {
      showToStudent?: boolean;
    };
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

interface ActivityOrchestration {
  mode: "single" | "multi";
  maxInternalTurns: number;
  openingLeiaId: string | null;
  problemLeiaId: string | null;
  sharedTask: string;
}

export type StageOutput = "conversation" | "submitedSolution" | "problem";

export interface StageOutputSources {
  conversation?: string | null;
  submitedSolution?: string | null;
  problem?: string | null;
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
  language: string;
  dataUsageConfig?: {
    dataUsageConsentRequired: boolean;
    dataUsageConsentMessage: string;
    conversationAutomatedRemoval: boolean;
  } | null;
  experiment: {
    name: string;
    leias: ReplicationLeia[];
    orchestration?: ActivityOrchestration;
    stages?: {
      id: string;
      outputSources?: StageOutputSources;
      orchestration: ActivityOrchestration;
    }[];
  };
}
