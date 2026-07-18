import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { usePatientsList } from '@/features/patients/hooks/usePatients';
import { patientFullName } from '@/features/patients/lib/patient-format';
import {
  canCreateBilling,
  generateInvoiceNumber,
  resolveBillingWorkspaceMode,
} from './config/billing-config';
import { useCreateInvoice, useNextInvoiceNumber } from './hooks/useBilling';
import { mapBillingApiError } from './api/billing-api';
import { BillingQuickNav } from './components/BillingQuickNav';
import type { CreateInvoiceLineInput } from './types/billing.types';
import styles from './billing-layout.module.css';

const emptyLine = (): CreateInvoiceLineInput => ({
  description: '',
  quantity: 1,
  unitPrice: 0,
});

export function CreateInvoicePage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.billing', action as never), [roles]);
  const workspaceMode = resolveBillingWorkspaceMode(roles);

  const canCreate = canCreateBilling(perm);
  const createMutation = useCreateInvoice();
  const nextNumberQuery = useNextInvoiceNumber(canCreate);

  const [patientSearch, setPatientSearch] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<CreateInvoiceLineInput[]>([emptyLine()]);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(patientSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  const patientsQuery = usePatientsList({ q: debouncedQ || undefined, status: 'active', limit: 20 });
  const patients = patientsQuery.data?.items ?? [];

  function updateLine(index: number, patch: Partial<CreateInvoiceLineInput>) {
    setLineItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeLine(index: number) {
    setLineItems((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
  }

  function addLine() {
    setLineItems((rows) => [...rows, emptyLine()]);
  }

  async function handleSubmit(issueAfter = false) {
    setErrorKey(null);
    if (!selectedPatientId) {
      setErrorKey('selectPatient');
      return;
    }
    const validLines = lineItems.filter((l) => l.description.trim() && l.quantity > 0);
    if (validLines.length === 0) {
      setErrorKey('lineItemsRequired');
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        patientId: selectedPatientId,
        invoiceNumber: nextNumberQuery.data ?? generateInvoiceNumber(),
        invoiceDate: new Date(invoiceDate).toISOString(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        notes: notes.trim() || null,
        lineItems: validLines,
        requireActiveSubscription: false,
      });
      navigate(`/billing/invoices/${result.invoiceId}${issueAfter ? '?issue=1' : ''}`);
    } catch (err) {
      setErrorKey(mapBillingApiError(err));
    }
  }

  if (!canCreate) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('billing.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link to="/billing/invoices" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden />
        {t('billing.create.back')}
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('billing.create.title')}</h1>
          <p className={styles.subtitle}>{t('billing.create.subtitle')}</p>
        </div>
      </header>

      <BillingQuickNav mode={workspaceMode} canCreate />

      {errorKey && (
        <AuthAlert variant="error">
          {t(`billing.errors.${errorKey}` as 'billing.errors.generic')}
        </AuthAlert>
      )}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('billing.create.patientSection')}</h2>
        <input
          className={styles.searchInput}
          value={patientSearch}
          placeholder={t('billing.unbilled.searchPatient')}
          aria-label={t('billing.unbilled.searchPatient')}
          onChange={(e) => setPatientSearch(e.target.value)}
        />
        {patients.length > 0 && (
          <div className={styles.patientList} role="listbox" aria-label={t('billing.unbilled.selectPatient')}>
            {patients.map((patient) => (
              <button
                key={patient.id}
                type="button"
                role="option"
                aria-selected={selectedPatientId === patient.id}
                className={
                  selectedPatientId === patient.id
                    ? `${styles.patientOption} ${styles.patientSelected}`
                    : styles.patientOption
                }
                onClick={() => setSelectedPatientId(patient.id)}
              >
                {patientFullName(patient, locale)}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('billing.create.detailsSection')}</h2>
        <div className={styles.formGrid}>
          <label>
            {t('billing.create.invoiceDate')}
            <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </label>
          <label>
            {t('billing.create.dueDate')}
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>
        <label>
          {t('billing.create.notes')}
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </section>

      <section className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.panelTitle}>{t('billing.create.lineItemsSection')}</h2>
          <AuthButton variant="secondary" onClick={addLine}>
            <Plus size={16} aria-hidden />
            {t('billing.create.addLine')}
          </AuthButton>
        </div>
        <div className={styles.lineItemsEditor}>
          {lineItems.map((line, index) => (
            <div key={index} className={styles.lineRow}>
              <label>
                {t('billing.detail.description')}
                <input
                  value={line.description}
                  onChange={(e) => updateLine(index, { description: e.target.value })}
                />
              </label>
              <label>
                {t('billing.unbilled.quantity')}
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                />
              </label>
              <label>
                {t('billing.unbilled.unitPrice')}
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={line.unitPrice}
                  onChange={(e) => updateLine(index, { unitPrice: Number(e.target.value) })}
                />
              </label>
              <AuthButton variant="secondary" onClick={() => removeLine(index)} aria-label={t('billing.create.removeLine')}>
                <Trash2 size={16} aria-hidden />
              </AuthButton>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.actions}>
        <AuthButton loading={createMutation.isPending} onClick={() => void handleSubmit(false)}>
          {t('billing.create.saveDraft')}
        </AuthButton>
        <AuthButton variant="secondary" loading={createMutation.isPending} onClick={() => void handleSubmit(true)}>
          {t('billing.create.saveAndOpen')}
        </AuthButton>
      </div>
    </div>
  );
}
