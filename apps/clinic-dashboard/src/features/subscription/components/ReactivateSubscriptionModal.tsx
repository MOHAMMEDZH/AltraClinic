import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { Modal } from '@/features/patients/components/Modal';
import styles from '../subscription-layout.module.css';

interface ReactivateSubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  loading?: boolean;
  onConfirm: () => void;
}

export function ReactivateSubscriptionModal({
  open,
  onClose,
  loading = false,
  onConfirm,
}: ReactivateSubscriptionModalProps) {
  const { t } = useI18n();

  return (
    <Modal
      open={open}
      title={t('subscription.reactivate.title')}
      onClose={onClose}
      footer={
        <>
          <AuthButton variant="secondary" onClick={onClose} disabled={loading}>
            {t('subscription.actions.cancel')}
          </AuthButton>
          <AuthButton loading={loading} onClick={onConfirm}>
            {t('subscription.reactivate.confirm')}
          </AuthButton>
        </>
      }
    >
      <p className={styles.pageSubtitle}>{t('subscription.reactivate.description')}</p>
    </Modal>
  );
}
