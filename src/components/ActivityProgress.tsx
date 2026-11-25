import { useLayoutEffect, useRef } from "react";
import { CheckIcon } from "@heroicons/react/24/solid";
import type { StageProgress } from "./ContinueStage";

export interface ActivityStagePhase {
  askSolution: boolean | null;
  mode: "conversation" | "transcription" | null;
}

export interface ActivityProgressProps {
  stage?: StageProgress;
  stagePlan?: ActivityStagePhase[];
  currentStage: ActivityStagePhase;
  phase: "ready" | "conversation" | "solution" | "completed";
  solutionSubmitted?: boolean;
}

export function ActivityProgress({
  stage,
  stagePlan,
  currentStage,
  phase,
  solutionSubmitted,
}: ActivityProgressProps) {
  const stageNumber = stage?.number ?? 1;
  const total = stage?.total ?? 1;
  const listRef = useRef<HTMLOListElement>(null);
  const currentRef = useRef<HTMLLIElement>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const current = currentRef.current;
    if (list && current && current.offsetLeft + current.offsetWidth > list.clientWidth) {
      list.scrollLeft = current.offsetLeft + current.offsetWidth - list.clientWidth;
    }
  }, [stageNumber]);

  return (
    <section aria-label="Activity progress" className="min-w-0 w-full max-w-2xl">
      <ol ref={listRef} className="relative flex gap-3 overflow-x-auto pb-1">
        {Array.from({ length: total }, (_, index) => {
          const number = index + 1;
          const current = number === stageNumber;
          const complete = number < stageNumber || (current && phase === "completed");
          const config = current ? currentStage : stagePlan?.[index];
          const firstLabel = config?.mode === "transcription" ? "Review transcript"
            : config?.mode === null ? "Conversation or transcript" : "Conversation";
          const status = complete ? "Completed" : current
            ? phase === "ready" ? "Ready to start" : "In progress"
            : "Upcoming";
          const firstState = complete || (current && phase === "solution") ? "done"
            : current && phase === "conversation" ? "active" : "waiting";
          const skipped = current && complete && solutionSubmitted === false;
          const solutionState = complete && !skipped ? "done"
            : current && phase === "solution" ? "active" : "waiting";

          return (
            <li key={number} ref={current ? currentRef : undefined}
              aria-current={current ? "step" : undefined} className="min-w-max flex-1">
              <div className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-slate-700">
                <span aria-hidden="true" className={`grid h-5 w-5 place-items-center rounded-full ${
                  current || complete ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-700"
                }`}>
                  {complete ? <CheckIcon className="h-3.5 w-3.5" /> : number}
                </span>
                <span>{stage ? `Stage ${number}` : "Activity"}</span>
                <span className={current ? "text-blue-700" : "text-slate-500"}>{status}</span>
              </div>
              <div className="mt-1 flex gap-1.5">
                <ProgressSegment label={firstLabel} state={firstState} />
                {config?.askSolution === true && (
                  <ProgressSegment label={skipped ? "Solution not submitted" : "Send solution"} state={solutionState} skipped={skipped} />
                )}
                {config?.askSolution === null && (
                  <ProgressSegment label="Solution if required" state={complete ? "done" : "waiting"} />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ProgressSegment({ label, state, skipped }: {
  label: string;
  state: "waiting" | "active" | "done";
  skipped?: boolean;
}) {
  return (
    <div className={`flex-1 whitespace-nowrap text-xs ${state === "active" ? "font-semibold text-blue-800" : "text-slate-600"}`}
      aria-current={state === "active" ? "step" : undefined}>
      <span aria-hidden="true" className={`mb-1 block h-1.5 rounded-full ${
        state === "active" ? "bg-blue-500" : state === "done" ? "bg-blue-800" : "bg-slate-200"
      }`} />
      {label}
      {!skipped && <span className="sr-only">, {state === "done" ? "complete" : state === "active" ? "in progress" : "pending"}</span>}
    </div>
  );
}
