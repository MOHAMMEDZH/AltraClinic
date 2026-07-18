import { useI18n } from '@booking/i18n/react';
import type { SchedulingMetrics } from '../types/scheduling.types';
import styles from './ScheduleMetrics.module.css';

interface ScheduleMetricsProps {
  metrics: SchedulingMetrics | undefined;
  loading?: boolean;
}

const METRIC_KEYS: Array<{ key: keyof SchedulingMetrics; labelKey: string; tone: string }> = [
  { key: 'total', labelKey: 'scheduling.metrics.total', tone: 'neutral' },
  { key: 'pending', labelKey: 'scheduling.metrics.pending', tone: 'warning' },
  { key: 'confirmed', labelKey: 'scheduling.metrics.confirmed', tone: 'info' },
  { key: 'checkedIn', labelKey: 'scheduling.metrics.checkedIn', tone: 'success' },
  { key: 'inProgress', labelKey: 'scheduling.metrics.inProgress', tone: 'info' },
  { key: 'completed', labelKey: 'scheduling.metrics.completed', tone: 'success' },
  { key: 'cancelled', labelKey: 'scheduling.metrics.cancelled', tone: 'muted' },
  { key: 'noShow', labelKey: 'scheduling.metrics.noShow', tone: 'danger' },
  { key: 'utilizationPercent', labelKey: 'scheduling.metrics.utilization', tone: 'info' },
];

export function ScheduleMetrics({ metrics, loading }: ScheduleMetricsProps) {
  const { t } = useI18n();

  return (
    <section className={styles.grid} aria-label={t('scheduling.metrics.total')}>
      {METRIC_KEYS.map(({ key, labelKey, tone }) => (
        <article key={key} className={[styles.card, styles[tone]].join(' ')}>
          <p className={styles.label}>{t(labelKey)}</p>
          <p className={styles.value} aria-busy={loading}>
            {loading
              ? '—'
              : key === 'utilizationPercent'
                ? `${metrics?.utilizationPercent ?? 0}%`
                : (metrics?.[key] ?? 0)}
          </p>
        </article>
      ))}
    </section>
  );
}
