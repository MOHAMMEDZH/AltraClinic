import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { Modal } from '@/features/patients/components/Modal';
import styles from '../subscription-layout.module.css';

export type EntitlementGrantType = 'aiCredits' | 'storage' | 'users';

interface TenantEntitlementModalProps {
  open: boolean;
  tenantName: string;
  grantType: EntitlementGrantType;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (amount: number, note: string) => void;
}

export function TenantEntitlementModal({
  open,
  tenantName,
  grantType,
  loading = false,
  onClose,
  onConfirm,
}: TenantEntitlementModalProps) {
  const { t } = useI18n();
  const [amount, setAmount] = useState('100');
  const [note, setNote] = useState('');

  const titleKey =
    grantType === 'aiCredits'
      ? 'subscription.superAdmin.grantAiCredits'
      : grantType === 'storage'
        ? 'subscription.superAdmin.grantStorage'
        : 'subscription.superAdmin.grantUsers';

  return (
    <Modal
      open={open}
      title={t(titleKey)}
      onClose={onClose}
      footer={
        <>
          <AuthButton variant="secondary" onClick={onClose} disabled={loading}>
            {t('subscription.actions.cancel')}
          </AuthButton>
          <AuthButton loading={loading} onClick={() => onConfirm(Number(amount) || 0, note)}>
            {t('subscription.superAdmin.grantConfirm')}
          </AuthButton>
        </>
      }
    >
      <p className={styles.pageSubtitle}>
        {t('subscription.superAdmin.grantHint')} — <strong>{tenantName}</strong>
      </p>
      <AuthFormField
        id="grant-amount"
        label={t('subscription.superAdmin.grantAmount')}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        type="number"
        min={1}
      />
      <AuthFormField
        id="grant-note"
        label={t('subscription.superAdmin.grantNote')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </Modal>
  );
}
