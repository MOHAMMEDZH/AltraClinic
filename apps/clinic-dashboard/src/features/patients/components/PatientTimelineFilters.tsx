import { useI18n } from '@booking/i18n/react';
import { TIMELINE_FILTER_IDS, type TimelineFilterId } from '../lib/timeline-filters';
import styles from './PatientTimelineFilters.module.css';

interface PatientTimelineFiltersProps {
  value: TimelineFilterId;
  onChange: (filter: TimelineFilterId) => void;
}

export function PatientTimelineFilters({ value, onChange }: PatientTimelineFiltersProps) {
  const { t } = useI18n();

  return (
    <div className={styles.group} role="group" aria-label={t('patients.timeline.filterGroup')}>
      {TIMELINE_FILTER_IDS.map((id) => (
        <button
          key={id}
          type="button"
          className={[styles.btn, value === id ? styles.active : ''].join(' ')}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          {t(`patients.timeline.types.${id}`)}
        </button>
      ))}
    </div>
  );
}
