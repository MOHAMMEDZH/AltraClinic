import { useI18n } from '@booking/i18n/react';
import { formatEncounterDate } from '../config/emr-config';
import { useEncounterAudit } from '../hooks/useEmr';
import styles from './EncounterAuditPanel.module.css';

interface EncounterAuditPanelProps {
  encounterId: string;
}

const ACTION_KEYS: Record<string, string> = {
  completed: 'emr.audit.completed',
  signed: 'emr.audit.signed',
  vitals_recorded: 'emr.audit.vitalsRecorded',
  soap_updated: 'emr.audit.soapUpdated',
  updated: 'emr.audit.updated',
  created: 'emr.audit.created',
};

export function EncounterAuditPanel({ encounterId }: EncounterAuditPanelProps) {
  const { t, locale } = useI18n();
  const auditQuery = useEncounterAudit(encounterId);

  if (auditQuery.isLoading) {
    return <div className={styles.loading} aria-busy="true">{t('emr.audit.loading')}</div>;
  }

  const events = auditQuery.data ?? [];

  if (!events.length) {
    return <p className={styles.empty}>{t('emr.audit.empty')}</p>;
  }

  return (
    <section className={styles.panel} aria-label={t('emr.audit.title')}>
      <ol className={styles.list}>
        {events.map((ev) => (
          <li key={ev.id} className={styles.item}>
            <div className={styles.dot} aria-hidden />
            <div className={styles.content}>
              <p className={styles.action}>
                {ACTION_KEYS[ev.action] ? t(ACTION_KEYS[ev.action] as never) : ev.action}
              </p>
              <p className={styles.meta}>
                {formatEncounterDate(ev.createdAt, locale)}
                {ev.actorUserId ? ` · ${ev.actorUserId.slice(0, 8)}…` : ''}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
