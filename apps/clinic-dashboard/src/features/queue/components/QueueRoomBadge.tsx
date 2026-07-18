import { DoorOpen } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import styles from './QueueRoomBadge.module.css';

interface QueueRoomBadgeProps {
  resourceName: string;
}

export function QueueRoomBadge({ resourceName }: QueueRoomBadgeProps) {
  const { t } = useI18n();

  return (
    <span className={styles.badge} title={t('queue.room.label')}>
      <DoorOpen size={12} className={styles.icon} aria-hidden />
      {resourceName}
    </span>
  );
}
