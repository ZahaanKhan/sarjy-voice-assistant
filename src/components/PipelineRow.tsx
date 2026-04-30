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

const PipelineRow = ({ step }: PipelineRowProps) => (
  <div className={`pipeline-row pipeline-row--${step.status}`}>
    <span className="pipeline-icon">{STEP_ICONS[step.status]}</span>
    <div className="pipeline-content">
      <span className="pipeline-label">{step.label}</span>
      {step.detail && (
        <span className="pipeline-detail">{step.detail}</span>
      )}
    </div>
  </div>
);

export default PipelineRow;
