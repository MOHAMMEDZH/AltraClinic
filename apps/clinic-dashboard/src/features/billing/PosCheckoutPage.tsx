import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { usePatientsList } from '@/features/patients/hooks/usePatients';
import { patientFullName } from '@/features/patients/lib/patient-format';
import {
  canCreateBilling,
  canRecordPayment,
  canViewBilling,
  formatBillingCurrency,
  PAYMENT_METHODS,
  resolveBillingWorkspaceMode,
} from './config/billing-config';
import { useCreateInvoice, useIssueInvoice, useNextInvoiceNumber, useRecordSplitPayments, useServicePrices } from './hooks/useBilling';
import { BillingQuickNav } from './components/BillingQuickNav';
import styles from './billing-layout.module.css';

export function PosCheckoutPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.billing', action as never), [roles]);
  const workspaceMode = resolveBillingWorkspaceMode(roles);

  const canView = canViewBilling(perm);
  const canCreate = canCreateBilling(perm);
  const canPay = canRecordPayment(perm);

  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [step, setStep] = useState<'patient' | 'services' | 'pay'>('patient');

  const patientsQuery = usePatientsList({ q: patientSearch || undefined, status: 'active', limit: 15 });
  const pricesQuery = useServicePrices(canView);
  const nextNumberQuery = useNextInvoiceNumber(step === 'services' && canCreate);
  const createMutation = useCreateInvoice();
  const issueMutation = useIssueInvoice();
  const splitMutation = useRecordSplitPayments();

  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const selectedPrice = useMemo(
    () => (pricesQuery.data ?? []).find((p) => p.id === selectedServiceId),
    [pricesQuery.data, selectedServiceId],
  );

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('billing.accessDenied')}</AuthAlert>
      </div>
    );
  }

  async function createDraftAndPay() {
    if (!selectedPatientId || !selectedPrice) return;
    const invoiceNumber = nextNumberQuery.data ?? `INV-${Date.now()}`;
    const created = await createMutation.mutateAsync({
      patientId: selectedPatientId,
      invoiceNumber,
      invoiceDate: new Date().toISOString(),
      requireActiveSubscription: false,
      lineItems: [{
        description: selectedPrice.nameEn,
        quantity: 1,
        unitPrice: selectedPrice.unitPrice,
        taxPercent: selectedPrice.taxPercent,
      }],
    });
    await issueMutation.mutateAsync(created.invoiceId);
    setCreatedInvoiceId(created.invoiceId);
    setStep('pay');
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('billing.pos.title')}</h1>
          <p className={styles.subtitle}>{t('billing.pos.subtitle')}</p>
        </div>
      </header>

      <BillingQuickNav mode={workspaceMode} canCreate={canCreate} />

      {step === 'patient' && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.pos.selectPatient')}</h2>
          <input className={styles.searchInput} value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder={t('billing.unbilled.searchPatient')} />
          <div className={styles.patientList}>
            {(patientsQuery.data?.items ?? []).map((patient) => (
              <button
                key={patient.id}
                type="button"
                className={selectedPatientId === patient.id ? `${styles.patientOption} ${styles.patientSelected}` : styles.patientOption}
                onClick={() => setSelectedPatientId(patient.id)}
              >
                {patientFullName(patient, locale)}
              </button>
            ))}
          </div>
          <AuthButton disabled={!selectedPatientId} onClick={() => setStep('services')}>{t('billing.pos.continue')}</AuthButton>
        </section>
      )}

      {step === 'services' && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.pos.selectService')}</h2>
          <select className={styles.selectInput} value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)}>
            <option value="">{t('billing.pos.chooseService')}</option>
            {(pricesQuery.data ?? []).filter((p) => p.isActive).map((p) => (
              <option key={p.id} value={p.id}>{p.nameEn} — {formatBillingCurrency(p.unitPrice, locale, p.currency)}</option>
            ))}
          </select>
          <div className={styles.actions}>
            <AuthButton variant="secondary" onClick={() => setStep('patient')}>{t('billing.pos.back')}</AuthButton>
            <AuthButton loading={createMutation.isPending || issueMutation.isPending} disabled={!selectedServiceId || !canCreate} onClick={() => void createDraftAndPay()}>
              {t('billing.pos.createInvoice')}
            </AuthButton>
          </div>
        </section>
      )}

      {step === 'pay' && createdInvoiceId && selectedPrice && canPay && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.pos.collectPayment')}</h2>
          <p className={styles.hint}>{formatBillingCurrency(selectedPrice.unitPrice, locale, selectedPrice.currency)}</p>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{t(`billing.paymentMethods.${m}` as 'billing.paymentMethods.cash')}</option>
            ))}
          </select>
          <AuthButton
            loading={splitMutation.isPending}
            onClick={() => {
              void splitMutation.mutateAsync({
                invoiceId: createdInvoiceId,
                payments: [{ amount: selectedPrice.unitPrice, paymentMethod }],
              }).then((result) => navigate(`/billing/receipts/${encodeURIComponent(result.receiptNumber)}?print=1`));
            }}
          >
            {t('billing.pos.complete')}
          </AuthButton>
        </section>
      )}
    </div>
  );
}
