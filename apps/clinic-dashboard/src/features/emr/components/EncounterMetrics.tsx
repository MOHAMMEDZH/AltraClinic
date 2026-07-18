import { useI18n } from '@booking/i18n/react';
import type { EmrMetricsSummary } from '../types/emr.types';
import styles from './EncounterMetrics.module.css';

interface EncounterMetricsProps {
  metrics: EmrMetricsSummary | undefined;
  loading?: boolean;
}

const METRIC_KEYS: Array<{ key: keyof EmrMetricsSummary; labelKey: string; tone: string }> = [
  { key: 'todayEncounters', labelKey: 'emr.metrics.todayEncounters', tone: 'info' },
  { key: 'patientsWithEncountersToday', labelKey: 'emr.metrics.activePatients', tone: 'neutral' },
  { key: 'openDocumentation', labelKey: 'emr.metrics.openDocumentation', tone: 'warning' },
  { key: 'unsignedToday', labelKey: 'emr.metrics.unsignedToday', tone: 'warning' },
  { key: 'pendingFollowUps', labelKey: 'emr.metrics.pendingFollowUps', tone: 'success' },
  { key: 'weekEncounters', labelKey: 'emr.metrics.weekEncounters', tone: 'muted' },
];

export function EncounterMetrics({ metrics, loading }: EncounterMetricsProps) {
  const { t } = useI18n();

  return (
    <section className={styles.grid} aria-label={t('emr.metrics.title')}>
      {METRIC_KEYS.map(({ key, labelKey, tone }) => (
        <article key={key} className={[styles.card, styles[tone]].join(' ')}>
          <p className={styles.label}>{t(labelKey)}</p>
          <p className={styles.value} aria-busy={loading}>
            {loading ? '—' : (metrics?.[key] ?? 0)}
          </p>
        </article>
      ))}
    </section>
  );
}
