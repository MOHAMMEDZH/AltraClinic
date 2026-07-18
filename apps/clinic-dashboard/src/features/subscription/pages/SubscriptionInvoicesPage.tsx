import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { useExportInvoices } from '@/features/billing/hooks/useBilling';
import { downloadBillingCsv } from '@/features/billing/utils/billing-export';
import { useSubscriptionInvoices, useDebouncedSearch } from '../hooks/useSubscription';
import { downloadSubscriptionCsv } from '../lib/subscription-export';
import styles from '../subscription-layout.module.css';

export function SubscriptionInvoicesPage() {
  const { t, locale } = useI18n();
  const search = useDebouncedSearch();
  const invoices = useSubscriptionInvoices(true, search.debounced);
  const exportMutation = useExportInvoices();
  const [statusFilter, setStatusFilter] = useState('');
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' });
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  const rows = useMemo(() => {
    const items = invoices.data?.items ?? [];
    if (!statusFilter) return items;
    return items.filter((invoice) => invoice.status.toLowerCase() === statusFilter.toLowerCase());
  }, [invoices.data?.items, statusFilter]);

  if (invoices.isLoading) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('subscription.loading')} />;
  }

  function exportVisible() {
    downloadSubscriptionCsv('subscription-invoices.csv', [
      [
        t('subscription.invoices.number'),
        t('subscription.invoices.date'),
        t('subscription.invoices.amount'),
        t('subscription.invoices.status'),
      ],
      ...rows.map((invoice) => [
        invoice.invoiceNumber,
        invoice.invoiceDate,
        String(invoice.amountTotal),
        invoice.status,
      ]),
    ]);
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('subscription.nav.invoices')}</h2>
          <p className={styles.pageSubtitle}>{t('subscription.invoices.subtitle')}</p>
        </div>
        <div className={styles.actions}>
          <AuthButton variant="secondary" onClick={exportVisible}>
            {t('subscription.actions.export')}
          </AuthButton>
          <AuthButton
            variant="secondary"
            loading={exportMutation.isPending}
            onClick={() =>
              void exportMutation.mutateAsync({}).then(({ csv, filename }) => downloadBillingCsv(filename, csv))
            }
          >
            {t('subscription.actions.exportCsv')}
          </AuthButton>
        </div>
      </header>

      {invoices.isError && <AuthAlert variant="error">{t('subscription.loadError')}</AuthAlert>}

      <div className={styles.toolbar}>
        <input
          className={styles.input}
          type="search"
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          placeholder={t('subscription.invoices.search')}
          aria-label={t('subscription.invoices.search')}
        />
        <select
          className={styles.select}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={t('subscription.invoices.filterStatus')}
        >
          <option value="">{t('subscription.invoices.allStatuses')}</option>
          <option value="paid">paid</option>
          <option value="issued">issued</option>
          <option value="overdue">overdue</option>
          <option value="draft">draft</option>
        </select>
      </div>

      <section className={styles.panel}>
        {rows.length ? (
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>{t('subscription.invoices.number')}</th>
                <th>{t('subscription.invoices.date')}</th>
                <th>{t('subscription.invoices.amount')}</th>
                <th>{t('subscription.invoices.status')}</th>
                <th>{t('subscription.invoices.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((invoice) => (
                <tr key={invoice.invoiceId}>
                  <td>{invoice.invoiceNumber}</td>
                  <td>{dateFormatter.format(new Date(invoice.invoiceDate))}</td>
                  <td>{formatter.format(invoice.amountTotal)}</td>
                  <td>{invoice.status}</td>
                  <td>
                    <Link to={`/billing/invoices/${invoice.invoiceId}`}>{t('subscription.invoices.view')}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.emptyState}>{t('subscription.invoices.empty')}</p>
        )}
      </section>
    </div>
  );
}
