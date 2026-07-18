import { useI18n } from '@booking/i18n/react';
import { formatBeautyDate, formatCurrency } from '../config/beauty-config';
import { migratePlan } from '../config/beauty-form-utils';
import type { BeautyTreatmentPlan } from '../types/beauty.types';
import styles from './TreatmentPlansPanel.module.css';

interface TreatmentPlansPanelProps {
  plans: BeautyTreatmentPlan[];
  onEdit?: (plan: BeautyTreatmentPlan) => void;
}

export function TreatmentPlansPanel({ plans, onEdit }: TreatmentPlansPanelProps) {
  const { t, locale } = useI18n();

  if (!plans.length) {
    return <p className={styles.empty}>{t('beauty.plans.empty')}</p>;
  }

  return (
    <div className={styles.list}>
      {plans.map((raw) => {
        const plan = migratePlan(raw);
        return (
        <article key={plan.id} className={styles.card}>
          <header className={styles.head}>
            <h4 className={styles.title}>{plan.title}</h4>
            <span className={[styles.badge, styles[`status_${plan.status}`]].join(' ')}>
              {t(`beauty.plans.status.${plan.status}`)}
            </span>
          </header>
          <dl className={styles.meta}>
            <div>
              <dt>{t('beauty.plans.sessionsPlanned')}</dt>
              <dd>
                {plan.sessionsCompleted} / {plan.sessionsPlanned}
              </dd>
            </div>
            <div>
              <dt>{t('beauty.plans.estimatedCost')}</dt>
              <dd>{formatCurrency(plan.estimatedCost, locale)}</dd>
            </div>
          </dl>
          <div className={styles.procedures}>
            {plan.procedures.map((p) => (
              <span key={p} className={styles.proc}>
                {t(`beauty.treatments.${p as 'botox'}`) || p}
              </span>
            ))}
          </div>
          {plan.approvedAt && (
            <time className={styles.date} dateTime={plan.approvedAt}>
              {formatBeautyDate(plan.approvedAt, locale)}
            </time>
          )}
          {plan.invoiceNumber && (
            <p className={styles.invoice}>{t('beauty.billing.linkedInvoice')}: {plan.invoiceNumber}</p>
          )}
          {plan.notes && <p className={styles.notes}>{plan.notes}</p>}
          {onEdit && (
            <button type="button" className={styles.editBtn} onClick={() => onEdit(plan)}>
              {t('beauty.forms.edit')}
            </button>
          )}
        </article>
        );
      })}
    </div>
  );
}
