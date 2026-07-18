import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import styles from './BulkRescheduleBar.module.css';

interface BulkRescheduleBarProps {
  selectedCount: number;
  busy?: boolean;
  onReschedule: (shiftDays: number) => void;
  onClear: () => void;
}

export function BulkRescheduleBar({
  selectedCount,
  busy,
  onReschedule,
  onClear,
}: BulkRescheduleBarProps) {
  const { t } = useI18n();
  const [shiftDays, setShiftDays] = useState(1);

  if (selectedCount === 0) return null;

  return (
    <div className={styles.bar} role="region" aria-label={t('scheduling.bulk.title')}>
      <p className={styles.summary}>{formatMessage(t('scheduling.bulk.selected'), { n: selectedCount })}</p>
      <div className={styles.controls}>
        <AuthFormField
          id="bulk-shift-days"
          label={t('scheduling.bulk.shiftDays')}
          type="number"
          min={-90}
          max={90}
          value={shiftDays}
          onChange={(e) => setShiftDays(Number(e.target.value) || 0)}
        />
        <AuthButton
          loading={busy}
          disabled={shiftDays === 0}
          onClick={() => onReschedule(shiftDays)}
        >
          {t('scheduling.bulk.apply')}
        </AuthButton>
        <AuthButton variant="ghost" onClick={onClear}>
          {t('scheduling.bulk.clear')}
        </AuthButton>
      </div>
    </div>
  );
}
