import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import styles from './AppointmentBranchLabel.module.css';

interface AppointmentBranchLabelProps {
  branchId: string | null;
  branchLabels?: Record<string, string>;
  show?: boolean;
  className?: string;
}

export function AppointmentBranchLabel({
  branchId,
  branchLabels,
  show,
  className,
}: AppointmentBranchLabelProps) {
  const { t } = useI18n();
  if (!show || !branchId || !branchLabels?.[branchId]) return null;

  return (
    <span className={[styles.label, className].filter(Boolean).join(' ')}>
      {formatMessage(t('scheduling.calendar.branchLabel'), { name: branchLabels[branchId] })}
    </span>
  );
}
