import { useI18n } from '@booking/i18n/react';
import type { QueueTicketStatus } from '../types/queue.types';
import { statusBadgeClass } from '../config/queue-config';
import styles from './QueueStatusBadge.module.css';

interface QueueStatusBadgeProps {
  status: QueueTicketStatus;
}

export function QueueStatusBadge({ status }: QueueStatusBadgeProps) {
  const { t } = useI18n();
  const labelKey = `queue.status.${status}` as const;
  return (
    <span className={[styles.badge, styles[statusBadgeClass(status)]].join(' ')}>
      {t(labelKey)}
    </span>
  );
}
