import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, DoorOpen, User } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { formatTimeRange } from '@/features/scheduling/config/scheduling-config';
import type { QueueBoardItem, QueuePriority } from '../types/queue.types';
import { formatWaitMinutes, QUEUE_PRIORITY_OPTIONS } from '../config/queue-config';
import { QueueStatusBadge } from './QueueStatusBadge';
import { QueuePriorityBadge } from './QueuePriorityBadge';
import { QueueRoomBadge } from './QueueRoomBadge';
import { QueueWaitTimer } from './QueueWaitTimer';
import { QueueTicketNotify } from './QueueTicketNotify';
import styles from './QueueTicketCard.module.css';

interface QueueTicketCardProps {
  ticket: QueueBoardItem;
  branchLabel?: string;
  canUpdate: boolean;
  canManage?: boolean;
  busy?: boolean;
  compact?: boolean;
  patientPhone?: string | null;
  onCall?: () => void;
  onStartServing?: () => void;
  onComplete?: () => void;
  onSkip?: () => void;
  onCancel?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onPriorityChange?: (priority: QueuePriority) => void;
  onTransfer?: () => void;
  onAssignRoom?: () => void;
}

export function QueueTicketCard({
  ticket,
  branchLabel,
  canUpdate,
  busy,
  compact,
  patientPhone,
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
}: QueueTicketCardProps) {
  const { t, locale } = useI18n();
  const showActions = canUpdate && !compact;
  const isActive =
    ticket.status === 'waiting' ||
    ticket.status === 'called' ||
    ticket.status === 'serving';

  const checkedInLabel = ticket.checkedInAt
    ? new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(
        new Date(ticket.checkedInAt),
      )
    : null;

  const primaryActions = [
    onCall && { key: 'call', node: <AuthButton disabled={busy} onClick={onCall}>{t('queue.actions.call')}</AuthButton> },
    onStartServing && {
      key: 'start',
      node: <AuthButton disabled={busy} onClick={onStartServing}>{t('queue.actions.startServing')}</AuthButton>,
    },
    onComplete && {
      key: 'complete',
      node: (
        <AuthButton
          variant={ticket.status === 'serving' ? 'primary' : 'secondary'}
          disabled={busy}
          onClick={onComplete}
        >
          {t('queue.actions.complete')}
        </AuthButton>
      ),
    },
  ].filter(Boolean) as Array<{ key: string; node: ReactNode }>;

  const secondaryActions = [
    onSkip && {
      key: 'skip',
      node: <AuthButton variant="ghost" disabled={busy} onClick={onSkip}>{t('queue.actions.noShow')}</AuthButton>,
    },
    onCancel && {
      key: 'cancel',
      node: <AuthButton variant="ghost" disabled={busy} onClick={onCancel}>{t('queue.actions.cancel')}</AuthButton>,
    },
    onTransfer && {
      key: 'transfer',
      node: <AuthButton variant="ghost" disabled={busy} onClick={onTransfer}>{t('queue.actions.transfer')}</AuthButton>,
    },
  ].filter(Boolean) as Array<{ key: string; node: ReactNode }>;

  return (
    <article className={[styles.card, compact ? styles.compact : ''].join(' ')}>
      <div className={styles.top}>
        {ticket.position != null && (
          <div className={styles.position} aria-label={t('queue.position')}>
            {ticket.position}
          </div>
        )}

        <div className={styles.main}>
          <Link to={`/patients/${ticket.patientId}`} className={styles.patientLink}>
            <User size={15} aria-hidden />
            <span className={styles.patientName}>{ticket.patientName}</span>
          </Link>

          <div className={styles.badges}>
            {ticket.priority !== 'normal' && ticket.priority !== 'appointment' && (
              <QueuePriorityBadge priority={ticket.priority} />
            )}
            <QueueStatusBadge status={ticket.status} />
            {ticket.resourceName && <QueueRoomBadge resourceName={ticket.resourceName} />}
          </div>

          {branchLabel && <p className={styles.branch}>{branchLabel}</p>}

          <dl className={styles.details}>
            <div className={styles.detail}>
              <dt className={styles.srOnly}>{t('queue.board.waiting')}</dt>
              <dd className={styles.time}>
                {formatTimeRange(ticket.scheduledStart, ticket.scheduledEnd, locale)}
              </dd>
            </div>
            <div className={styles.detail}>
              <dt className={styles.srOnly}>{t('queue.waitTimer.label')}</dt>
              <dd>
                <QueueWaitTimer ticket={ticket} compact={compact} />
              </dd>
            </div>
            {ticket.estimatedWaitMinutes != null && ticket.status === 'waiting' && (
              <div className={styles.detail}>
                <dt className={styles.srOnly}>{t('queue.metrics.avgWait')}</dt>
                <dd className={styles.estimate}>
                  {formatMessage(t('queue.estimatedWait'), {
                    n: formatWaitMinutes(ticket.estimatedWaitMinutes, locale),
                  })}
                </dd>
              </div>
            )}
            {ticket.etaAt && ticket.status === 'waiting' && (
              <div className={styles.detail}>
                <dt className={styles.srOnly}>{t('queue.eta.label')}</dt>
                <dd className={styles.meta}>
                  {formatMessage(t('queue.eta.at'), {
                    time: new Intl.DateTimeFormat(locale, {
                      hour: 'numeric',
                      minute: '2-digit',
                    }).format(new Date(ticket.etaAt)),
                  })}
                </dd>
              </div>
            )}
            {checkedInLabel && (
              <div className={styles.detail}>
                <dt className={styles.srOnly}>{t('queue.checkedIn')}</dt>
                <dd className={styles.meta}>
                  {t('queue.checkedIn')}: {checkedInLabel}
                </dd>
              </div>
            )}
          </dl>

          {onPriorityChange && (
            <label className={styles.prioritySelect}>
              <span className={styles.priorityLabel}>{t('queue.priority.label')}</span>
              <select
                value={ticket.priority}
                disabled={busy}
                onChange={(e) => onPriorityChange(e.target.value as QueuePriority)}
                aria-label={t('queue.priority.label')}
              >
                {QUEUE_PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {ticket.status === 'called' && (
            <QueueTicketNotify ticket={ticket} patientPhone={patientPhone} compact={compact} />
          )}
        </div>
      </div>

      {showActions && isActive && (primaryActions.length > 0 || secondaryActions.length > 0 || onAssignRoom) && (
        <footer className={styles.footer}>
          {primaryActions.length > 0 && (
            <div className={styles.primaryActions}>
              {primaryActions.map(({ key, node }) => (
                <span key={key} className={styles.actionItem}>{node}</span>
              ))}
            </div>
          )}
          {(secondaryActions.length > 0 || onMoveUp || onMoveDown || onAssignRoom) && (
            <div className={styles.secondaryRow}>
              <div className={styles.secondaryActions}>
                {onAssignRoom && (
                  <AuthButton variant="ghost" disabled={busy} onClick={onAssignRoom}>
                    <DoorOpen size={14} aria-hidden />
                    {ticket.resourceName ? t('queue.room.change') : t('queue.room.assign')}
                  </AuthButton>
                )}
                {secondaryActions.map(({ key, node }) => (
                  <span key={key} className={styles.actionItem}>{node}</span>
                ))}
              </div>
              {(onMoveUp || onMoveDown) && (
                <div className={styles.reorder}>
                  {onMoveUp && (
                    <AuthButton
                      variant="ghost"
                      disabled={busy}
                      onClick={onMoveUp}
                      aria-label={t('queue.actions.moveUp')}
                    >
                      <ArrowUp size={14} aria-hidden />
                    </AuthButton>
                  )}
                  {onMoveDown && (
                    <AuthButton
                      variant="ghost"
                      disabled={busy}
                      onClick={onMoveDown}
                      aria-label={t('queue.actions.moveDown')}
                    >
                      <ArrowDown size={14} aria-hidden />
                    </AuthButton>
                  )}
                </div>
              )}
            </div>
          )}
        </footer>
      )}
    </article>
  );
}
