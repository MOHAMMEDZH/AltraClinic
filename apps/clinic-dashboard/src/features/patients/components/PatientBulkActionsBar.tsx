import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { AuthButton } from '@/features/auth/components/AuthButton';
import styles from './PatientBulkActionsBar.module.css';

interface PatientBulkActionsBarProps {
  selectedCount: number;
  canArchive: boolean;
  exporting?: boolean;
  archiving?: boolean;
  onExportSelected: () => void;
  onArchiveSelected: () => void;
  onClear: () => void;
}

export function PatientBulkActionsBar({
  selectedCount,
  canArchive,
  exporting,
  archiving,
  onExportSelected,
  onArchiveSelected,
  onClear,
}: PatientBulkActionsBarProps) {
  const { t } = useI18n();

  if (selectedCount === 0) return null;

  return (
    <div className={styles.bar} role="region" aria-label={t('patients.bulk.title')}>
      <span className={styles.count}>
        {formatMessage(t('patients.bulk.selected'), { count: String(selectedCount) })}
      </span>
      <div className={styles.actions}>
        <AuthButton variant="secondary" loading={exporting} onClick={onExportSelected}>
          {t('patients.bulk.exportSelected')}
        </AuthButton>
        {canArchive && (
          <AuthButton variant="danger" loading={archiving} onClick={onArchiveSelected}>
            {t('patients.bulk.archiveSelected')}
          </AuthButton>
        )}
        <AuthButton variant="ghost" onClick={onClear}>
          {t('patients.bulk.clearSelection')}
        </AuthButton>
      </div>
    </div>
  );
}
