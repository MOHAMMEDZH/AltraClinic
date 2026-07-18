import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { useQueueBoard } from '@/features/queue/hooks/useQueue';
import { useUpdateQueueTicketStatus } from '@/features/queue/hooks/useQueue';
import { formatTimeRange } from '@/features/scheduling/config/scheduling-config';
import type { QueueBoardItem } from '@/features/queue/types/queue.types';
import styles from './PatientCheckOutDialog.module.css';

interface PatientCheckOutDialogProps {
  patientId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function activeTicketsForPatient(
  board: { waiting: QueueBoardItem[]; serving: QueueBoardItem[] } | undefined,
  patientId: string,
): QueueBoardItem[] {
  if (!board) return [];
  return [...board.waiting, ...board.serving].filter((t) => t.patientId === patientId);
}

export function PatientCheckOutDialog({ patientId, onClose, onSuccess }: PatientCheckOutDialogProps) {
  const { t, locale } = useI18n();
  const boardQuery = useQueueBoard();
  const checkoutMutation = useUpdateQueueTicketStatus();

  const tickets = useMemo(
    () => activeTicketsForPatient(boardQuery.data, patientId),
    [boardQuery.data, patientId],
  );

  async function checkOut(ticket: QueueBoardItem) {
    await checkoutMutation.mutateAsync({ queueTicketId: ticket.queueTicketId, status: 'completed' });
    onSuccess();
    onClose();
  }

  return (
    <div className={styles.wrap}>
      {boardQuery.isLoading && <p>{t('auth.loading')}</p>}
      {!boardQuery.isLoading && tickets.length === 0 && (
        <>
          <AuthAlert variant="warning">{t('patients.checkOut.noTickets')}</AuthAlert>
          <div className={styles.actions}>
            <AuthButton variant="secondary" onClick={onClose}>
              {t('patients.actions.cancel')}
            </AuthButton>
          </div>
        </>
      )}
      {tickets.length > 0 && (
        <>
          <p className={styles.intro}>{t('patients.checkOut.selectTicket')}</p>
          <ul className={styles.list}>
            {tickets.map((ticket) => (
              <li key={ticket.queueTicketId} className={styles.item}>
                <div>
                  <p className={styles.time}>
                    {formatTimeRange(ticket.scheduledStart, ticket.scheduledEnd, locale)}
                  </p>
                  <span>{t(`queue.status.${ticket.status}`)}</span>
                </div>
                <AuthButton
                  loading={checkoutMutation.isPending}
                  onClick={() => void checkOut(ticket)}
                >
                  {t('patients.actions.checkOut')}
                </AuthButton>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <AuthButton variant="secondary" onClick={onClose}>
              {t('patients.actions.cancel')}
            </AuthButton>
          </div>
        </>
      )}
    </div>
  );
}
