import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { formatCurrency } from './treatment-plan-config';
import type { PlanAlternative } from './treatment-plan.types';
import styles from './TreatmentPlanAlternatives.module.css';

interface TreatmentPlanAlternativesProps {
  alternatives: PlanAlternative[];
  readOnly?: boolean;
  currency?: string;
  onChange: (alternatives: PlanAlternative[]) => void;
}

function newAlternative(): PlanAlternative {
  return {
    id: `alt-${crypto.randomUUID()}`,
    label: '',
    description: '',
    estimatedCost: 0,
    notes: '',
  };
}

export function TreatmentPlanAlternatives({
  alternatives,
  readOnly,
  currency = 'USD',
  onChange,
}: TreatmentPlanAlternativesProps) {
  const { t, locale } = useI18n();

  function patch(id: string, patch: Partial<PlanAlternative>) {
    onChange(alternatives.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  return (
    <div className={styles.wrap}>
      {alternatives.length === 0 && readOnly ? (
        <p className={styles.muted}>{t('dental.treatmentPlan.alternatives.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {alternatives.map((alt) => (
            <li key={alt.id} className={styles.card}>
              {readOnly ? (
                <>
                  <strong>{alt.label}</strong>
                  {alt.description && <p>{alt.description}</p>}
                  <p className={styles.cost}>{formatCurrency(alt.estimatedCost, locale, currency)}</p>
                  {alt.notes && <p className={styles.notes}>{alt.notes}</p>}
                </>
              ) : (
                <>
                  <label>
                    {t('dental.treatmentPlan.alternatives.label')}
                    <input
                      value={alt.label}
                      onChange={(e) => patch(alt.id, { label: e.target.value })}
                      placeholder={t('dental.treatmentPlan.alternatives.labelPlaceholder')}
                    />
                  </label>
                  <label>
                    {t('dental.treatmentPlan.alternatives.description')}
                    <input
                      value={alt.description}
                      onChange={(e) => patch(alt.id, { description: e.target.value })}
                    />
                  </label>
                  <label>
                    {t('dental.treatmentPlan.alternatives.cost')}
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={alt.estimatedCost}
                      onChange={(e) => patch(alt.id, { estimatedCost: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label>
                    {t('dental.treatmentPlan.alternatives.notes')}
                    <textarea
                      rows={2}
                      value={alt.notes}
                      onChange={(e) => patch(alt.id, { notes: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => onChange(alternatives.filter((a) => a.id !== alt.id))}
                    aria-label={t('dental.treatmentPlan.alternatives.remove')}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <AuthButton variant="secondary" onClick={() => onChange([...alternatives, newAlternative()])}>
          <Plus size={14} aria-hidden />
          {t('dental.treatmentPlan.alternatives.add')}
        </AuthButton>
      )}
    </div>
  );
}
