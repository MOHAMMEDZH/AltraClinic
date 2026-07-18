import { useI18n } from '@booking/i18n/react';
import { formatCurrency } from '../config/beauty-config';
import type { BeautyMetricsSummary } from '../types/beauty.types';
import styles from './BeautyMetrics.module.css';

interface BeautyMetricsProps {
  metrics?: BeautyMetricsSummary | null;
  loading?: boolean;
}

const KEYS: (keyof BeautyMetricsSummary)[] = [
  'recordsTotal',
  'activePlans',
  'sessionsThisWeek',
  'followUpDue',
  'beforeAfterPairs',
  'revenueEstimate',
];

export function BeautyMetrics({ metrics, loading }: BeautyMetricsProps) {
  const { t, locale } = useI18n();

  return (
    <section className={styles.section} aria-label={t('beauty.metrics.title')} aria-busy={loading}>
      <h2 className={styles.sectionTitle}>{t('beauty.metrics.title')}</h2>
      <div className={styles.grid}>
      {KEYS.map((key) => (
        <article key={key} className={styles.card}>
          <span className={styles.label}>{t(`beauty.metrics.${key}`)}</span>
          <span className={styles.value}>
            {loading && !metrics
              ? '—'
              : key === 'revenueEstimate'
                ? formatCurrency(metrics?.[key] ?? 0, locale)
                : (metrics?.[key] ?? 0)}
          </span>
        </article>
      ))}
      </div>
    </section>
  );
}
