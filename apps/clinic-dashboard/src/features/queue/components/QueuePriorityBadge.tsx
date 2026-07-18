import { useI18n } from '@booking/i18n/react';
import type { QueuePriority } from '../types/queue.types';
import { priorityBadgeClass } from '../config/queue-config';
import styles from './QueuePriorityBadge.module.css';

interface QueuePriorityBadgeProps {
  priority: QueuePriority;
}

export function QueuePriorityBadge({ priority }: QueuePriorityBadgeProps) {
  const { t } = useI18n();
  const labelKey = `queue.priority.${priority === 'walk_in' ? 'walkIn' : priority}` as const;
  return (
    <span className={[styles.badge, styles[priorityBadgeClass(priority)]].join(' ')}>
      {t(labelKey)}
    </span>
  );
}
