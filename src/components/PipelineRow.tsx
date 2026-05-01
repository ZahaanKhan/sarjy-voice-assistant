import type { PipelineStep, StepStatus } from '@/lib/types';

interface PipelineRowProps {
  step: PipelineStep;
}

const STEP_ICONS: Record<StepStatus, string> = {
  waiting: '○',
  running: '◐',
  done:    '●',
  skipped: '—',
};

const isFlagged = (step: PipelineStep) =>
  step.status === 'done' && step.detail?.toLowerCase().startsWith('flagged');

const PipelineRow = ({ step }: PipelineRowProps) => {
  const flagged    = isFlagged(step);
  const rowClass   = flagged
    ? 'pipeline-row pipeline-row--flagged'
    : `pipeline-row pipeline-row--${step.status}`;

  return (
    <div className={rowClass}>
      <span className="pipeline-icon">{STEP_ICONS[step.status]}</span>
      <div className="pipeline-content">
        <span className="pipeline-label">{step.label}</span>
        {step.detail && (
          <span className="pipeline-detail">{step.detail}</span>
        )}
      </div>
    </div>
  );
};

export default PipelineRow;
