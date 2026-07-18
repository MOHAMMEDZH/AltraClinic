import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { Shield, Wallet } from 'lucide-react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { useCreateTreatmentPlanInvoice } from '@/features/dental/hooks/useDentalExtended';
import type { InsuranceSnapshot, TreatmentPhase } from './treatment-plan.types';
import { formatCurrency, formatDuration } from './treatment-plan-config';
import styles from './TreatmentPlanCostPanel.module.css';

interface TreatmentPlanCostPanelProps {
  planId?: string;
  phases: TreatmentPhase[];
  totalCost: number;
  totalMinutes: number;
  currency?: string;
  insurance?: InsuranceSnapshot;
  readOnly?: boolean;
  onInsuranceChange?: (ins: InsuranceSnapshot) => void;
}

export function TreatmentPlanCostPanel({
  planId,
  phases,
  totalCost,
  totalMinutes,
  currency = 'USD',
  insurance = {},
  readOnly,
  onInsuranceChange,
}: TreatmentPlanCostPanelProps) {
  const { t, locale } = useI18n();
  const invoiceMutation = useCreateTreatmentPlanInvoice();
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  let insuranceTotal = 0;
  let patientTotal = 0;
  for (const phase of phases) {
    for (const item of phase.items) {
      if (item.status === 'cancelled') continue;
      insuranceTotal += item.insuranceEstimate ?? 0;
      patientTotal += item.patientPortion ?? item.estimatedCost;
    }
  }

  return (
    <aside className={styles.panel} aria-label={t('dental.treatmentPlan.cost.title')}>
      <h2 className={styles.title}>{t('dental.treatmentPlan.cost.title')}</h2>

      <dl className={styles.summary}>
        <div>
          <dt>{t('dental.treatmentPlan.cost.total')}</dt>
          <dd>{formatCurrency(totalCost, locale, currency)}</dd>
        </div>
        <div>
          <dt>{t('dental.treatmentPlan.cost.duration')}</dt>
          <dd>{formatDuration(totalMinutes, locale)}</dd>
        </div>
        <div>
          <dt>{t('dental.treatmentPlan.cost.insurance')}</dt>
          <dd className={styles.insurance}>{formatCurrency(insuranceTotal, locale, currency)}</dd>
        </div>
        <div>
          <dt>{t('dental.treatmentPlan.cost.patient')}</dt>
          <dd className={styles.patient}>{formatCurrency(patientTotal, locale, currency)}</dd>
        </div>
      </dl>

      <div className={styles.insuranceBlock}>
        <h3 className={styles.subtitle}>
          <Shield size={14} aria-hidden />
          {t('dental.treatmentPlan.insurance.title')}
        </h3>
        {readOnly || !onInsuranceChange ? (
          <dl className={styles.insGrid}>
            <div><dt>{t('dental.treatmentPlan.insurance.provider')}</dt><dd>{insurance.provider ?? '—'}</dd></div>
            <div><dt>{t('dental.treatmentPlan.insurance.memberId')}</dt><dd>{insurance.memberId ?? '—'}</dd></div>
            <div><dt>{t('dental.treatmentPlan.insurance.coverage')}</dt><dd>{insurance.coveragePercent != null ? `${insurance.coveragePercent}%` : '—'}</dd></div>
            <div><dt>{t('dental.treatmentPlan.insurance.maximum')}</dt><dd>{insurance.annualMaximum != null ? formatCurrency(insurance.annualMaximum, locale, currency) : '—'}</dd></div>
          </dl>
        ) : (
          <div className={styles.insForm}>
            <label>
              {t('dental.treatmentPlan.insurance.provider')}
              <input value={insurance.provider ?? ''} onChange={(e) => onInsuranceChange({ ...insurance, provider: e.target.value })} />
            </label>
            <label>
              {t('dental.treatmentPlan.insurance.memberId')}
              <input value={insurance.memberId ?? ''} onChange={(e) => onInsuranceChange({ ...insurance, memberId: e.target.value })} />
            </label>
            <label>
              {t('dental.treatmentPlan.insurance.coverage')}
              <input
                type="number" min={0} max={100}
                value={insurance.coveragePercent ?? ''}
                onChange={(e) => onInsuranceChange({ ...insurance, coveragePercent: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
        )}
      </div>

      <div className={styles.phaseBreakdown}>
        <h3 className={styles.subtitle}>
          <Wallet size={14} aria-hidden />
          {t('dental.treatmentPlan.cost.byPhase')}
        </h3>
        <ul className={styles.phaseList}>
          {phases.map((phase) => {
            const phaseCost = phase.items.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + i.estimatedCost, 0);
            return (
              <li key={phase.id}>
                <span>{phase.name}</span>
                <span>{formatCurrency(phaseCost, locale, currency)}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {planId && !readOnly && (
        <div className={styles.billingBlock}>
          {invoiceId ? (
            <Link to={`/billing/invoices/${invoiceId}`} className={styles.invoiceLink}>
              {t('dental.treatmentPlan.billing.viewInvoice')}
            </Link>
          ) : (
            <AuthButton
              variant="secondary"
              fullWidth
              loading={invoiceMutation.isPending}
              onClick={async () => {
                const result = await invoiceMutation.mutateAsync(planId);
                setInvoiceId(result.invoiceId);
              }}
            >
              {t('dental.treatmentPlan.billing.createInvoice')}
            </AuthButton>
          )}
        </div>
      )}
    </aside>
  );
}
