import { useI18n } from '@booking/i18n/react';

import type { QueueMetricsSummary } from '../types/queue.types';

import styles from './QueueMetrics.module.css';



interface QueueMetricsProps {

  metrics: QueueMetricsSummary | undefined;

  loading?: boolean;

  managerView?: boolean;

}



const BASE_METRICS: Array<{

  key: keyof QueueMetricsSummary;

  labelKey: string;

  tone: string;

}> = [

  { key: 'waiting', labelKey: 'queue.metrics.waiting', tone: 'warning' },

  { key: 'called', labelKey: 'queue.metrics.called', tone: 'primary' },

  { key: 'serving', labelKey: 'queue.metrics.serving', tone: 'info' },

  { key: 'completedToday', labelKey: 'queue.metrics.completedToday', tone: 'success' },

  { key: 'noShowToday', labelKey: 'queue.metrics.noShowToday', tone: 'danger' },

  { key: 'skippedToday', labelKey: 'queue.metrics.skippedToday', tone: 'muted' },

  { key: 'avgWaitMinutes', labelKey: 'queue.metrics.avgWait', tone: 'neutral' },

  { key: 'throughputPerHour', labelKey: 'queue.metrics.throughput', tone: 'primary' },

];



const MANAGER_METRICS: Array<{

  key: keyof QueueMetricsSummary;

  labelKey: string;

  tone: string;

}> = [

  { key: 'cancelledToday', labelKey: 'queue.metrics.cancelledToday', tone: 'danger' },

  { key: 'longestWaitMinutes', labelKey: 'queue.metrics.longestWait', tone: 'warning' },

];



export function QueueMetrics({ metrics, loading, managerView }: QueueMetricsProps) {

  const { t } = useI18n();

  const items = managerView ? [...BASE_METRICS, ...MANAGER_METRICS] : BASE_METRICS;



  return (

    <section className={styles.grid} aria-label={t('queue.metrics.title')}>

      {items.map(({ key, labelKey, tone }) => (

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

