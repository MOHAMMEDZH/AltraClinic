import { useMemo } from 'react';

import { useI18n } from '@booking/i18n/react';

import { EmptyState } from '@/features/patients/components/EmptyState';

import type { QueueBoardItem, QueueBoardResponse } from '../types/queue.types';

import { QueueTicketCard } from './QueueTicketCard';

import styles from './QueueBoard.module.css';



interface QueueBoardProps {

  board: QueueBoardResponse | undefined;

  loading?: boolean;

  canUpdate: boolean;

  canManage?: boolean;

  busy?: boolean;

  search?: string;

  statusFilter?: string;

  priorityFilter?: string;

  branchLabels?: Record<string, string>;

  showBranchLabels?: boolean;

  onCall: (ticket: QueueBoardItem) => void;

  onStartServing: (ticket: QueueBoardItem) => void;

  onComplete: (ticket: QueueBoardItem) => void;

  onSkip: (ticket: QueueBoardItem) => void;

  onCancel?: (ticket: QueueBoardItem) => void;

  onMoveUp?: (ticket: QueueBoardItem) => void;

  onMoveDown?: (ticket: QueueBoardItem) => void;

  onPriorityChange?: (ticket: QueueBoardItem, priority: QueueBoardItem['priority']) => void;

  onTransfer?: (ticket: QueueBoardItem) => void;

  onAssignRoom?: (ticket: QueueBoardItem) => void;

}



function filterTickets(
  items: QueueBoardItem[],
  search: string,
  statusFilter: string,
  priorityFilter: string,
) {
  let list = items;
  if (statusFilter) list = list.filter((t) => t.status === statusFilter);
  if (priorityFilter) list = list.filter((t) => t.priority === priorityFilter);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (t) =>
        t.patientName.toLowerCase().includes(q) ||
        t.appointmentId.toLowerCase().includes(q),
    );
  }
  return list;
}



export function QueueBoard({

  board,

  loading,

  canUpdate,

  canManage,

  busy,

  search = '',

  statusFilter = '',

  priorityFilter = '',

  branchLabels,

  showBranchLabels,

  onCall,

  onStartServing,

  onComplete,

  onSkip,

  onCancel,

  onMoveUp,

  onMoveDown,

  onPriorityChange,

  onTransfer,

  onAssignRoom,

}: QueueBoardProps) {

  const { t } = useI18n();



  const waiting = useMemo(
    () => filterTickets(board?.waiting ?? [], search, statusFilter, priorityFilter),
    [board?.waiting, search, statusFilter, priorityFilter],
  );
  const called = useMemo(
    () => filterTickets(board?.called ?? [], search, statusFilter, priorityFilter),
    [board?.called, search, statusFilter, priorityFilter],
  );
  const serving = useMemo(
    () => filterTickets(board?.serving ?? [], search, statusFilter, priorityFilter),
    [board?.serving, search, statusFilter, priorityFilter],
  );
  const completed = useMemo(
    () => filterTickets(board?.recentlyCompleted ?? [], search, statusFilter, priorityFilter),
    [board?.recentlyCompleted, search, statusFilter, priorityFilter],
  );



  const columns = [

    { id: 'waiting', title: t('queue.board.waiting'), items: waiting, tone: 'waiting' },

    { id: 'called', title: t('queue.board.called'), items: called, tone: 'called' },

    { id: 'serving', title: t('queue.board.serving'), items: serving, tone: 'serving' },

    {

      id: 'completed',

      title: t('queue.board.completed'),

      items: completed,

      tone: 'completed',

    },

  ] as const;



  if (loading && !board) {

    return <div className={styles.loading} aria-busy="true">{t('auth.loading')}</div>;

  }



  const isEmpty = columns.every((c) => c.items.length === 0);



  if (isEmpty) {

    return (

      <EmptyState

        title={t('queue.empty.title')}

        description={t('queue.empty.description')}

      />

    );

  }



  return (

    <div className={styles.board} role="region" aria-label={t('queue.board.title')}>

      {columns.map((col) => (

        <section

          key={col.id}

          className={[styles.column, styles[col.tone]].join(' ')}

          aria-labelledby={`queue-col-${col.id}`}

        >

          <header className={styles.colHeader}>

            <h2 id={`queue-col-${col.id}`} className={styles.colTitle}>

              {col.title}

            </h2>

            <span className={styles.colCount}>{col.items.length}</span>

          </header>

          <ul className={styles.list}>

            {col.items.length === 0 ? (

              <li className={styles.colEmpty}>{t('queue.board.none')}</li>

            ) : (

              col.items.map((ticket, index) => (

                <li key={ticket.queueTicketId}>

                  <QueueTicketCard

                    ticket={ticket}

                    branchLabel={

                      showBranchLabels && ticket.branchId

                        ? branchLabels?.[ticket.branchId]

                        : undefined

                    }

                    canUpdate={canUpdate}

                    canManage={canManage}

                    busy={busy}

                    onCall={

                      ticket.status === 'waiting' ? () => onCall(ticket) : undefined

                    }

                    onStartServing={

                      ticket.status === 'called' ? () => onStartServing(ticket) : undefined

                    }

                    onComplete={

                      ticket.status !== 'completed' &&

                      ticket.status !== 'skipped' &&

                      ticket.status !== 'no_show' &&

                      ticket.status !== 'cancelled' &&

                      ticket.status !== 'transferred'

                        ? () => onComplete(ticket)

                        : undefined

                    }

                    onSkip={

                      ticket.status === 'waiting' || ticket.status === 'called'

                        ? () => onSkip(ticket)

                        : undefined

                    }

                    onCancel={

                      canManage &&

                      (ticket.status === 'waiting' || ticket.status === 'called')

                        ? () => onCancel?.(ticket)

                        : undefined

                    }

                    onMoveUp={

                      canManage && ticket.status === 'waiting' && index > 0

                        ? () => onMoveUp?.(ticket)

                        : undefined

                    }

                    onMoveDown={

                      canManage && ticket.status === 'waiting' && index < col.items.length - 1

                        ? () => onMoveDown?.(ticket)

                        : undefined

                    }

                    onPriorityChange={

                      canUpdate && ticket.status === 'waiting'

                        ? (priority) => onPriorityChange?.(ticket, priority)

                        : undefined

                    }

                    onTransfer={

                      canManage &&

                      (ticket.status === 'waiting' || ticket.status === 'called')

                        ? () => onTransfer?.(ticket)

                        : undefined

                    }

                    onAssignRoom={

                      canUpdate &&

                      (ticket.status === 'called' || ticket.status === 'serving')

                        ? () => onAssignRoom?.(ticket)

                        : undefined

                    }

                  />

                </li>

              ))

            )}

          </ul>

        </section>

      ))}

    </div>

  );

}

