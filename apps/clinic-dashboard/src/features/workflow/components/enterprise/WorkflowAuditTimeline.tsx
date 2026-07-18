import { Shield } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import e from '../../workflow-enterprise.module.css';

export interface WorkflowAuditEntry {
  id: string;
  action: string;
  resourceId: string | null;
  actorId: string | null;
  createdAt: string;
}

interface WorkflowAuditTimelineProps {
  entries: WorkflowAuditEntry[];
  locale: string;
}

export function WorkflowAuditTimeline({ entries, locale }: WorkflowAuditTimelineProps) {
  const { t } = useI18n();

  return (
    <ul className={e.auditTimeline}>
      {entries.map((entry) => (
        <li key={entry.id} className={e.auditEvent}>
          <span className={e.auditDot} aria-hidden>
            <Shield size={14} />
          </span>
          <div className={e.auditCard}>
            <p className={e.auditAction}>
              <code>{entry.action}</code>
            </p>
            <p className={e.auditDetail}>
              {t('workflow.audit.actor')}: {entry.actorId ?? t('workflow.enterprise.system')} ·{' '}
              {t('workflow.audit.resource')}: {entry.resourceId ?? '—'} ·{' '}
              {t('workflow.audit.when')}: {new Date(entry.createdAt).toLocaleString(locale)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
