import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { formatBillingCurrency, formatBillingDate } from './config/billing-config';
import { useReceipt } from './hooks/useBilling';
import styles from './ReceiptPrintPage.module.css';

export function ReceiptPrintPage() {
  const { receiptNumber = '' } = useParams<{ receiptNumber: string }>();
  const { t, locale } = useI18n();
  const receiptQuery = useReceipt(receiptNumber, Boolean(receiptNumber));
  const receipt = receiptQuery.data;

  useEffect(() => {
    if (receipt && new URLSearchParams(window.location.search).get('print') === '1') {
      window.print();
    }
  }, [receipt]);

  if (receiptQuery.isLoading) {
    return <div className={styles.page} aria-busy="true">{t('billing.receipt.loading')}</div>;
  }

  if (receiptQuery.isError || !receipt) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('billing.receipt.notFound')}</AuthAlert>
        <Link to="/billing/invoices">{t('billing.detail.back')}</Link>
      </div>
    );
  }

  const invoice = receipt.invoice;

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Link to={`/billing/invoices/${invoice.invoiceId}`}>{t('billing.detail.back')}</Link>
        <AuthButton onClick={() => window.print()}>
          <Printer size={16} aria-hidden />
          {t('billing.receipt.print')}
        </AuthButton>
      </div>

      <article className={styles.receipt}>
        <header className={styles.header}>
          <h1>{t('billing.receipt.title')}</h1>
          <p>{receipt.receiptNumber}</p>
          <p>{formatBillingDate(receipt.issuedAt, locale)}</p>
        </header>

        <section>
          <h2>{t('billing.receipt.invoice')}</h2>
          <p>{invoice.invoiceNumber}</p>
        </section>

        <section>
          <h2>{t('billing.detail.lineItems')}</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('billing.detail.description')}</th>
                <th>{t('billing.detail.lineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((line) => (
                <tr key={line.itemId}>
                  <td>{line.description}</td>
                  <td>{formatBillingCurrency(line.lineTotal, locale, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className={styles.footer}>
          <p>{t('billing.receipt.amountPaid')}: {formatBillingCurrency(receipt.amount, locale, receipt.currency)}</p>
          <p>{t('billing.invoices.total')}: {formatBillingCurrency(invoice.amountTotal, locale, invoice.currency)}</p>
          <p>{t('billing.invoices.due')}: {formatBillingCurrency(invoice.amountDue, locale, invoice.currency)}</p>
        </footer>
      </article>
    </div>
  );
}
