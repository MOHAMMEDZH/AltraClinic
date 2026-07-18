import { useCallback, useState } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { formatCurrency, TREATMENT_TYPES } from '../config/beauty-config';
import {
  computePlanCost,
  createBeautyId,
  defaultPlanSession,
  defaultTreatmentPlan,
  reorderSteps,
  validatePlan,
} from '../config/beauty-form-utils';
import type { BeautyTreatmentPlan, PlanSessionStep } from '../types/beauty.types';
import styles from './TreatmentPlanBuilder.module.css';

interface TreatmentPlanBuilderProps {
  initial?: BeautyTreatmentPlan;
  locale: string;
  readOnly?: boolean;
  onSave: (plan: BeautyTreatmentPlan) => void;
  onCancel?: () => void;
  onApprove?: (plan: BeautyTreatmentPlan) => void;
  onCreateInvoice?: (plan: BeautyTreatmentPlan) => void;
  invoicePending?: boolean;
  canCreateInvoice?: boolean;
}

export function TreatmentPlanBuilder({
  initial,
  locale,
  readOnly,
  onSave,
  onCancel,
  onApprove,
  onCreateInvoice,
  invoicePending,
  canCreateInvoice = true,
}: TreatmentPlanBuilderProps) {
  const { t } = useI18n();
  const [plan, setPlan] = useState<BeautyTreatmentPlan>(initial ?? defaultTreatmentPlan());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const updateStep = useCallback((id: string, patch: Partial<PlanSessionStep>) => {
    setPlan((p) => {
      const sessionSequence = p.sessionSequence.map((s) => (s.id === id ? { ...s, ...patch } : s));
      return {
        ...p,
        sessionSequence,
        sessionsPlanned: sessionSequence.length,
        estimatedCost: computePlanCost(sessionSequence),
        procedures: [...new Set(sessionSequence.map((s) => s.type))],
      };
    });
  }, []);

  function handleDrop(toIndex: number) {
    if (dragIndex == null || dragIndex === toIndex) return;
    setPlan((p) => {
      const sessionSequence = reorderSteps(p.sessionSequence, dragIndex, toIndex);
      return { ...p, sessionSequence, sessionsPlanned: sessionSequence.length };
    });
    setDragIndex(null);
  }

  function addStep() {
    setPlan((p) => {
      const step = defaultPlanSession('botox');
      const sessionSequence = [...p.sessionSequence, step];
      return {
        ...p,
        sessionSequence,
        sessionsPlanned: sessionSequence.length,
        estimatedCost: computePlanCost(sessionSequence),
      };
    });
  }

  function removeStep(id: string) {
    setPlan((p) => {
      const sessionSequence = p.sessionSequence.filter((s) => s.id !== id);
      return {
        ...p,
        sessionSequence,
        sessionsPlanned: sessionSequence.length,
        estimatedCost: computePlanCost(sessionSequence),
      };
    });
  }

  function submit(approve = false) {
    const err = validatePlan(plan);
    if (err) {
      setErrorKey(err);
      return;
    }
    const next = approve
      ? { ...plan, status: 'approved' as const, approvedAt: new Date().toISOString() }
      : plan;
    onSave(next);
    if (approve && onApprove) onApprove(next);
  }

  return (
    <div className={styles.builder}>
      {errorKey && (
        <p className={styles.error} role="alert">
          {t(`beauty.forms.errors.${errorKey}`)}
        </p>
      )}

      <label className={styles.field}>
        <span>{t('beauty.forms.planTitle')}</span>
        <input
          value={plan.title}
          disabled={readOnly}
          placeholder={t('beauty.forms.planTitlePlaceholder')}
          onChange={(e) => setPlan((p) => ({ ...p, title: e.target.value }))}
        />
      </label>

      <div className={styles.workflow} aria-label={t('beauty.forms.sessionWorkflow')}>
        {plan.sessionSequence.map((step, index) => (
          <div
            key={step.id}
            className={styles.step}
            draggable={!readOnly}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(index)}
          >
            <GripVertical size={16} className={styles.grip} aria-hidden />
            <span className={styles.stepNum}>{index + 1}</span>
            <select
              value={step.type}
              disabled={readOnly}
              onChange={(e) => updateStep(step.id, { type: e.target.value, label: e.target.value })}
            >
              {TREATMENT_TYPES.map((tr) => (
                <option key={tr} value={tr}>
                  {t(`beauty.treatments.${tr}`)}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              className={styles.costInput}
              disabled={readOnly}
              value={step.estimatedCost}
              aria-label={t('beauty.plans.estimatedCost')}
              onChange={(e) => updateStep(step.id, { estimatedCost: Number(e.target.value) || 0 })}
            />
            {!readOnly && (
              <button type="button" className={styles.removeBtn} aria-label={t('beauty.forms.remove')} onClick={() => removeStep(step.id)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <AuthButton type="button" variant="secondary" onClick={addStep}>
          <Plus size={16} aria-hidden />
          {t('beauty.forms.addSessionStep')}
        </AuthButton>
      )}

      <div className={styles.total}>
        <span>{t('beauty.plans.estimatedCost')}</span>
        <strong>{formatCurrency(plan.estimatedCost, locale)}</strong>
      </div>

      <label className={styles.field}>
        <span>{t('beauty.profile.notes')}</span>
        <textarea
          rows={2}
          disabled={readOnly}
          value={plan.notes ?? ''}
          onChange={(e) => setPlan((p) => ({ ...p, notes: e.target.value }))}
        />
      </label>

      {plan.invoiceNumber && (
        <p className={styles.invoiceLink}>
          {t('beauty.billing.linkedInvoice')}: {plan.invoiceNumber}
        </p>
      )}

      {!readOnly && (
        <div className={styles.actions}>
          {onCancel && (
            <AuthButton type="button" variant="ghost" onClick={onCancel}>
              {t('beauty.cancel')}
            </AuthButton>
          )}
          <AuthButton type="button" variant="secondary" onClick={() => submit(false)}>
            {t('beauty.forms.saveDraft')}
          </AuthButton>
          <AuthButton type="button" onClick={() => submit(true)}>
            {t('beauty.plans.approve')}
          </AuthButton>
          {onCreateInvoice && !plan.invoiceId && plan.status === 'approved' && (
            <AuthButton
              type="button"
              variant="secondary"
              loading={invoicePending}
              disabled={!canCreateInvoice || invoicePending}
              onClick={() => onCreateInvoice(plan)}
            >
              {t('beauty.billing.createInvoice')}
            </AuthButton>
          )}
          {!canCreateInvoice && onCreateInvoice && plan.status === 'approved' && !plan.invoiceId && (
            <p className={styles.billingHint}>{t('beauty.billing.noCreateAccess')}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function createSessionsFromPlan(plan: BeautyTreatmentPlan, clinicianId: string) {
  return plan.sessionSequence.map((step) => ({
    id: createBeautyId('session'),
    planId: plan.id,
    planStepId: step.id,
    type: step.type,
    status: 'scheduled' as const,
    scheduledAt: step.scheduledAt ?? new Date(Date.now() + 7 * 86400000).toISOString(),
    clinicianId,
    outcome: null,
    notes: '',
    products: [],
    comparisonGroupId: null,
    beforeMediaId: null,
    afterMediaId: null,
    followUpAt: null,
    measurementIds: [],
  }));
}
