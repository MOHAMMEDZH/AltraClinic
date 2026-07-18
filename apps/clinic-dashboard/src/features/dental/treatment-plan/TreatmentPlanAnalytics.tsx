import { useI18n } from '@booking/i18n/react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { formatCurrency } from './treatment-plan-config';
import { useTreatmentPlanAnalytics } from './useTreatmentPlan';
import styles from './TreatmentPlanAnalytics.module.css';

export function TreatmentPlanAnalytics() {
  const { t, locale } = useI18n();
  const analyticsQuery = useTreatmentPlanAnalytics();
  const data = analyticsQuery.data;

  if (analyticsQuery.isLoading) {
    return <div className={styles.skeleton} aria-busy="true" />;
  }
  if (!data) return null;

  return (
    <section className={styles.section} aria-label={t('dental.treatmentPlan.analytics.title')}>
      <header className={styles.header}>
        <h2 className={styles.title}>
          <BarChart3 size={18} aria-hidden />
          {t('dental.treatmentPlan.analytics.title')}
        </h2>
        <p className={styles.subtitle}>{t('dental.treatmentPlan.analytics.subtitle')}</p>
      </header>

      <div className={styles.cards}>
        <article className={styles.card}>
          <span>{t('dental.treatmentPlan.analytics.forecast')}</span>
          <strong>{formatCurrency(data.pendingRevenue, locale)}</strong>
        </article>
        <article className={styles.card}>
          <span>{t('dental.treatmentPlan.analytics.completed')}</span>
          <strong>{formatCurrency(data.completedRevenue, locale)}</strong>
        </article>
        <article className={styles.card}>
          <span>{t('dental.treatmentPlan.analytics.completionRate')}</span>
          <strong>{data.completionRate}%</strong>
        </article>
        <article className={styles.card}>
          <span>{t('dental.treatmentPlan.analytics.activePlans')}</span>
          <strong>{data.planCount}</strong>
        </article>
      </div>

      {data.topPlans.length > 0 && (
        <div className={styles.tableWrap}>
          <h3 className={styles.tableTitle}>
            <TrendingUp size={14} aria-hidden />
            {t('dental.treatmentPlan.analytics.topPlans')}
          </h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('dental.treatmentPlan.analytics.plan')}</th>
                <th>{t('dental.list.patient')}</th>
                <th>{t('dental.treatmentPlan.analytics.value')}</th>
                <th>{t('dental.treatmentPlan.progress')}</th>
              </tr>
            </thead>
            <tbody>
              {data.topPlans.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td>{p.patientName}</td>
                  <td>{formatCurrency(p.totalEstimatedCost, locale)}</td>
                  <td>
                    <div className={styles.miniBar} role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100}>
                      <div style={{ width: `${p.progress}%` }} />
                    </div>
                    <span className={styles.pct}>{p.progress}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
