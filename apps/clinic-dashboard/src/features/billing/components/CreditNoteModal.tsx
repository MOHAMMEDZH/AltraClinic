import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { Modal } from '@/features/patients/components/Modal';
import { AuthButton } from '@/features/auth/components/AuthButton';
import styles from '../billing-layout.module.css';

interface CreditNoteModalProps {
  open: boolean;
  onClose: () => void;
  maxAmount: number;
  loading?: boolean;
  onSubmit: (payload: { amount: number; reason: string; notes?: string }) => void;
}

export function CreditNoteModal({ open, onClose, maxAmount, loading, onSubmit }: CreditNoteModalProps) {
  const { t } = useI18n();
  const [amount, setAmount] = useState(String(maxAmount));
  const [reason, setReason] = useState('');

  return (
    <Modal open={open} title={t('billing.creditNote.title')} onClose={onClose} closeLabel={t('billing.modal.cancel')}
      footer={
        <div className={styles.actions}>
          <AuthButton variant="secondary" onClick={onClose}>{t('billing.modal.cancel')}</AuthButton>
          <AuthButton loading={loading} onClick={() => onSubmit({ amount: Number.parseFloat(amount), reason })}>
            {t('billing.creditNote.submit')}
          </AuthButton>
        </div>
      }>
      <div className={styles.formGrid}>
        <label>{t('billing.detail.amount')}<input type="number" min={0.01} max={maxAmount} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label>{t('billing.creditNote.reason')}<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      </div>
    </Modal>
  );
}
