import { ReactNode } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import styles from '../settings-layout.module.css';

interface SettingsFormToolbarProps {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  onCancel: () => void;
  extra?: ReactNode;
}

export function SettingsFormToolbar({ dirty, saving, onSave, onCancel, extra }: SettingsFormToolbarProps) {
  const { t } = useI18n();
  return (
    <div className={styles.actions}>
      {extra}
      <AuthButton variant="secondary" disabled={!dirty || saving} onClick={onCancel}>
        {t('settings.actions.cancel')}
      </AuthButton>
      <AuthButton loading={saving} disabled={!dirty} onClick={onSave}>
        {t('settings.actions.save')}
      </AuthButton>
    </div>
  );
}
