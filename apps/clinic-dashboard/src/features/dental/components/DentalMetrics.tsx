import { useI18n } from '@booking/i18n/react';
import type { DentalMetricsSummary } from '../types/dental.types';
import styles from './DentalMetrics.module.css';

const KEYS: Array<{ key: keyof DentalMetricsSummary; labelKey: string; tone: string }> = [
  { key: 'chartsTotal', labelKey: 'dental.metrics.chartsTotal', tone: 'info' },
  { key: 'proceduresThisWeek', labelKey: 'dental.metrics.proceduresThisWeek', tone: 'success' },
  { key: 'activePatients', labelKey: 'dental.metrics.activePatients', tone: 'neutral' },
  { key: 'pendingPlannedTeeth', labelKey: 'dental.metrics.pendingPlanned', tone: 'warning' },
  { key: 'followUpDue', labelKey: 'dental.metrics.followUpDue', tone: 'muted' },
];

export function DentalMetrics({ metrics, loading }: { metrics?: DentalMetricsSummary; loading?: boolean }) {
  const { t } = useI18n();
  return (
    <section className={styles.grid} aria-label={t('dental.metrics.title')}>
      {KEYS.map(({ key, labelKey, tone }) => (
        <article key={key} className={[styles.card, styles[tone]].join(' ')}>
          <p className={styles.label}>{t(labelKey)}</p>
          <p className={styles.value} aria-busy={loading}>{loading ? '—' : (metrics?.[key] ?? 0)}</p>
        </article>
      ))}
    </section>
  );
}
