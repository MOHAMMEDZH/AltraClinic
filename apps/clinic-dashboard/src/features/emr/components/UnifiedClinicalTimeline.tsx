import { useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { usePatientTimeline } from '@/features/patients/hooks/usePatients';
import { PatientTimeline } from '@/features/patients/components/PatientTimeline';
import styles from './UnifiedClinicalTimeline.module.css';

const FILTERS = ['all', 'encounter', 'appointment', 'invoice', 'document'] as const;
type TimelineFilter = (typeof FILTERS)[number];

interface UnifiedClinicalTimelineProps {
  patientId: string;
  compact?: boolean;
}

export function UnifiedClinicalTimeline({ patientId, compact }: UnifiedClinicalTimelineProps) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const timelineQuery = usePatientTimeline(patientId);

  const items = useMemo(() => {
    const all = timelineQuery.data?.items ?? [];
    if (filter === 'all') return all;
    return all.filter((item) => item.type === filter || item.type?.includes(filter));
  }, [timelineQuery.data?.items, filter]);

  return (
    <section className={[styles.panel, compact ? styles.compact : ''].filter(Boolean).join(' ')} aria-label={t('emr.timeline.unified')}>
      {!compact && <p className={styles.hint}>{t('emr.timeline.unifiedHint')}</p>}
      <div className={styles.filters} role="group" aria-label={t('emr.timeline.filterLabel')}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? styles.filterActive : styles.filterBtn}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {t(`emr.timeline.filters.${f}` as never)}
          </button>
        ))}
      </div>
      <PatientTimeline
        patientId={patientId}
        items={items}
        loading={timelineQuery.isLoading}
        emptyLabel={t('emr.timeline.empty')}
      />
    </section>
  );
}
