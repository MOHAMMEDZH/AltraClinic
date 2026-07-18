import { useI18n } from '@booking/i18n/react';
import type { AppointmentStatus } from '../types/scheduling.types';
import { statusBadgeClass } from '../config/scheduling-config';
import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
  status: AppointmentStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useI18n();
  const cls = statusBadgeClass(status);
  const labelKey =
    status === 'no_show'
      ? 'scheduling.status.noShow'
      : status === 'checked_in'
        ? 'scheduling.status.checkedIn'
        : status === 'in_progress'
          ? 'scheduling.status.inProgress'
          : `scheduling.status.${status}`;
  return (
    <span className={[styles.badge, styles[cls]].join(' ')}>{t(labelKey)}</span>
  );
}
