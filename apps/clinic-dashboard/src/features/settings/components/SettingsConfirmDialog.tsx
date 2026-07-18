import { ReactNode } from 'react';
import { Modal } from '@/features/patients/components/Modal';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { useI18n } from '@booking/i18n/react';
import styles from '../settings-layout.module.css';

interface SettingsConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SettingsConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  loading,
  onConfirm,
  onCancel,
}: SettingsConfirmDialogProps) {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <div className={styles.actions}>
          <AuthButton variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel ?? t('settings.actions.cancel')}
          </AuthButton>
          <AuthButton
            variant={destructive ? 'danger' : 'primary'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel ?? t('settings.confirm.confirm')}
          </AuthButton>
        </div>
      }
    >
      <p className={styles.pageSubtitle}>{message}</p>
    </Modal>
  );
}
