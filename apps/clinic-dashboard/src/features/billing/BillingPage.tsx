import { useCallback, useEffect, useState } from 'react';

import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { hasPermission } from '@booking/permissions';

import { useI18n } from '@booking/i18n/react';

import { useAuth } from '@/app/providers/AuthProvider';

import { AuthAlert } from '@/features/auth/components/AuthAlert';

import { usePatientsList } from '@/features/patients/hooks/usePatients';

import { patientFullName } from '@/features/patients/lib/patient-format';

import {

  canCreateBilling,

  canViewBilling,

  formatBillingCurrency,

  formatBillingDate,

} from './config/billing-config';

import { useInvoices } from './hooks/useBilling';

import { UnbilledConsumptionsPanel } from './components/UnbilledConsumptionsPanel';

import styles from './BillingPage.module.css';



type Tab = 'invoices' | 'unbilled';



export function BillingPage() {

  const { t, locale } = useI18n();

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const focusOutstanding = searchParams.get('focus') === 'outstanding';

  const { user } = useAuth();

  const roles = user?.roles ?? [];

  const perm = useCallback((action: string) => hasPermission(roles, 'api.billing', action as never), [roles]);



  const [tab, setTab] = useState<Tab>('invoices');

  const [patientSearch, setPatientSearch] = useState('');

  const [debouncedPatientQ, setDebouncedPatientQ] = useState('');

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);



  useEffect(() => {

    const timer = setTimeout(() => setDebouncedPatientQ(patientSearch.trim()), 300);

    return () => clearTimeout(timer);

  }, [patientSearch]);



  const canView = canViewBilling(perm);

  const canCreate = canCreateBilling(perm);



  const invoicesQuery = useInvoices({ enabled: canView && tab === 'invoices' });

  const patientsQuery = usePatientsList({

    q: debouncedPatientQ || undefined,

    status: 'active',

    limit: 20,

  });



  const patients = tab === 'unbilled' ? (patientsQuery.data?.items ?? []) : [];

  const invoices = invoicesQuery.data ?? [];
  const displayedInvoices = focusOutstanding
    ? invoices.filter((inv) => ['ISSUED', 'PARTIAL_PAID', 'OVERDUE'].includes(inv.status))
    : invoices;



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

        <h1 className={styles.title}>{t('billing.title')}</h1>

        <p className={styles.subtitle}>{t('billing.subtitle')}</p>

      </header>



      <div className={styles.tabs} role="tablist" aria-label={t('billing.title')}>

        {(['invoices', 'unbilled'] as const).map((key) => (

          <button

            key={key}

            type="button"

            role="tab"

            aria-selected={tab === key}

            className={tab === key ? styles.tabActive : styles.tabBtn}

            onClick={() => setTab(key)}

          >

            {t(`billing.tabs.${key}`)}

          </button>

        ))}

      </div>



      {tab === 'invoices' && (

        <>

          {invoicesQuery.isError && <AuthAlert variant="error">{t('billing.loadError')}</AuthAlert>}

          {invoicesQuery.isLoading ? (

            <p className={styles.hint} aria-busy="true">…</p>

          ) : displayedInvoices.length === 0 ? (

            <p className={styles.empty}>
              {focusOutstanding ? t('billing.invoices.emptyOutstanding') : t('billing.invoices.empty')}
            </p>

          ) : (

            <div className={styles.tableWrap}>

              <table className={styles.table}>

                <caption className={styles.hint}>{t('billing.invoices.caption')}</caption>

                <thead>

                  <tr>

                    <th scope="col">{t('billing.invoices.number')}</th>

                    <th scope="col">{t('billing.invoices.status')}</th>

                    <th scope="col">{t('billing.invoices.total')}</th>

                    <th scope="col">{t('billing.invoices.paid')}</th>

                    <th scope="col">{t('billing.invoices.date')}</th>

                    <th scope="col">{t('billing.invoices.view')}</th>

                  </tr>

                </thead>

                <tbody>

                  {displayedInvoices.map((inv) => (

                    <tr key={inv.invoiceId}>

                      <td>{inv.invoiceNumber}</td>

                      <td>

                        <span className={styles.badge}>

                          {t(`billing.status.${inv.status}` as 'billing.status.draft')}

                        </span>

                      </td>

                      <td>{formatBillingCurrency(inv.amountTotal, locale, inv.currency)}</td>

                      <td>{formatBillingCurrency(inv.amountPaid, locale, inv.currency)}</td>

                      <td>{formatBillingDate(inv.invoiceDate, locale)}</td>

                      <td>

                        <Link to={`/billing/invoices/${inv.invoiceId}`} className={styles.linkBtn}>

                          {t('billing.invoices.view')}

                        </Link>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </>

      )}



      {tab === 'unbilled' && (

        <>

          <p className={styles.hint}>{t('billing.unbilled.hint')}</p>

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



          {selectedPatientId && (

            <UnbilledConsumptionsPanel

              patientId={selectedPatientId}

              canCreate={canCreate}

              onBilled={({ invoiceId }) => navigate(`/billing/invoices/${invoiceId}`)}

            />

          )}

        </>

      )}

    </div>

  );

}


