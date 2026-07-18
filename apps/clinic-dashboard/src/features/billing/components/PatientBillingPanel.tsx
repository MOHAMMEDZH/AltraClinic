import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { formatBillingCurrency, formatBillingDate } from '../config/billing-config';
import { useInvoices } from '../hooks/useBilling';
import { UnbilledConsumptionsPanel } from './UnbilledConsumptionsPanel';
import styles from './PatientBillingPanel.module.css';

interface PatientBillingPanelProps {
  patientId: string;
  canCreate: boolean;
}

export function PatientBillingPanel({ patientId, canCreate }: PatientBillingPanelProps) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const invoicesQuery = useInvoices({ patientId });
  const invoices = invoicesQuery.data ?? [];

  return (
    <div className={styles.panel}>
      <section>
        <h2 className={styles.sectionTitle}>{t('billing.patient.invoices')}</h2>
        {invoicesQuery.isError && <AuthAlert variant="error">{t('billing.loadError')}</AuthAlert>}
        {invoicesQuery.isLoading ? (
          <p className={styles.empty} aria-busy="true">…</p>
        ) : invoices.length === 0 ? (
          <p className={styles.empty}>{t('billing.patient.noInvoices')}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.empty}>{t('billing.invoices.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('billing.invoices.number')}</th>
                  <th scope="col">{t('billing.invoices.status')}</th>
                  <th scope="col">{t('billing.invoices.total')}</th>
                  <th scope="col">{t('billing.invoices.date')}</th>
                  <th scope="col">{t('billing.invoices.view')}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.invoiceId}>
                    <td>{inv.invoiceNumber}</td>
                    <td>
                      <span className={styles.badge}>
                        {t(`billing.status.${inv.status}` as 'billing.status.draft')}
                      </span>
                    </td>
                    <td>{formatBillingCurrency(inv.amountTotal, locale, inv.currency)}</td>
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
        <div className={styles.actions}>
          <AuthButton variant="secondary" onClick={() => navigate('/billing')}>
            {t('billing.patient.openBilling')}
          </AuthButton>
        </div>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>{t('billing.tabs.unbilled')}</h2>
        <UnbilledConsumptionsPanel
          patientId={patientId}
          canCreate={canCreate}
          onBilled={({ invoiceId }) => navigate(`/billing/invoices/${invoiceId}`)}
        />
      </section>
    </div>
  );
}
