import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FixedSizeList } from 'react-window';
import { ScrollText } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { buildWorkflowPermCheck, canViewWorkflows } from './config/workflow-config';
import { useExportWorkflowLogs, useWorkflowLogs } from './hooks/useWorkflows';
import { WorkflowPageHeader } from './components/enterprise/WorkflowPageHeader';
import { WorkflowSection } from './components/enterprise/WorkflowSection';
import { WorkflowEmptyState } from './components/enterprise/WorkflowEmptyState';
import e from './workflow-enterprise.module.css';

const LOG_ROW_HEIGHT = 64;

type WorkflowLogRow = {
  logId: string;
  workflowId: string;
  workflowName: string;
  eventType: string;
  stepIndex: number | null;
  createdAt: string;
};

export function WorkflowLogsPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [workflowId, setWorkflowId] = useState('');
  const perm = useMemo(() => buildWorkflowPermCheck(user?.roles ?? []), [user?.roles]);
  const logsQuery = useWorkflowLogs(workflowId.trim() || undefined, canViewWorkflows(perm));
  const exportMutation = useExportWorkflowLogs();

  if (!canViewWorkflows(perm)) {
    return <AuthAlert variant="error">{t('workflow.accessDenied')}</AuthAlert>;
  }

  const logs = (logsQuery.data ?? []) as WorkflowLogRow[];

  return (
    <>
      <WorkflowPageHeader
        title={t('workflow.nav.logs')}
        subtitle={t('workflow.logs.subtitle')}
        actions={
          <AuthButton
            variant="secondary"
            loading={exportMutation.isPending}
            onClick={async () => {
              const res = await exportMutation.mutateAsync(workflowId.trim() || undefined);
              const blob = new Blob([res.csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'workflow-logs.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            {t('workflow.logs.export')}
          </AuthButton>
        }
      />

      <WorkflowSection title={t('workflow.enterprise.executionTimeline')}>
        <div className={e.filterRow}>
          <input
            className={e.input}
            value={workflowId}
            onChange={(ev) => setWorkflowId(ev.target.value)}
            placeholder={t('workflow.logs.filterWorkflowId')}
            aria-label={t('workflow.logs.filterWorkflowId')}
          />
        </div>

        {logsQuery.isLoading ? (
          <p className={e.pageSubtitle}>…</p>
        ) : logs.length === 0 ? (
          <WorkflowEmptyState icon={ScrollText} title={t('workflow.logs.empty')} />
        ) : (
          <div className={e.section} style={{ overflow: 'hidden' }}>
            <FixedSizeList height={Math.min(480, logs.length * LOG_ROW_HEIGHT + 8)} itemCount={logs.length} itemSize={LOG_ROW_HEIGHT} width="100%">
              {({ index, style }) => {
                const log = logs[index];
                if (!log) return null;
                return (
                  <div style={style} className={e.activityRow}>
                    <ScrollText size={16} aria-hidden />
                    <div>
                      <Link to={`/workflows/instances/${log.workflowId}`}>{log.workflowName}</Link>
                      <div className={e.pageSubtitle}>{log.eventType}{log.stepIndex != null ? ` · Step ${log.stepIndex + 1}` : ''}</div>
                    </div>
                    <time>{new Date(log.createdAt).toLocaleString(locale)}</time>
                  </div>
                );
              }}
            </FixedSizeList>
          </div>
        )}
      </WorkflowSection>
    </>
  );
}
