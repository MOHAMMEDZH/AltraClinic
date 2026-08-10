import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  GitBranch,
  RefreshCw,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { WidgetSkeleton } from '@/features/dashboard/components/WidgetShell';
import { FeatureGate } from '@/features/subscription/components/FeatureGate';
import {
  buildWorkflowPermCheck,
  canViewWorkflows,
  resolveDefaultWorkspace,
  type WorkflowWorkspaceId,
} from './config/workflow-config';
import { useWorkflowOverview } from './hooks/useWorkflows';
import { WorkflowRoleWorkspace, WorkflowWorkspaceLinks } from './components/WorkflowRoleWorkspace';
import { WorkflowPageHeader } from './components/enterprise/WorkflowPageHeader';
import { WorkflowMetricGrid } from './components/enterprise/WorkflowMetricGrid';
import { WorkflowDashboardCharts } from './components/enterprise/WorkflowDashboardCharts';
import { WorkflowSection } from './components/enterprise/WorkflowSection';
import e from './workflow-enterprise.module.css';

export function WorkflowsHomePage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildWorkflowPermCheck(user?.roles ?? []), [user?.roles]);
  const overviewQuery = useWorkflowOverview(canViewWorkflows(perm));
  const [workspace, setWorkspace] = useState<WorkflowWorkspaceId>(() =>
    resolveDefaultWorkspace(user?.roles ?? []),
  );

  if (!canViewWorkflows(perm)) {
    return <AuthAlert variant="error">{t('workflow.accessDenied')}</AuthAlert>;
  }

  const data = overviewQuery.data;
  const slaOk = data ? data.overdueTasks === 0 : true;

  const metrics = data
    ? [
        { id: 'active', label: t('workflow.kpi.active'), value: data.activeWorkflows, href: '/workflows/instances?status=active', icon: GitBranch, accent: 'info' as const },
        { id: 'running', label: t('workflow.enterprise.runningExecutions'), value: data.activeWorkflows, meta: t('workflow.enterprise.liveMonitor'), href: '/workflows/monitoring', icon: Activity, accent: 'info' as const },
        { id: 'approvals', label: t('workflow.kpi.pendingApprovals'), value: data.pendingApprovals, href: '/workflows/approvals', icon: Clock, accent: 'warning' as const },
        { id: 'tasks', label: t('workflow.enterprise.assignedTasks'), value: data.myTasks, href: '/workflows/tasks', icon: Users, accent: 'info' as const },
        { id: 'sla', label: t('workflow.enterprise.slaStatus'), value: slaOk ? '✓' : '!', meta: slaOk ? t('workflow.enterprise.slaOk') : `${data.overdueTasks} ${t('workflow.kpi.overdue')}`, href: '/workflows/tasks?overdue=true', icon: Timer, accent: (slaOk ? 'success' as const : 'danger' as const) },
        { id: 'success', label: t('workflow.enterprise.successRate'), value: `${data.completionRate}%`, icon: TrendingUp, accent: 'success' as const },
        { id: 'avg', label: t('workflow.enterprise.avgCompletion'), value: `${data.avgApprovalTimeHours}h`, meta: t('workflow.kpi.avgApprovalTime'), icon: CheckCircle2, accent: 'info' as const },
        { id: 'auto', label: t('workflow.enterprise.automationRate'), value: data.failedAutomations, meta: t('workflow.kpi.failedAutomations'), href: '/workflows/automation', icon: Zap, accent: (data.failedAutomations > 0 ? 'danger' as const : 'success' as const) },
        { id: 'failed', label: t('workflow.enterprise.failedExecutions'), value: data.failedWorkflows, href: '/workflows/monitoring', icon: AlertTriangle, accent: 'danger' as const },
        { id: 'completed', label: t('workflow.kpi.completedToday'), value: data.completedToday, icon: CheckCircle2, accent: 'success' as const },
        { id: 'overdue', label: t('workflow.kpi.overdue'), value: data.overdueTasks, href: '/workflows/tasks?overdue=true', icon: AlertTriangle, accent: 'warning' as const },
        { id: 'pending', label: t('workflow.kpi.pendingApprovals'), value: data.pendingTasks, icon: Clock, accent: 'warning' as const },
      ]
    : [];

  return (
    <FeatureGate
      featureId="workflow"
      featureName={t('subscription.features.workflow')}
      benefits={[t('subscription.locked.benefitAutomation'), t('subscription.locked.benefitApprovals')]}
      preview
    >
    <>
      <WorkflowPageHeader
        title={t('workflow.enterprise.commandCenter')}
        subtitle={t('workflow.enterprise.commandCenterHint')}
        actions={
          <AuthButton variant="secondary" disabled={overviewQuery.isFetching} onClick={() => void overviewQuery.refetch()}>
            <RefreshCw size={16} aria-hidden className={overviewQuery.isFetching ? e.spin : undefined} />
            {t('workflow.enterprise.refresh')}
          </AuthButton>
        }
      />

      {overviewQuery.isError && <AuthAlert variant="error">{t('workflow.loadError')}</AuthAlert>}

      <WorkflowRoleWorkspace activeWorkspace={workspace} onSelect={setWorkspace} />
      <WorkflowWorkspaceLinks workspace={workspace} />

      <WorkflowSection title={t('workflow.nav.overview')} hint={t('workflow.enterprise.commandCenterHint')}>
        {overviewQuery.isLoading || !data ? (
          <div className={e.metricGrid}>
            <WidgetSkeleton span="third" />
            <WidgetSkeleton span="third" />
            <WidgetSkeleton span="third" />
          </div>
        ) : (
          <WorkflowMetricGrid items={metrics} />
        )}
      </WorkflowSection>

      {data && <WorkflowDashboardCharts data={data} />}

      {data?.taskLoadByRole?.length ? (
        <WorkflowSection title={t('workflow.enterprise.bottlenecks')} hint={t('workflow.kpi.taskLoadByRole')}>
          <div className={e.heatGrid}>
            {data.taskLoadByRole.map((row) => (
              <div
                key={row.role}
                className={e.heatCell}
                style={{
                  background: `color-mix(in srgb, var(--color-warning, #b54708) ${Math.min(85, row.count * 12)}%, var(--color-surface))`,
                }}
              >
                <div>{row.role.replace(/_/g, ' ')}</div>
                <div>{row.count}</div>
              </div>
            ))}
          </div>
        </WorkflowSection>
      ) : null}

      {data?.recentActivity?.length ? (
        <WorkflowSection title={t('workflow.recentActivity')} flush>
          <div className={e.activityFeed}>
            {data.recentActivity.map((item) => (
              <div key={item.id} className={e.activityRow}>
                <GitBranch size={16} aria-hidden />
                <div>
                  <Link to={`/workflows/instances/${item.workflowId}`}>{item.workflowName}</Link>
                  <div className={e.pageSubtitle}>{item.eventType}</div>
                </div>
                <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(locale)}</time>
              </div>
            ))}
          </div>
        </WorkflowSection>
      ) : null}
    </>
    </FeatureGate>
  );
}
