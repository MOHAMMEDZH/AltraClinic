import { useI18n } from '@booking/i18n/react';
import type { ReportAuditEntry } from '../lib/report-audit';
import styles from '../reporting-layout.module.css';

interface ReportAuditPanelProps {
  entries: ReportAuditEntry[];
}

export function ReportAuditPanel({ entries }: ReportAuditPanelProps) {
  const { t } = useI18n();

  if (entries.length === 0) {
    return <p className={styles.empty}>{t('reports.detail.auditEmpty')}</p>;
  }

  return (
    <ul className={styles.list} aria-label={t('reports.detail.auditTitle')}>
      {entries.map((entry) => (
        <li key={entry.id} className={styles.listItem}>
          <span>{t(`reports.audit.actions.${entry.action}` as 'reports.audit.actions.viewed')}</span>
          <span className={styles.hint}>
            {entry.userName ?? entry.userId} · {new Date(entry.createdAt).toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
