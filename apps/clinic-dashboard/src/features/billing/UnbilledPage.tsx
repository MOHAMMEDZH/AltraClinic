import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { usePatientsList } from '@/features/patients/hooks/usePatients';
import { patientFullName } from '@/features/patients/lib/patient-format';
import { canCreateBilling, canViewBilling, resolveBillingWorkspaceMode } from './config/billing-config';
import { UnbilledConsumptionsPanel } from './components/UnbilledConsumptionsPanel';
import { BillingQuickNav } from './components/BillingQuickNav';
import styles from './billing-layout.module.css';

export function UnbilledPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.billing', action as never), [roles]);
  const workspaceMode = resolveBillingWorkspaceMode(roles);

  const [patientSearch, setPatientSearch] = useState('');
  const [debouncedPatientQ, setDebouncedPatientQ] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPatientQ(patientSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  const canView = canViewBilling(perm);
  const canCreate = canCreateBilling(perm);
  const patientsQuery = usePatientsList({ q: debouncedPatientQ || undefined, status: 'active', limit: 20 });
  const patients = patientsQuery.data?.items ?? [];

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('billing.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('billing.tabs.unbilled')}</h1>
          <p className={styles.subtitle}>{t('billing.unbilled.hint')}</p>
        </div>
      </header>

      <BillingQuickNav mode={workspaceMode} canCreate={canCreate} />

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          value={patientSearch}
          placeholder={t('billing.unbilled.searchPatient')}
          aria-label={t('billing.unbilled.searchPatient')}
          onChange={(e) => setPatientSearch(e.target.value)}
        />
      </div>

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

      {selectedPatientId ? (
        <UnbilledConsumptionsPanel
          patientId={selectedPatientId}
          canCreate={canCreate}
          onBilled={({ invoiceId }) => navigate(`/billing/invoices/${invoiceId}`)}
        />
      ) : (
        <p className={styles.empty}>{t('billing.unbilled.selectPatientPrompt')}</p>
      )}
    </div>
  );
}
