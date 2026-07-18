import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { Modal } from '@/features/patients/components/Modal';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { PAYMENT_METHODS } from '../config/billing-config';
import styles from '../billing-layout.module.css';

interface RefundModalProps {
  open: boolean;
  onClose: () => void;
  maxAmount: number;
  loading?: boolean;
  onSubmit: (payload: { amount: number; reason: string; refundMethod: string; notes?: string }) => void;
}

export function RefundModal({ open, onClose, maxAmount, loading, onSubmit }: RefundModalProps) {
  const { t } = useI18n();
  const [amount, setAmount] = useState(String(maxAmount));
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<string>(PAYMENT_METHODS[0]);

  return (
    <Modal open={open} title={t('billing.refund.title')} onClose={onClose} closeLabel={t('billing.modal.cancel')}
      footer={
        <div className={styles.actions}>
          <AuthButton variant="secondary" onClick={onClose}>{t('billing.modal.cancel')}</AuthButton>
          <AuthButton loading={loading} onClick={() => onSubmit({ amount: Number.parseFloat(amount), reason, refundMethod })}>
            {t('billing.refund.submit')}
          </AuthButton>
        </div>
      }>
      <div className={styles.formGrid}>
        <label>{t('billing.detail.amount')}<input type="number" min={0.01} max={maxAmount} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label>{t('billing.refund.reason')}<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <label>{t('billing.refund.method')}<select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`billing.paymentMethods.${m}` as 'billing.paymentMethods.cash')}</option>)}</select></label>
      </div>
    </Modal>
  );
}
