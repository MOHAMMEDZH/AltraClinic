import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { WorkflowStatusBadge } from './WorkflowStatusBadge';
import { useUpdateTask, useWorkflowTaskDetail } from '../hooks/useWorkflows';
import e from '../workflow-enterprise.module.css';

interface WorkflowTaskDrawerProps {
  taskId: string | null;
  onClose: () => void;
}

export function WorkflowTaskDrawer({ taskId, onClose }: WorkflowTaskDrawerProps) {
  const { t, locale } = useI18n();
  const detailQuery = useWorkflowTaskDetail(taskId ?? undefined, Boolean(taskId));
  const updateTask = useUpdateTask();
  const [comment, setComment] = useState('');

  if (!taskId) return null;

  const task = detailQuery.data;
  const comments = (task?.comments ?? []) as Array<{ text: string; actorId: string; at: string }>;

  return (
    <div className={e.drawerOverlay} role="presentation" onClick={onClose}>
      <aside
        className={e.drawer}
        role="dialog"
        aria-labelledby="task-drawer-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <header className={e.drawerHeader}>
          <h2 id="task-drawer-title" className={e.drawerTitle}>
            {task?.title ?? t('workflow.tasks.loading')}
          </h2>
          <button type="button" className={e.drawerClose} onClick={onClose} aria-label={t('workflow.close')}>
            ×
          </button>
        </header>

        {detailQuery.isLoading || !task ? (
          <p className={e.emptyHint}>…</p>
        ) : (
          <div className={e.drawerBody}>
            <WorkflowStatusBadge status={task.status} />
            {task.workflowName && <p className={e.pageSubtitle}>{task.workflowName}</p>}
            {task.dueAt && (
              <p className={e.pageSubtitle}>
                {t('workflow.table.due')}: {new Date(task.dueAt).toLocaleString(locale)}
              </p>
            )}
            {task.description && <p>{task.description}</p>}

            <section>
              <h3 className={e.sectionTitle}>{t('workflow.tasks.comments')}</h3>
              {comments.length > 0 ? (
                <div className={e.commentTimeline}>
                  {comments.map((c, i) => (
                    <div key={i} className={e.commentItem}>
                      <p>{c.text}</p>
                      <p className={e.commentMeta}>{new Date(c.at).toLocaleString(locale)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={e.pageSubtitle}>{t('workflow.tasks.empty')}</p>
              )}
              <AuthFormField label={t('workflow.tasks.addComment')} id="task-comment">
                <input
                  id="task-comment"
                  className={e.input}
                  value={comment}
                  onChange={(ev) => setComment(ev.target.value)}
                />
              </AuthFormField>
              <AuthButton
                variant="secondary"
                loading={updateTask.isPending}
                onClick={() => {
                  if (!comment.trim()) return;
                  void updateTask.mutateAsync({ taskId, body: { comment: comment.trim() } });
                  setComment('');
                }}
              >
                {t('workflow.tasks.postComment')}
              </AuthButton>
            </section>

            {task.status !== 'completed' && (
              <AuthButton
                loading={updateTask.isPending}
                onClick={() => void updateTask.mutateAsync({ taskId, body: { status: 'completed' } })}
              >
                {t('workflow.tasks.complete')}
              </AuthButton>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
