import { useI18n } from '@booking/i18n/react';
import type { WorkflowStepDef, WorkflowStepType } from '../config/workflow-config';
import { STEP_TYPES } from '../config/workflow-config';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import styles from '../../notifications/notifications-layout.module.css';

interface WorkflowStepEditorProps {
  step: WorkflowStepDef;
  index: number;
  onChange: (step: WorkflowStepDef) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function WorkflowStepEditor({ step, index, onChange, onRemove, canRemove }: WorkflowStepEditorProps) {
  const { t } = useI18n();

  return (
    <div className={styles.formStack}>
      <AuthFormField label={t('workflow.builder.stepType')} id={`step-type-${index}`}>
        <select
          id={`step-type-${index}`}
          className={styles.select}
          value={step.type}
          onChange={(e) => onChange({ ...step, type: e.target.value as WorkflowStepType })}
        >
          {STEP_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`workflow.stepTypes.${type}`)}
            </option>
          ))}
        </select>
      </AuthFormField>
      <AuthFormField label={t('workflow.builder.nameEn')} id={`step-en-${index}`}>
        <input
          id={`step-en-${index}`}
          className={styles.input}
          value={step.labelEn}
          onChange={(e) => onChange({ ...step, labelEn: e.target.value })}
        />
      </AuthFormField>
      <AuthFormField label={t('workflow.builder.nameAr')} id={`step-ar-${index}`}>
        <input
          id={`step-ar-${index}`}
          className={styles.input}
          value={step.labelAr ?? ''}
          onChange={(e) => onChange({ ...step, labelAr: e.target.value })}
          dir="rtl"
        />
      </AuthFormField>
      {(step.type === 'approval' || step.type === 'task') && (
        <AuthFormField label={t('workflow.builder.branchCondition')} id={`step-branch-${index}`}>
          <input
            id={`step-branch-${index}`}
            className={styles.input}
            value={step.branchCondition ?? ''}
            onChange={(e) => onChange({ ...step, branchCondition: e.target.value })}
            placeholder={t('workflow.builder.branchPlaceholder')}
          />
        </AuthFormField>
      )}
      {canRemove && (
        <button type="button" className={styles.linkBtn} onClick={onRemove}>
          {t('workflow.builder.remove')}
        </button>
      )}
    </div>
  );
}
