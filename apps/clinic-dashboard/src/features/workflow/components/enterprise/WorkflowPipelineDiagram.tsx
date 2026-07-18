import { Check, Circle, X } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import e from '../../workflow-enterprise.module.css';

interface WorkflowPipelineDiagramProps {
  steps: string[];
  currentStepIndex: number;
  status: string;
}

export function WorkflowPipelineDiagram({ steps, currentStepIndex, status }: WorkflowPipelineDiagramProps) {
  const { t } = useI18n();

  if (steps.length === 0) return null;

  return (
    <div className={e.pipeline} role="list" aria-label={t('workflow.detail.steps')}>
      {steps.map((step, index) => {
        const done = index < currentStepIndex || status === 'completed';
        const current = index === currentStepIndex && status === 'active';
        const failed = index === currentStepIndex && status === 'failed';
        const waiting = !done && !current && !failed;

        let bubbleClass = e.pipelineBubble;
        if (done) bubbleClass += ` ${e.pipelineBubbleDone}`;
        else if (failed) bubbleClass += ` ${e.pipelineBubbleFailed}`;
        else if (current) bubbleClass += ` ${e.pipelineBubbleCurrent}`;
        else if (waiting) bubbleClass += ` ${e.pipelineBubbleWaiting}`;

        return (
          <div key={`${step}-${index}`} role="listitem" style={{ display: 'contents' }}>
            {index > 0 && (
              <div
                className={[
                  e.pipelineConnector,
                  done ? e.pipelineConnectorDone : '',
                  current ? e.pipelineConnectorActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden
              />
            )}
            <div className={e.pipelineNode}>
              <div className={bubbleClass}>
                {done ? <Check size={18} /> : failed ? <X size={18} /> : <Circle size={14} />}
              </div>
              <p className={e.pipelineLabel}>{step}</p>
              {current && <p className={e.pipelineSublabel}>{t('workflow.detail.currentStep')}</p>}
              {done && <p className={e.pipelineSublabel}>{t('workflow.enterprise.stepDone')}</p>}
              {failed && <p className={e.pipelineSublabel}>{t('workflow.enterprise.stepFailed')}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
