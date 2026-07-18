import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { EmptyState } from '@/features/patients/components/EmptyState';
import { formatCurrency, statusTone } from './treatment-plan-config';
import { useTreatmentPlans } from './useTreatmentPlan';
import styles from './TreatmentPlanTabPanel.module.css';

interface TreatmentPlanTabPanelProps {
  patientId: string;
  canCreate: boolean;
}

export function TreatmentPlanTabPanel({ patientId, canCreate }: TreatmentPlanTabPanelProps) {
  const { t, locale } = useI18n();
  const plansQuery = useTreatmentPlans(patientId);
  const plans = plansQuery.data?.items ?? [];
  const active = plans[0];

  if (plansQuery.isLoading) {
    return <div className={styles.skeleton} aria-busy="true" />;
  }

  if (!active) {
    return (
      <div className={styles.empty}>
        <EmptyState
          title={t('dental.treatmentPlan.empty.title')}
          description={t('dental.treatmentPlan.empty.description')}
        />
        {canCreate && (
          <Link to={`/dental/chart/${patientId}/plan/new`} className={styles.createBtn}>
            <Plus size={14} aria-hidden />
            {t('dental.treatmentPlan.create')}
          </Link>
        )}
      </div>
    );
  }

  const statusClass = styles[`status_${statusTone(active.status)}`];

  return (
    <div className={styles.panel}>
      <header className={styles.head}>
        <div>
          <h3 className={styles.planTitle}>{active.title}</h3>
          <span className={[styles.badge, statusClass].join(' ')}>
            {t(`dental.treatmentPlan.status.${active.status === 'pending_approval' ? 'pendingApproval' : active.status === 'in_progress' ? 'inProgress' : active.status}` as 'dental.treatmentPlan.status.draft')}
          </span>
        </div>
        <span className={styles.progress}>{active.progress}%</span>
      </header>

      <dl className={styles.stats}>
        <div><dt>{t('dental.treatmentPlan.cost.total')}</dt><dd>{formatCurrency(active.totalEstimatedCost, locale)}</dd></div>
        <div><dt>{t('dental.treatmentPlan.patient.remaining')}</dt><dd>{active.procedureCount - active.completedCount}</dd></div>
      </dl>

      <Link to={`/dental/chart/${patientId}/plan/${active.id}`} className={styles.openLink}>
        {t('dental.treatmentPlan.openBuilder')}
        <ArrowRight size={14} aria-hidden />
      </Link>

      {plans.length > 1 && (
        <p className={styles.more}>{t('dental.treatmentPlan.morePlans').replace('{count}', String(plans.length - 1))}</p>
      )}
    </div>
  );
}
