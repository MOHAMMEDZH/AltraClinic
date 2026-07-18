import { useI18n } from '@booking/i18n/react';
import { hasPermission } from '@booking/permissions';
import { useAuth } from '@/app/providers/AuthProvider';
import { formatCurrency, invoiceStatusLabel } from '../config/beauty-config';
import { useBillingSummary } from '../hooks/useBilling';
import type { BeautyBodyMapState } from '../types/beauty.types';
import styles from './BeautyFinancialPanel.module.css';

interface BeautyFinancialPanelProps {
  patientId: string;
  state: BeautyBodyMapState;
}

export function BeautyFinancialPanel({ patientId, state }: BeautyFinancialPanelProps) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const canBill = hasPermission(user?.roles ?? [], 'api.billing', 'view');
  const { summary, isLoading, isError } = useBillingSummary(canBill ? patientId : undefined);

  const pipeline = state.treatmentPlans
    .filter((p) => p.status === 'active' || p.status === 'approved')
    .reduce((s, p) => s + p.estimatedCost, 0);

  return (
    <section className={styles.panel} aria-label={t('beauty.billing.title')}>
      <h3 className={styles.title}>{t('beauty.billing.title')}</h3>
      <div className={styles.grid}>
        <article className={styles.card}>
          <span className={styles.label}>{t('beauty.billing.pipeline')}</span>
          <strong>{formatCurrency(pipeline, locale)}</strong>
        </article>
        {canBill && summary && (
          <>
            <article className={styles.card}>
              <span className={styles.label}>{t('beauty.billing.invoiced')}</span>
              <strong>{formatCurrency(summary.totalInvoiced, locale)}</strong>
            </article>
            <article className={styles.card}>
              <span className={styles.label}>{t('beauty.billing.paid')}</span>
              <strong className={styles.good}>{formatCurrency(summary.totalPaid, locale)}</strong>
            </article>
            <article className={styles.card}>
              <span className={styles.label}>{t('beauty.billing.outstanding')}</span>
              <strong className={summary.outstanding > 0 ? styles.warn : undefined}>
                {formatCurrency(summary.outstanding, locale)}
              </strong>
            </article>
          </>
        )}
      </div>

      {canBill && summary && summary.invoices.length > 0 && (
        <table className={styles.table}>
          <caption className={styles.srOnly}>{t('beauty.billing.title')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('beauty.billing.invoice')}</th>
              <th scope="col">{t('beauty.billing.status')}</th>
              <th scope="col">{t('beauty.billing.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {summary.invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.invoiceNumber}</td>
                <td>{invoiceStatusLabel(t, inv.status)}</td>
                <td>{formatCurrency(inv.totalAmount, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {isLoading && <p className={styles.hint}>{t('auth.loading')}</p>}
      {canBill && isError && !isLoading && (
        <p className={styles.error} role="alert">
          {t('beauty.billing.loadError')}
        </p>
      )}
      {!canBill && <p className={styles.hint}>{t('beauty.billing.noAccess')}</p>}
    </section>
  );
}
