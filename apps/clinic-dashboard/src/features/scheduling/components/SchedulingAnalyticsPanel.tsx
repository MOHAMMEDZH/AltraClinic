import { useI18n } from '@booking/i18n/react';
import type { SchedulingAnalytics } from '../types/scheduling.types';
import { formatServiceTypeLabel } from '../config/scheduling-config';
import styles from './SchedulingAnalyticsPanel.module.css';

interface SchedulingAnalyticsPanelProps {
  analytics: SchedulingAnalytics | undefined;
  loading?: boolean;
}

export function SchedulingAnalyticsPanel({ analytics, loading }: SchedulingAnalyticsPanelProps) {
  const { t, locale } = useI18n();
  const maxDaily = Math.max(...(analytics?.dailyBreakdown.map((d) => d.total) ?? [1]), 1);

  return (
    <section className={styles.panel} aria-labelledby="scheduling-analytics-heading">
      <h2 id="scheduling-analytics-heading" className={styles.title}>
        {t('scheduling.analytics.title')}
      </h2>

      <div className={styles.rateGrid}>
        {(
          [
            ['completionRate', 'scheduling.analytics.completionRate'],
            ['cancellationRate', 'scheduling.analytics.cancellationRate'],
            ['noShowRate', 'scheduling.analytics.noShowRate'],
          ] as const
        ).map(([key, labelKey]) => (
          <article key={key} className={styles.rateCard}>
            <p className={styles.rateLabel}>{t(labelKey)}</p>
            <p className={styles.rateValue} aria-busy={loading}>
              {loading ? '—' : `${analytics?.[key] ?? 0}%`}
            </p>
          </article>
        ))}
        <article className={styles.rateCard}>
          <p className={styles.rateLabel}>{t('scheduling.analytics.emergency')}</p>
          <p className={styles.rateValue} aria-busy={loading}>
            {loading ? '—' : (analytics?.emergency ?? 0)}
          </p>
        </article>
      </div>

      {(analytics?.dailyBreakdown.length ?? 0) > 0 && (
        <div className={styles.chartBlock}>
          <h3 className={styles.subtitle}>{t('scheduling.analytics.dailyVolume')}</h3>
          <ul className={styles.barChart} aria-label={t('scheduling.analytics.dailyVolume')}>
            {analytics!.dailyBreakdown.map((day) => (
              <li key={day.date} className={styles.barRow}>
                <span className={styles.barLabel}>
                  {new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(
                    new Date(`${day.date}T12:00:00`),
                  )}
                </span>
                <div className={styles.barTrack} aria-hidden>
                  <span
                    className={styles.barFill}
                    style={{ width: `${Math.round((day.total / maxDaily) * 100)}%` }}
                  />
                </div>
                <span className={styles.barCount}>{day.total}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(analytics?.byServiceType.length ?? 0) > 0 && (
        <div className={styles.chartBlock}>
          <h3 className={styles.subtitle}>{t('scheduling.analytics.byServiceType')}</h3>
          <ul className={styles.serviceList}>
            {analytics!.byServiceType.map((row) => (
              <li key={row.serviceType} className={styles.serviceRow}>
                <span>{formatServiceTypeLabel(row.serviceType, t)}</span>
                <strong>{row.count}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
