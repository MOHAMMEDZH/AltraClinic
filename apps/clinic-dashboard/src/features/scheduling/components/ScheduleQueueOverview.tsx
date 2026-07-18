import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import type { QueueMetricsSummary } from '@/features/queue/types/queue.types';
import styles from './ScheduleQueueOverview.module.css';

interface ScheduleQueueOverviewProps {
  metrics: QueueMetricsSummary | undefined;
  loading?: boolean;
}

export function ScheduleQueueOverview({ metrics, loading }: ScheduleQueueOverviewProps) {
  const { t } = useI18n();

  return (
    <section className={styles.section} aria-labelledby="schedule-queue-overview">
      <div className={styles.header}>
        <h2 id="schedule-queue-overview" className={styles.title}>
          <Users size={18} aria-hidden />
          {t('scheduling.queueOverview.title')}
        </h2>
        <Link to="/queue" className={styles.link}>
          {t('scheduling.queueOverview.openQueue')}
        </Link>
      </div>
      <div className={styles.grid}>
        <article className={styles.card}>
          <p className={styles.label}>{t('scheduling.queueOverview.waiting')}</p>
          <p className={styles.value} aria-busy={loading}>
            {loading ? '—' : (metrics?.waiting ?? 0)}
          </p>
        </article>
        <article className={styles.card}>
          <p className={styles.label}>{t('scheduling.queueOverview.serving')}</p>
          <p className={styles.value} aria-busy={loading}>
            {loading ? '—' : (metrics?.serving ?? 0)}
          </p>
        </article>
        <article className={styles.card}>
          <p className={styles.label}>{t('scheduling.queueOverview.completedToday')}</p>
          <p className={styles.value} aria-busy={loading}>
            {loading ? '—' : (metrics?.completedToday ?? 0)}
          </p>
        </article>
        <article className={styles.card}>
          <p className={styles.label}>{t('scheduling.queueOverview.avgWait')}</p>
          <p className={styles.value} aria-busy={loading}>
            {loading
              ? '—'
              : formatMessage(t('scheduling.queueOverview.minutes'), {
                  n: Math.round(metrics?.avgWaitMinutes ?? 0),
                })}
          </p>
        </article>
      </div>
    </section>
  );
}
