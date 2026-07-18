import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { formatDentalDate } from '../config/dental-config';
import { timelineEntryHref } from '@/features/patients/lib/timeline-links';
import type { PatientTimelineEntry } from '@/features/patients/types';
import { useDentalTimeline } from '../hooks/useDentalExtended';
import styles from './DentalTimelinePanel.module.css';

interface DentalTimelinePanelProps {
  patientId: string;
}

function toTimelineEntry(entry: {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}): PatientTimelineEntry {
  return {
    id: entry.id,
    type: entry.type as PatientTimelineEntry['type'],
    title: entry.title,
    subtitle: entry.subtitle,
    occurredAt: entry.occurredAt,
    status: entry.subtitle,
    metadata: entry.metadata,
  };
}

export function DentalTimelinePanel({ patientId }: DentalTimelinePanelProps) {
  const { t, locale } = useI18n();
  const timelineQuery = useDentalTimeline(patientId);
  const items = timelineQuery.data ?? [];

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>{t('dental.timeline.title')}</h2>
      {timelineQuery.isLoading ? (
        <div className={styles.skeleton} aria-busy="true" />
      ) : !items.length ? (
        <p className={styles.empty}>{t('dental.timeline.empty')}</p>
      ) : (
        <ol className={styles.list}>
          {items.map((entry) => {
            const href = timelineEntryHref(patientId, toTimelineEntry(entry));
            return (
              <li key={`${entry.type}-${entry.id}`} className={styles.item}>
                <div className={styles.dot} aria-hidden />
                <div className={styles.body}>
                  <time dateTime={entry.occurredAt}>{formatDentalDate(entry.occurredAt, locale)}</time>
                  <strong>{entry.title}</strong>
                  {entry.subtitle && <span className={styles.sub}>{entry.subtitle}</span>}
                  {href && (
                    <Link to={href} className={styles.link}>
                      {t('dental.timeline.open')}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
