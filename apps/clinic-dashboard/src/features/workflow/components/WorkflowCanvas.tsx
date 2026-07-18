import { useCallback, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import type { WorkflowStepDef } from '../config/workflow-config';
import styles from '../../notifications/notifications-layout.module.css';
import wfStyles from '../workflow-layout.module.css';

interface WorkflowCanvasProps {
  steps: WorkflowStepDef[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  readOnly?: boolean;
}

export function WorkflowCanvas({
  steps,
  selectedIndex,
  onSelect,
  onReorder,
  readOnly = false,
}: WorkflowCanvasProps) {
  const { t } = useI18n();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const handleDrop = useCallback(
    (targetIndex: number) => {
      if (dragIndex == null || dragIndex === targetIndex || !onReorder) return;
      onReorder(dragIndex, targetIndex);
      setDragIndex(null);
      setDropIndex(null);
    },
    [dragIndex, onReorder],
  );

  if (steps.length === 0) {
    return (
      <div className={wfStyles.canvas} aria-label={t('workflow.builder.canvas')}>
        <p className={styles.empty}>{t('workflow.builder.emptyCanvas')}</p>
      </div>
    );
  }

  return (
    <ol className={wfStyles.canvasFlow} aria-label={t('workflow.builder.canvas')}>
      {steps.map((step, index) => {
        const hasBranch = Boolean(step.branchCondition?.trim());
        const isFork = hasBranch && index < steps.length - 1;

        return (
          <li key={step.id ?? index} className={wfStyles.canvasStepWrap}>
            {isFork && (
              <div className={wfStyles.canvasFork} aria-hidden>
                <span className={wfStyles.canvasForkLine} />
                <span className={wfStyles.canvasForkBadge}>{t('workflow.builder.branchFork')}</span>
                <span className={wfStyles.canvasForkLine} />
              </div>
            )}
            <button
              type="button"
              draggable={!readOnly && Boolean(onReorder)}
              className={[
                wfStyles.canvasStep,
                selectedIndex === index ? wfStyles.canvasStepSelected : '',
                dragIndex === index ? wfStyles.canvasStepDragging : '',
                dropIndex === index ? wfStyles.canvasStepDropTarget : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelect(index)}
              aria-pressed={selectedIndex === index}
              onDragStart={() => !readOnly && setDragIndex(index)}
              onDragEnd={() => {
                setDragIndex(null);
                setDropIndex(null);
              }}
              onDragOver={(e) => {
                if (readOnly || !onReorder) return;
                e.preventDefault();
                setDropIndex(index);
              }}
              onDragLeave={() => setDropIndex((prev) => (prev === index ? null : prev))}
              onDrop={(e) => {
                if (readOnly || !onReorder) return;
                e.preventDefault();
                handleDrop(index);
              }}
            >
              {!readOnly && onReorder && (
                <span className={wfStyles.canvasDragHandle} aria-hidden>
                  ⋮⋮
                </span>
              )}
              <span className={wfStyles.canvasStepType}>{step.type}</span>
              <span className={wfStyles.canvasStepLabel}>
                {step.labelEn || t('workflow.builder.untitledStep')}
              </span>
              {hasBranch && (
                <span className={wfStyles.canvasBranch}>{step.branchCondition}</span>
              )}
            </button>
            {index < steps.length - 1 && !isFork && (
              <span className={wfStyles.canvasArrow} aria-hidden>
                ↓
              </span>
            )}
            {isFork && (
              <div className={wfStyles.canvasForkPaths} aria-hidden>
                <span className={wfStyles.canvasForkPath}>↳ {t('workflow.builder.branchTrue')}</span>
                <span className={wfStyles.canvasForkPathMuted}>↳ {t('workflow.builder.branchFalse')}</span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
