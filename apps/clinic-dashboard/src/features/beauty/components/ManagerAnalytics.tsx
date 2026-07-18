import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from '@booking/i18n/react';
import { formatCurrency, treatmentLabel } from '../config/beauty-config';
import { useBeautyAnalytics } from '../hooks/useBeauty';
import styles from './ManagerAnalytics.module.css';

export function ManagerAnalytics() {
  const { t, locale } = useI18n();
  const analyticsQuery = useBeautyAnalytics(true);
  const data = analyticsQuery.data;

  const chartData = useMemo(
    () => (data?.topTreatments ?? []).map((x) => ({ name: treatmentLabel(t, x.type), count: x.count })),
    [data, t],
  );

  const chartSummary = useMemo(
    () => chartData.map((row) => `${row.name}: ${row.count}`).join('; '),
    [chartData],
  );

  if (analyticsQuery.isLoading && !data) {
    return <div className={styles.skeleton} aria-busy="true" />;
  }

  if (!data) return null;

  return (
    <section className={styles.panel} aria-label={t('beauty.manager.title')}>
      <h2 className={styles.title}>{t('beauty.manager.title')}</h2>
      <div className={styles.kpis}>
        <article className={styles.kpi}>
          <span>{t('beauty.manager.revenuePipeline')}</span>
          <strong>{formatCurrency(data.revenuePipeline, locale)}</strong>
        </article>
        <article className={styles.kpi}>
          <span>{t('beauty.manager.revenueCollected')}</span>
          <strong>{formatCurrency(data.revenueCollected, locale)}</strong>
        </article>
        <article className={styles.kpi}>
          <span>{t('beauty.manager.conversion')}</span>
          <strong>{data.conversionRate}%</strong>
        </article>
        <article className={styles.kpi}>
          <span>{t('beauty.manager.retention')}</span>
          <strong>{data.retentionRate}%</strong>
        </article>
        <article className={styles.kpi}>
          <span>{t('beauty.manager.avgSessions')}</span>
          <strong>{data.avgSessionsPerPlan.toFixed(1)}</strong>
        </article>
      </div>

      {chartData.length > 0 && (
        <div className={styles.chartWrap}>
          <h3 className={styles.sub}>{t('beauty.manager.topTreatments')}</h3>
          <p className={styles.srOnly}>{chartSummary}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#db2777" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.practitionerLoad.length > 0 && (
        <div className={styles.practitionerBlock}>
          <h3 className={styles.sub}>{t('beauty.manager.practitionerPerformance')}</h3>
          <table className={styles.table}>
            <caption className={styles.srOnly}>{t('beauty.manager.practitionerPerformance')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('beauty.manager.practitioner')}</th>
                <th scope="col">{t('beauty.manager.sessions')}</th>
              </tr>
            </thead>
            <tbody>
              {data.practitionerLoad.slice(0, 8).map((row) => (
                <tr key={row.clinicianId}>
                  <td>{row.practitionerName ?? row.clinicianId.slice(0, 8)}</td>
                  <td>{row.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
