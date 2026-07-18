import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import type { QueueBoardItem } from '../types/queue.types';
import styles from './QueueWaitTimer.module.css';

interface QueueWaitTimerProps {
  ticket: QueueBoardItem;
  compact?: boolean;
}

function resolveBaseSeconds(ticket: QueueBoardItem): number | null {
  if (ticket.elapsedWaitSeconds != null) return ticket.elapsedWaitSeconds;
  if (!ticket.checkedInAt) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(ticket.checkedInAt).getTime()) / 1000));
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}:${String(remMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function QueueWaitTimer({ ticket, compact }: QueueWaitTimerProps) {
  const { t } = useI18n();
  const [seconds, setSeconds] = useState<number | null>(() => resolveBaseSeconds(ticket));

  useEffect(() => {
    const base = resolveBaseSeconds(ticket);
    setSeconds(base);
    if (base == null || ticket.status === 'completed' || ticket.status === 'cancelled') return;

    const anchor = Date.now();
    const initial = base;
    const id = window.setInterval(() => {
      setSeconds(initial + Math.floor((Date.now() - anchor) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [ticket.queueTicketId, ticket.elapsedWaitSeconds, ticket.checkedInAt, ticket.status]);

  if (seconds == null) return null;
  if (ticket.status !== 'waiting' && ticket.status !== 'called' && ticket.status !== 'serving') {
    return null;
  }

  return (
    <span
      className={[styles.timer, compact ? styles.compact : ''].join(' ')}
      aria-label={formatMessage(t('queue.waitTimer.label'), {
        time: formatElapsed(seconds),
      })}
    >
      <Clock size={compact ? 11 : 12} aria-hidden />
      {formatMessage(t('queue.waitTimer.elapsed'), { time: formatElapsed(seconds) })}
    </span>
  );
}
