import { useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { Modal } from '@/features/patients/components/Modal';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { PAYMENT_METHODS, formatBillingCurrency } from '../config/billing-config';
import styles from '../billing-layout.module.css';

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  amountDue: number;
  currency: string;
  loading?: boolean;
  onSubmit: (payload: {
    amount: number;
    paymentMethod: string;
    paymentReference?: string;
    paymentDate?: string;
  }) => void;
}

export function RecordPaymentModal({
  open,
  onClose,
  amountDue,
  currency,
  loading,
  onSubmit,
}: RecordPaymentModalProps) {
  const { t, locale } = useI18n();
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState('');

  useEffect(() => {
    if (open) {
      setAmount(String(amountDue));
      setPaymentMethod(PAYMENT_METHODS[0]);
      setPaymentReference('');
      setPaymentDate('');
    }
  }, [open, amountDue]);

  function handleSubmit() {
    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onSubmit({
      amount: parsed,
      paymentMethod,
      paymentReference: paymentReference.trim() || undefined,
      paymentDate: paymentDate || undefined,
    });
  }

  return (
    <Modal
      open={open}
      title={t('billing.detail.recordPayment')}
      onClose={onClose}
      size="md"
      closeLabel={t('billing.modal.close')}
      footer={
        <div className={styles.actions}>
          <AuthButton variant="secondary" onClick={onClose}>
            {t('billing.modal.cancel')}
          </AuthButton>
          <AuthButton loading={loading} onClick={handleSubmit}>
            {t('billing.detail.recordPayment')}
          </AuthButton>
          <AuthButton variant="secondary" onClick={() => setAmount(String(amountDue))}>
            {formatMessageSafe(t('billing.detail.payFull'), {
              amount: formatBillingCurrency(amountDue, locale, currency),
            })}
          </AuthButton>
        </div>
      }
    >
      <p className={styles.hint}>
        {formatMessageSafe(t('billing.modal.dueHint'), {
          amount: formatBillingCurrency(amountDue, locale, currency),
        })}
      </p>
      <div className={styles.formGrid}>
        <AuthFormField
          label={t('billing.detail.amount')}
          id="payment-amount"
          type="number"
          min={0.01}
          step={0.01}
          max={amountDue}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <label>
          {t('billing.detail.paymentMethod')}
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {t(`billing.paymentMethods.${method}` as 'billing.paymentMethods.cash')}
              </option>
            ))}
          </select>
        </label>
        <AuthFormField
          label={t('billing.detail.reference')}
          id="payment-reference"
          value={paymentReference}
          onChange={(e) => setPaymentReference(e.target.value)}
        />
        <AuthFormField
          label={t('billing.detail.paymentDate')}
          id="payment-date"
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function formatMessageSafe(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}
