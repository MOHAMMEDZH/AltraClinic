import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { formatBillingCurrency } from '../config/billing-config';
import { useApplyInvoiceInsurance } from '../hooks/useBilling';
import type { Invoice } from '../types/billing.types';
import layoutStyles from '../billing-layout.module.css';

const CLAIM_STATUSES = ['pending', 'submitted', 'approved', 'paid', 'denied'] as const;

interface InsurancePanelProps {
  invoice: Invoice;
  locale: string;
  canEdit: boolean;
}

export function InsurancePanel({ invoice, locale, canEdit }: InsurancePanelProps) {
  const { t } = useI18n();
  const mutation = useApplyInvoiceInsurance();
  const [provider, setProvider] = useState(invoice.insuranceProvider ?? '');
  const [policyNumber, setPolicyNumber] = useState(invoice.insurancePolicyNumber ?? '');
  const [insuranceAmount, setInsuranceAmount] = useState(String(invoice.insuranceAmount ?? 0));
  const [patientAmount, setPatientAmount] = useState(String(invoice.patientResponsibility ?? invoice.amountDue));
  const [claimStatus, setClaimStatus] = useState(invoice.insuranceClaimStatus ?? 'pending');

  async function handleSave() {
    await mutation.mutateAsync({
      invoiceId: invoice.invoiceId,
      insuranceProvider: provider,
      insurancePolicyNumber: policyNumber || undefined,
      insuranceAmount: Number.parseFloat(insuranceAmount) || 0,
      patientResponsibility: Number.parseFloat(patientAmount) || 0,
      insuranceClaimStatus: claimStatus,
    });
  }

  return (
    <section className={layoutStyles.panel} aria-label={t('billing.insurance.title')}>
      <h2 className={layoutStyles.panelTitle}>{t('billing.insurance.title')}</h2>
      <p className={layoutStyles.hint}>{t('billing.insurance.subtitle')}</p>
      {invoice.insuranceProvider && (
        <p className={layoutStyles.hint}>
          {t('billing.insurance.currentStatus')}: {t(`billing.insurance.status.${claimStatus}` as 'billing.insurance.status.pending')}
        </p>
      )}
      <div className={layoutStyles.formGrid}>
        <label>
          {t('billing.insurance.provider')}
          <input value={provider} disabled={!canEdit} onChange={(e) => setProvider(e.target.value)} />
        </label>
        <label>
          {t('billing.insurance.policyNumber')}
          <input value={policyNumber} disabled={!canEdit} onChange={(e) => setPolicyNumber(e.target.value)} />
        </label>
        <label>
          {t('billing.insurance.insuranceAmount')}
          <input type="number" min={0} step={0.01} value={insuranceAmount} disabled={!canEdit} onChange={(e) => setInsuranceAmount(e.target.value)} />
        </label>
        <label>
          {t('billing.insurance.patientAmount')}
          <input type="number" min={0} step={0.01} value={patientAmount} disabled={!canEdit} onChange={(e) => setPatientAmount(e.target.value)} />
        </label>
        <label>
          {t('billing.insurance.claimStatus')}
          <select value={claimStatus} disabled={!canEdit} onChange={(e) => setClaimStatus(e.target.value)}>
            {CLAIM_STATUSES.map((s) => (
              <option key={s} value={s}>{t(`billing.insurance.status.${s}` as 'billing.insurance.status.pending')}</option>
            ))}
          </select>
        </label>
      </div>
      <p className={layoutStyles.hint}>
        {t('billing.insurance.invoiceTotal')}: {formatBillingCurrency(invoice.amountTotal, locale, invoice.currency)}
      </p>
      {canEdit && (
        <AuthButton loading={mutation.isPending} onClick={() => void handleSave()}>
          {t('billing.insurance.save')}
        </AuthButton>
      )}
    </section>
  );
}
