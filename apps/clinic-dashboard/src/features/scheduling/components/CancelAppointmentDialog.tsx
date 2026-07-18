import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { Modal } from '@/features/patients/components/Modal';
import styles from './CancelAppointmentDialog.module.css';

interface CancelAppointmentDialogProps {
  open: boolean;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function CancelAppointmentDialog({
  open,
  busy,
  onConfirm,
  onClose,
}: CancelAppointmentDialogProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');

  function handleConfirm() {
    onConfirm(reason.trim());
    setReason('');
  }

  return (
    <Modal
      open={open}
      title={t('scheduling.cancel.title')}
      onClose={onClose}
      footer={
        <div className={styles.actions}>
          <AuthButton variant="secondary" onClick={onClose}>
            {t('scheduling.actions.close')}
          </AuthButton>
          <AuthButton variant="danger" loading={busy} onClick={handleConfirm}>
            {t('scheduling.actions.cancel')}
          </AuthButton>
        </div>
      }
    >
      <p className={styles.intro}>{t('scheduling.cancel.intro')}</p>
      <AuthFormField
        id="cancel-reason"
        label={t('scheduling.cancel.reason')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('scheduling.cancel.reasonPlaceholder')}
      />
    </Modal>
  );
}
