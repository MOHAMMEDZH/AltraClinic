import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { Modal } from '@/features/patients/components/Modal';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { PAYMENT_METHODS, formatBillingCurrency } from '../config/billing-config';
import styles from '../billing-layout.module.css';

type PaymentLine = {
  amount: string;
  paymentMethod: (typeof PAYMENT_METHODS)[number];
  paymentReference: string;
};

interface SplitPaymentModalProps {
  open: boolean;
  onClose: () => void;
  amountDue: number;
  currency: string;
  locale: string;
  loading?: boolean;
  onSubmit: (payments: Array<{ amount: number; paymentMethod: string; paymentReference?: string }>) => void;
}

export function SplitPaymentModal({ open, onClose, amountDue, currency, locale, loading, onSubmit }: SplitPaymentModalProps) {
  const { t } = useI18n();
  const [lines, setLines] = useState<PaymentLine[]>([
    { amount: String(amountDue / 2), paymentMethod: PAYMENT_METHODS[0], paymentReference: '' },
    { amount: String(amountDue / 2), paymentMethod: PAYMENT_METHODS[1] ?? PAYMENT_METHODS[0], paymentReference: '' },
  ]);

  const total = lines.reduce((s, l) => s + (Number.parseFloat(l.amount) || 0), 0);

  return (
    <Modal open={open} title={t('billing.split.title')} onClose={onClose} closeLabel={t('billing.modal.cancel')}
      footer={
        <div className={styles.actions}>
          <AuthButton variant="secondary" onClick={onClose}>{t('billing.modal.cancel')}</AuthButton>
          <AuthButton loading={loading} onClick={() => onSubmit(lines.map((l) => ({ amount: Number.parseFloat(l.amount), paymentMethod: l.paymentMethod, paymentReference: l.paymentReference || undefined })))}>
            {t('billing.split.submit')}
          </AuthButton>
        </div>
      }>
      <p className={styles.hint}>{t('billing.split.due')}: {formatBillingCurrency(amountDue, locale, currency)} · {t('billing.split.total')}: {formatBillingCurrency(total, locale, currency)}</p>
      {lines.map((line, index) => (
        <div key={index} className={styles.lineRow}>
          <label>{t('billing.detail.amount')}<input type="number" min={0} step={0.01} value={line.amount} onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, amount: e.target.value } : r))} /></label>
          <label>{t('billing.detail.paymentMethod')}<select value={line.paymentMethod} onChange={(e) => setLines((rows) => rows.map((r, i) => i === index ? { ...r, paymentMethod: e.target.value as PaymentLine['paymentMethod'] } : r))}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(`billing.paymentMethods.${m}` as 'billing.paymentMethods.cash')}</option>)}</select></label>
        </div>
      ))}
      <AuthButton variant="secondary" onClick={() => setLines((rows) => [...rows, { amount: '0', paymentMethod: PAYMENT_METHODS[0], paymentReference: '' }])}>{t('billing.split.addLine')}</AuthButton>
    </Modal>
  );
}
