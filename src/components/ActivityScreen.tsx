import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { ArrowRightIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import ReactMarkdown from "react-markdown";
import { adminTheme } from "./admin/theme";
import { SplitLoginLayout } from "./SplitLoginLayout";
import { ActivityProgress, type ActivityProgressProps } from "./ActivityProgress";
import { ContinueStage } from "./ContinueStage";
import RubricEvaluationView, { type RubricEvaluationResult } from "./RubricEvaluationView";

interface ActivityScreenProps {
  title: string;
  subtitle?: string;
  progress: ActivityProgressProps;
  children: ReactNode;
}

export function ActivityScreen({ title, subtitle, progress, children }: ActivityScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [title]);

  return (
    <ThemeProvider theme={adminTheme}>
      <SplitLoginLayout title={title} subtitle={subtitle} titleRef={headingRef} showBrandOnMobile fitViewport>
        <main className="flex w-full min-w-0 max-w-2xl flex-col gap-4 text-slate-900 min-[900px]:max-h-full min-[900px]:min-h-0 lg:gap-6" style={{ fontFamily: adminTheme.typography.fontFamily }}>
          <div className="shrink-0"><ActivityProgress {...progress} /></div>
          {children}
        </main>
      </SplitLoginLayout>
    </ThemeProvider>
  );
}

export function ActivityScrollCard({ title, compact = false, children }: {
  title: string;
  compact?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <section className={`flex min-h-0 min-w-0 flex-col rounded-lg border border-slate-200 ${
      compact ? "min-[900px]:max-h-[min(45dvh,24rem)]" : ""
    }`}>
      {!compact && (
        <h2 id={headingId} className="shrink-0 border-b border-slate-200 px-4 py-3 text-lg font-semibold">{title}</h2>
      )}
      <div role="region" aria-label={compact ? title : undefined} aria-labelledby={compact ? undefined : headingId} tabIndex={0}
        className={`min-h-0 min-w-0 break-words focus-visible:outline-blue-600 min-[900px]:overflow-y-auto ${
          compact ? "p-3" : "p-4"
        }`}>
        {children}
      </div>
    </section>
  );
}

export function ActivityEvaluation({ evaluation, rubricEvaluation }: {
  evaluation?: string | null;
  rubricEvaluation?: RubricEvaluationResult | null;
}) {
  if (!evaluation && !rubricEvaluation) return null;

  return (
    <ActivityScrollCard title="Evaluation" compact>
      {rubricEvaluation ? (
        <RubricEvaluationView rubricEvaluation={rubricEvaluation} compact />
      ) : (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{evaluation}</ReactMarkdown>
        </div>
      )}
    </ActivityScrollCard>
  );
}

interface ActivityCompletionProps {
  progress: ActivityProgressProps;
  sessionId?: string;
  formUrl?: string | null;
  onHome: () => void;
  notice?: string;
  reviewAction?: { label: string; onClick: () => void };
  footerContent?: ReactNode;
  children?: ReactNode;
}

export function ActivityCompletion({ progress, sessionId, formUrl, onHome, notice, reviewAction, footerContent, children }: ActivityCompletionProps) {
  const { stage } = progress;
  const nextStage = stage?.hasNext ? stage.number + 1 : null;
  const feedbackUrl = formUrl && /^https?:\/\//i.test(formUrl) ? formUrl : null;

  return (
    <ActivityScreen
      title={nextStage ? `Stage ${stage?.number} completed` : "Activity complete"}
      subtitle={nextStage ? `Stage ${nextStage} is next.` : undefined}
      progress={progress}
    >
      {!nextStage && (
        <div className="flex shrink-0 items-center gap-3 rounded-lg bg-green-50 p-4 text-green-900">
          <CheckCircleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p>Thank you for completing the activity.</p>
        </div>
      )}
      {notice && <p role="status" className="shrink-0 rounded-lg bg-blue-50 p-4 text-sm text-blue-900">{notice}</p>}
      {children}
      <div className="flex shrink-0 flex-col gap-4">
        {footerContent}
        {nextStage && sessionId ? (
          <footer className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-start sm:justify-end">
            {reviewAction && (
              <button type="button" onClick={reviewAction.onClick}
                className="min-h-10 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50">
                {reviewAction.label}
              </button>
            )}
            <ContinueStage sessionId={sessionId} nextStageNumber={nextStage} />
          </footer>
        ) : (
          <footer className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
            {feedbackUrl && (
              <a href={feedbackUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
                Open feedback form <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
            <button type="button" onClick={onHome}
              className="rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">
              Back to home
            </button>
          </footer>
        )}
      </div>
    </ActivityScreen>
  );
}
