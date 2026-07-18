import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { useBillingSummary } from '@/features/billing/hooks/useBilling';
import { useDebouncedSearch, useTenantSubscription, useTenantSubscriptionPayments } from '../hooks/useSubscription';
import { formatSubscription } from '../lib/subscription-format';
import styles from '../subscription-layout.module.css';

export function SubscriptionPaymentsPage() {
  const { t, locale } = useI18n();
  const billing = useBillingSummary();
  const tenantSubscription = useTenantSubscription();
  const saasPayments = useTenantSubscriptionPayments();
  const search = useDebouncedSearch();  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' });
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  const filteredPayments = useMemo(() => {
    const q = search.debounced.toLowerCase();
    const rows = billing.data?.recentPayments ?? [];
    if (!q) return rows;
    return rows.filter(
      (payment) =>
        payment.invoiceNumber.toLowerCase().includes(q) ||
        payment.paymentMethod.toLowerCase().includes(q) ||
        payment.paymentId.toLowerCase().includes(q),
    );
  }, [billing.data?.recentPayments, search.debounced]);

  if (billing.isLoading || tenantSubscription.isLoading) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('subscription.loading')} />;
  }

  const summary = billing.data;
  const saasPayment = tenantSubscription.data?.payment;
  const primaryMethodLabel =
    saasPayment?.method === 'manual'
      ? t('subscription.payments.methodManual')
      : saasPayment?.method === 'invoice'
        ? t('subscription.payments.methodInvoice')
        : null;
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('subscription.nav.payments')}</h2>
          <p className={styles.pageSubtitle}>{t('subscription.payments.subtitle')}</p>
        </div>
      </header>

      {billing.isError && <AuthAlert variant="error">{t('subscription.loadError')}</AuthAlert>}

      <section className={styles.kpiGrid}>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.payments.method')}</span>
          <strong className={styles.kpiValue}>
            {primaryMethodLabel ?? t('subscription.payments.notConfigured')}
          </strong>
          {saasPayment?.reference && (
            <span className={styles.pageSubtitle}>{saasPayment.reference}</span>
          )}
        </article>        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.payments.collectionsToday')}</span>
          <strong className={styles.kpiValue}>{formatter.format(summary?.collectionsToday ?? 0)}</strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.payments.balance')}</span>
          <strong className={styles.kpiValue}>{formatter.format(summary?.outstandingAmount ?? 0)}</strong>
        </article>
      </section>

      <div className={styles.toolbar}>
        <input
          className={styles.input}
          type="search"
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          placeholder={t('subscription.payments.search')}
          aria-label={t('subscription.payments.search')}
        />
      </div>

      <section className={styles.panel}>
        <h3 className={styles.sectionTitle}>{t('subscription.payments.saasHistory')}</h3>
        {(saasPayments.data ?? []).length ? (
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>{t('subscription.payments.date')}</th>
                <th>{t('subscription.payments.amount')}</th>
                <th>{t('subscription.payments.status')}</th>
                <th>{t('subscription.payments.method')}</th>
              </tr>
            </thead>
            <tbody>
              {(saasPayments.data ?? []).map((payment) => (
                <tr key={payment.subscriptionId}>
                  <td>{dateFormatter.format(new Date(payment.paidAt ?? payment.startDate))}</td>
                  <td>{formatter.format(payment.amount)}</td>
                  <td>{payment.status}</td>
                  <td>{payment.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.emptyState}>{t('subscription.payments.saasEmpty')}</p>
        )}
      </section>

      <section className={styles.panel}>
        <h3 className={styles.sectionTitle}>{t('subscription.payments.history')}</h3>        {filteredPayments.length ? (
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>{t('subscription.payments.date')}</th>
                <th>{t('subscription.payments.amount')}</th>
                <th>{t('subscription.payments.status')}</th>
                <th>{t('subscription.payments.receipt')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr key={payment.paymentId}>
                  <td>{dateFormatter.format(new Date(payment.paymentDate))}</td>
                  <td>{formatter.format(payment.amount)}</td>
                  <td>{t('subscription.payments.paid')}</td>
                  <td>
                    <Link to={`/billing/invoices/${payment.invoiceId}`}>{payment.invoiceNumber}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.emptyState}>{t('subscription.payments.empty')}</p>
        )}
      </section>

      {(summary?.overdueCount ?? 0) > 0 && (
        <section className={styles.panel}>
          <h3 className={styles.sectionTitle}>{t('subscription.payments.failed')}</h3>
          <p className={styles.pageSubtitle}>
            {formatSubscription(t, 'subscription.payments.overdueCount', { count: summary?.overdueCount ?? 0 })}
          </p>
        </section>
      )}
    </div>
  );
}
