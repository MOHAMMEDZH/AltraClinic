import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { formatEncounterDate } from '../config/emr-config';
import { useEncounterAudit } from '../hooks/useEmr';
import type { EncounterDetail } from '../types/emr.types';
import styles from './EncounterTimelineTab.module.css';

interface EncounterTimelineTabProps {
  encounter: EncounterDetail;
}

interface TimelineEntry {
  id: string;
  labelKey: string;
  at: string;
}

export function EncounterTimelineTab({ encounter }: EncounterTimelineTabProps) {
  const { t, locale } = useI18n();
  const auditQuery = useEncounterAudit(encounter.id);

  const entries = useMemo(() => {
    const items: TimelineEntry[] = [
      { id: 'created', labelKey: 'emr.timeline.created', at: encounter.createdAt },
    ];
    if (encounter.completedAt) {
      items.push({ id: 'completed', labelKey: 'emr.timeline.completed', at: encounter.completedAt });
    }
    if (encounter.signedAt) {
      items.push({ id: 'signed', labelKey: 'emr.timeline.signed', at: encounter.signedAt });
    }
    for (const ev of auditQuery.data ?? []) {
      items.push({
        id: ev.id,
        labelKey: `emr.audit.${ev.action.replace(/_/g, '')}`,
        at: ev.createdAt,
      });
    }
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [encounter, auditQuery.data]);

  return (
    <section className={styles.panel} aria-label={t('emr.detail.timeline')}>
      <ol className={styles.list}>
        {entries.map((entry) => (
          <li key={entry.id} className={styles.item}>
            <div className={styles.dot} aria-hidden />
            <div>
              <p className={styles.label}>
                {t(entry.labelKey as never, { defaultValue: entry.labelKey.split('.').pop() })}
              </p>
              <p className={styles.time}>{formatEncounterDate(entry.at, locale)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
