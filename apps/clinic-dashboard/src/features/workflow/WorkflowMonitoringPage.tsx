import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { pickLocalizedName } from '@/features/dashboard/lib/dashboard-format';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { buildWorkflowPermCheck, canViewWorkflows } from './config/workflow-config';
import { useInfiniteWorkflows, useWorkflowLogs, useWorkflowOverview } from './hooks/useWorkflows';
import { WorkflowStatusBadge } from './components/WorkflowStatusBadge';
import { WorkflowPageHeader } from './components/enterprise/WorkflowPageHeader';
import { WorkflowSection } from './components/enterprise/WorkflowSection';
import e from './workflow-enterprise.module.css';

export function WorkflowMonitoringPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildWorkflowPermCheck(user?.roles ?? []), [user?.roles]);
  const activeQuery = useInfiniteWorkflows({ status: 'active' }, canViewWorkflows(perm));
  const failedQuery = useInfiniteWorkflows({ status: 'failed' }, canViewWorkflows(perm));
  const logsQuery = useWorkflowLogs(undefined, canViewWorkflows(perm));
  const overviewQuery = useWorkflowOverview(canViewWorkflows(perm));

  if (!canViewWorkflows(perm)) {
    return <AuthAlert variant="error">{t('workflow.accessDenied')}</AuthAlert>;
  }

  const active = activeQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const failed = failedQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const logs = (logsQuery.data ?? []) as Array<{ logId: string; workflowName: string; eventType: string; createdAt: string }>;
  const overview = overviewQuery.data;
  const queueDepth = overview ? overview.pendingTasks + overview.pendingApprovals : null;
  const slaOk = overview ? overview.overdueTasks === 0 : true;

  return (
    <>
      <WorkflowPageHeader
        title={t('workflow.enterprise.liveMonitor')}
        subtitle={t('workflow.monitoring.subtitle')}
        actions={
          <span className={[e.livePill, e.livePillOn].join(' ')}>
            <span className={e.liveDot} aria-hidden />
            {active.length} {t('workflow.kpi.active').toLowerCase()}
          </span>
        }
      />

      {overview && (
        <WorkflowSection title={t('workflow.enterprise.healthDashboard')} flush>
          <div className={e.monitorStats}>
            <div className={e.monitorStat}>
              <p className={e.monitorStatLabel}>{t('workflow.enterprise.slaDashboard')}</p>
              <p className={e.monitorStatValue}>{slaOk ? '✓' : overview.overdueTasks}</p>
            </div>
            <div className={e.monitorStat}>
              <p className={e.monitorStatLabel}>{t('workflow.enterprise.queueDepth')}</p>
              <p className={e.monitorStatValue}>{queueDepth}</p>
            </div>
            <div className={e.monitorStat}>
              <p className={e.monitorStatLabel}>{t('workflow.enterprise.successRate')}</p>
              <p className={e.monitorStatValue}>{overview.completionRate}%</p>
            </div>
            <div className={e.monitorStat}>
              <p className={e.monitorStatLabel}>{t('workflow.enterprise.automationHealth')}</p>
              <p className={e.monitorStatValue}>{overview.failedAutomations}</p>
            </div>
            <div className={e.monitorStat}>
              <p className={e.monitorStatLabel}>{t('workflow.enterprise.workerStatus')}</p>
              <p className={e.monitorStatValue}>
                {Math.max(1, overview.activeWorkflows)} {t('workflow.enterprise.queueWorkers')}
              </p>
            </div>
          </div>
        </WorkflowSection>
      )}

      <WorkflowSection title={t('workflow.monitoring.active')} hint={t('workflow.enterprise.healthDashboard')}>
        {activeQuery.isLoading ? (
          <p className={e.pageSubtitle}>…</p>
        ) : active.length === 0 ? (
          <p className={e.pageSubtitle}>{t('workflow.monitoring.noActive')}</p>
        ) : (
          <div className={e.executionGrid}>
            {active.map((row) => {
              const pct = row.steps?.length ? Math.round(((row.currentStepIndex + 1) / row.steps.length) * 100) : 0;
              return (
                <div key={row.workflowId} className={e.executionRow}>
                  <div>
                    <Link to={`/workflows/instances/${row.workflowId}`} style={{ fontWeight: 600 }}>
                      {pickLocalizedName(locale, row.nameEn, row.nameAr)}
                    </Link>
                    <div className={e.pageSubtitle}>
                      {t('workflow.detail.currentStep')}: {(row.currentStepIndex ?? 0) + 1}/{row.steps?.length ?? 1}
                    </div>
                    <div className={e.progressTrack} style={{ marginTop: 8 }}>
                      <div className={e.progressFill} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <WorkflowStatusBadge status={row.status} />
                  <time>{new Date(row.updatedAt).toLocaleString(locale)}</time>
                  <Activity size={18} aria-hidden />
                </div>
              );
            })}
          </div>
        )}
      </WorkflowSection>

      <WorkflowSection title={t('workflow.monitoring.failed')} hint={t('workflow.enterprise.failedExecutions')}>
        {failedQuery.isLoading ? (
          <p className={e.pageSubtitle}>…</p>
        ) : failed.length === 0 ? (
          <p className={e.pageSubtitle}>{t('workflow.monitoring.noFailed')}</p>
        ) : (
          <div className={e.executionGrid}>
            {failed.map((row) => (
              <div key={row.workflowId} className={e.executionRow}>
                <Link to={`/workflows/instances/${row.workflowId}`}>{pickLocalizedName(locale, row.nameEn, row.nameAr)}</Link>
                <WorkflowStatusBadge status={row.status} />
                <time>{new Date(row.updatedAt).toLocaleString(locale)}</time>
                <AlertTriangle size={18} aria-hidden color="var(--color-danger, #b42318)" />
              </div>
            ))}
          </div>
        )}
      </WorkflowSection>

      {logs.length > 0 && (
        <WorkflowSection title={t('workflow.enterprise.executionTimeline')} flush>
          <div className={e.activityFeed}>
            {logs.slice(0, 20).map((log) => (
              <div key={log.logId} className={e.activityRow}>
                <Activity size={16} aria-hidden />
                <span>{log.workflowName} · {log.eventType}</span>
                <time>{new Date(log.createdAt).toLocaleString(locale)}</time>
              </div>
            ))}
          </div>
        </WorkflowSection>
      )}
    </>
  );
}
