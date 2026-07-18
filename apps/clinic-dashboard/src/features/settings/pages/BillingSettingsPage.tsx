import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { SettingsFormToolbar } from '../components/SettingsFormToolbar';
import { useBillingSequences, useTenantSettings, useUpdateBillingSequences, useUpdateTenantSettings } from '../hooks/useSettings';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import styles from '../settings-layout.module.css';

export function BillingSettingsPage() {
  const { t } = useI18n();
  const settings = useTenantSettings();
  const sequences = useBillingSequences();
  const saveSettings = useUpdateTenantSettings();
  const saveSequences = useUpdateBillingSequences();
  const [dirty, setDirty] = useState(false);
  const [billing, setBilling] = useState({
    taxRate: '',
    defaultPaymentMethod: 'cash',
    invoiceDueDays: '30',
    receiptFooter: '',
    refundPolicy: '',
  });
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [invoiceNumber, setInvoiceNumber] = useState('0');

  useEffect(() => {
    if (!settings.data) return;
    const b = settings.data.billingSettings ?? {};
    setBilling({
      taxRate: String(b.taxRate ?? ''),
      defaultPaymentMethod: String(b.defaultPaymentMethod ?? 'cash'),
      invoiceDueDays: String(b.invoiceDueDays ?? '30'),
      receiptFooter: String(b.receiptFooter ?? ''),
      refundPolicy: String(b.refundPolicy ?? ''),
    });
    setDirty(false);
  }, [settings.data]);

  useEffect(() => {
    const inv = sequences.data?.find((s) => s.prefix === 'INV') ?? sequences.data?.[0];
    if (inv) {
      setInvoicePrefix(inv.prefix);
      setInvoiceNumber(String(inv.lastNumber));
    }
  }, [sequences.data]);

  useUnsavedChangesGuard(dirty);

  function handleSave() {
    saveSettings.mutate(
      { billingSettings: billing },
      {
        onSuccess: () => {
          saveSequences.mutate([{ prefix: invoicePrefix, lastNumber: Number(invoiceNumber) || 0 }], {
            onSuccess: () => setDirty(false),
          });
        },
      },
    );
  }

  if (settings.isLoading) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('settings.loading')} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('settings.billing.title')}</h2>
          <p className={styles.pageSubtitle}>{t('settings.billing.subtitle')}</p>
        </div>
        <SettingsFormToolbar dirty={dirty} saving={saveSettings.isPending} onSave={handleSave} onCancel={() => settings.refetch()} />
      </header>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>{t('settings.billing.invoicing')}</h3>
        <AuthFormField id="invoice-prefix" label={t('settings.billing.invoicePrefix')} value={invoicePrefix} onChange={(e) => { setInvoicePrefix(e.target.value); setDirty(true); }} dir="ltr" />
        <AuthFormField id="invoice-number" label={t('settings.billing.lastNumber')} type="number" min={0} value={invoiceNumber} onChange={(e) => { setInvoiceNumber(e.target.value); setDirty(true); }} dir="ltr" />
        <AuthFormField id="due-days" label={t('settings.billing.dueDays')} type="number" min={0} value={billing.invoiceDueDays} onChange={(e) => { setBilling((p) => ({ ...p, invoiceDueDays: e.target.value })); setDirty(true); }} />
        <AuthFormField id="tax-rate" label={t('settings.billing.taxRate')} value={billing.taxRate} onChange={(e) => { setBilling((p) => ({ ...p, taxRate: e.target.value })); setDirty(true); }} dir="ltr" />
        <AuthFormField id="payment-method" label={t('settings.billing.defaultPayment')}>
          <select id="payment-method" className={styles.select} value={billing.defaultPaymentMethod} onChange={(e) => { setBilling((p) => ({ ...p, defaultPaymentMethod: e.target.value })); setDirty(true); }}>
            <option value="cash">{t('settings.billing.methods.cash')}</option>
            <option value="card">{t('settings.billing.methods.card')}</option>
            <option value="bank">{t('settings.billing.methods.bank')}</option>
          </select>
        </AuthFormField>
        <AuthFormField id="receipt-footer" label={t('settings.billing.receiptFooter')} value={billing.receiptFooter} onChange={(e) => { setBilling((p) => ({ ...p, receiptFooter: e.target.value })); setDirty(true); }} />
        <AuthFormField id="refund-policy" label={t('settings.billing.refundPolicy')} value={billing.refundPolicy} onChange={(e) => { setBilling((p) => ({ ...p, refundPolicy: e.target.value })); setDirty(true); }} />
      </section>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>{t('settings.billing.quickLinks')}</h3>
        <div className={styles.kpiGrid}>
          <Link to="/billing/pricing" className={styles.kpiCard}>{t('settings.billing.pricing')}</Link>
          <Link to="/settings/subscription/invoices" className={styles.kpiCard}>{t('settings.billing.invoices')}</Link>
        </div>
      </section>

      {saveSettings.isSuccess && !dirty && <AuthAlert variant="success">{t('settings.saveSuccess')}</AuthAlert>}
    </div>
  );
}
