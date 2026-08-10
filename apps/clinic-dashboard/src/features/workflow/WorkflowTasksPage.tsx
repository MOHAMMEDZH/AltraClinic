import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid, List } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { buildWorkflowPermCheck, canViewWorkflows } from './config/workflow-config';
import { useUpdateTask, useWorkflowTasks } from './hooks/useWorkflows';
import { WorkflowKanbanBoard } from './components/WorkflowKanbanBoard';
import { WorkflowSavedFilters } from './components/WorkflowSavedFilters';
import { WorkflowTaskDrawer } from './components/WorkflowTaskDrawer';
import { WorkflowStatusBadge } from './components/WorkflowStatusBadge';
import { WorkflowPageHeader } from './components/enterprise/WorkflowPageHeader';
import { WorkflowSection } from './components/enterprise/WorkflowSection';
import { WorkflowEmptyState } from './components/enterprise/WorkflowEmptyState';
import e from './workflow-enterprise.module.css';

export function WorkflowTasksPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<'table' | 'kanban'>('kanban');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const tab = params.get('overdue') === 'true' ? 'overdue' : params.get('tab') === 'team' ? 'team' : 'my';
  const perm = useMemo(() => buildWorkflowPermCheck(user?.roles ?? []), [user?.roles]);
  const listQuery = useWorkflowTasks(
    { assigneeId: tab === 'my' ? user?.userId : undefined, overdueOnly: tab === 'overdue' },
    canViewWorkflows(perm),
  );
  const updateTask = useUpdateTask();

  if (!canViewWorkflows(perm)) {
    return <AuthAlert variant="error">{t('workflow.accessDenied')}</AuthAlert>;
  }

  const items = listQuery.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <WorkflowTaskDrawer taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />

      <WorkflowPageHeader
        title={t('workflow.nav.tasks')}
        subtitle={t('workflow.tasks.subtitle')}
        actions={
          <div className={e.tabBar}>
            <AuthButton variant={view === 'kanban' ? 'primary' : 'secondary'} onClick={() => setView('kanban')}>
              <LayoutGrid size={16} aria-hidden /> {t('workflow.tasks.kanban')}
            </AuthButton>
            <AuthButton variant={view === 'table' ? 'primary' : 'secondary'} onClick={() => setView('table')}>
              <List size={16} aria-hidden /> {t('workflow.tasks.table')}
            </AuthButton>
          </div>
        }
      />

      <WorkflowSection
        title={t(`workflow.tasks.tab.${tab}`)}
        actions={
          <div className={e.tabBar} role="tablist">
            {(['my', 'team', 'overdue'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                className={[e.tabBtn, tab === key ? e.tabBtnActive : ''].filter(Boolean).join(' ')}
                onClick={() => {
                  const next = new URLSearchParams();
                  if (key === 'overdue') next.set('overdue', 'true');
                  else if (key === 'team') next.set('tab', 'team');
                  setParams(next);
                }}
              >
                {t(`workflow.tasks.tab.${key}`)}
              </button>
            ))}
          </div>
        }
      >
        <WorkflowSavedFilters
          scope="tasks"
          currentFilters={{ tab, overdueOnly: tab === 'overdue' }}
          onLoad={(filters) => {
            const next = new URLSearchParams();
            if (filters.overdueOnly) next.set('overdue', 'true');
            if (filters.tab === 'team') next.set('tab', 'team');
            setParams(next);
          }}
        />

        {listQuery.isLoading ? (
          <p className={e.pageSubtitle}>…</p>
        ) : items.length === 0 ? (
          <WorkflowEmptyState icon={LayoutGrid} title={t('workflow.tasks.empty')} />
        ) : view === 'kanban' ? (
          <WorkflowKanbanBoard
            tasks={items}
            onSelectTask={setSelectedTaskId}
            onMoveTask={(taskId, status) => void updateTask.mutateAsync({ taskId, body: { status } })}
          />
        ) : (
          <div className={e.executionGrid}>
            {items.map((task) => (
              <div key={task.taskId} className={e.executionRow}>
                <button type="button" className={e.pageTitle} style={{ fontSize: 'var(--text-sm)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'start' }} onClick={() => setSelectedTaskId(task.taskId)}>
                  {task.title}
                </button>
                <span>{task.priority}</span>
                <WorkflowStatusBadge status={task.status} />
                <AuthButton variant="secondary" loading={updateTask.isPending} onClick={() => void updateTask.mutateAsync({ taskId: task.taskId, body: { status: 'completed' } })}>
                  {t('workflow.tasks.complete')}
                </AuthButton>
              </div>
            ))}
          </div>
        )}
      </WorkflowSection>
    </>
  );
}
