import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { Modal } from '@/features/patients/components/Modal';
import { AuthButton } from '@/features/auth/components/AuthButton';
import styles from '../billing-layout.module.css';

interface PaymentPlanModalProps {
  open: boolean;
  onClose: () => void;
  loading?: boolean;
  onSubmit: (payload: { installmentCount: number; startDate: string; notes?: string }) => void;
}

export function PaymentPlanModal({ open, onClose, loading, onSubmit }: PaymentPlanModalProps) {
  const { t } = useI18n();
  const [installmentCount, setInstallmentCount] = useState('3');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <Modal open={open} title={t('billing.paymentPlan.title')} onClose={onClose} closeLabel={t('billing.modal.cancel')}
      footer={
        <div className={styles.actions}>
          <AuthButton variant="secondary" onClick={onClose}>{t('billing.modal.cancel')}</AuthButton>
          <AuthButton loading={loading} onClick={() => onSubmit({ installmentCount: Number.parseInt(installmentCount, 10), startDate })}>
            {t('billing.paymentPlan.submit')}
          </AuthButton>
        </div>
      }>
      <div className={styles.formGrid}>
        <label>{t('billing.paymentPlan.installments')}<input type="number" min={2} max={24} value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} /></label>
        <label>{t('billing.paymentPlan.startDate')}<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
      </div>
    </Modal>
  );
}
