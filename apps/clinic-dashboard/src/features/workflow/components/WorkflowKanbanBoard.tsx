import { useCallback, useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import type { WorkflowTaskSummary } from '../api/workflow-api';
import { KANBAN_COLUMNS } from '../config/workflow-config';
import { WorkflowStatusBadge } from './WorkflowStatusBadge';
import e from '../workflow-enterprise.module.css';

interface WorkflowKanbanBoardProps {
  tasks: WorkflowTaskSummary[];
  onSelectTask: (taskId: string) => void;
  onMoveTask?: (taskId: string, status: string) => void;
}

function priorityClass(priority: string) {
  if (priority === 'critical') return e.priorityCritical;
  if (priority === 'high') return e.priorityHigh;
  if (priority === 'low') return e.priorityLow;
  return e.priorityMedium;
}

export function WorkflowKanbanBoard({ tasks, onSelectTask, onMoveTask }: WorkflowKanbanBoardProps) {
  const { t, locale } = useI18n();
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dropColumn, setDropColumn] = useState<string | null>(null);

  const columns = useMemo(() => {
    const map = new Map<string, WorkflowTaskSummary[]>();
    for (const status of KANBAN_COLUMNS) map.set(status, []);
    for (const task of tasks) {
      const key = KANBAN_COLUMNS.includes(task.status as (typeof KANBAN_COLUMNS)[number]) ? task.status : 'pending';
      map.get(key)!.push(task);
    }
    return map;
  }, [tasks]);

  const handleDrop = useCallback(
    (status: string) => {
      if (dragTaskId && onMoveTask) onMoveTask(dragTaskId, status);
      setDragTaskId(null);
      setDropColumn(null);
    },
    [dragTaskId, onMoveTask],
  );

  return (
    <div className={e.kanbanEnterprise} role="region" aria-label={t('workflow.tasks.kanban')}>
      {KANBAN_COLUMNS.map((status) => {
        const items = columns.get(status) ?? [];
        return (
          <section
            key={status}
            className={[e.kanbanCol, dropColumn === status ? e.kanbanColDrop : ''].filter(Boolean).join(' ')}
            aria-label={status}
            onDragOver={(ev) => {
              if (!onMoveTask) return;
              ev.preventDefault();
              setDropColumn(status);
            }}
            onDragLeave={() => setDropColumn((c) => (c === status ? null : c))}
            onDrop={(ev) => {
              ev.preventDefault();
              handleDrop(status);
            }}
          >
            <div className={e.kanbanColHeader}>
              <h3 className={e.kanbanColTitle}>{t(`workflow.taskStatus.${status}`)}</h3>
              <span className={e.kanbanColCount}>{items.length}</span>
            </div>
            <div className={e.kanbanColBody}>
              {items.map((task) => (
                <button
                  key={task.taskId}
                  type="button"
                  draggable={Boolean(onMoveTask)}
                  className={[
                    e.kanbanCardEnterprise,
                    priorityClass(task.priority),
                    dragTaskId === task.taskId ? e.kanbanCardDragging : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onSelectTask(task.taskId)}
                  onDragStart={() => setDragTaskId(task.taskId)}
                  onDragEnd={() => {
                    setDragTaskId(null);
                    setDropColumn(null);
                  }}
                >
                  <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 'var(--text-sm)' }}>{task.title}</p>
                  <WorkflowStatusBadge status={task.priority} />
                  {task.dueAt && (
                    <p style={{ margin: '8px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      {new Date(task.dueAt).toLocaleDateString(locale)}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
