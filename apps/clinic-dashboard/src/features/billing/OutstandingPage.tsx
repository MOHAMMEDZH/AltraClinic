import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import {
  canViewBilling,
  formatBillingCurrency,
  invoiceIsOutstanding,
  resolveBillingWorkspaceMode,
} from './config/billing-config';
import { useBillingSummary, useInvoices } from './hooks/useBilling';
import { BillingQuickNav } from './components/BillingQuickNav';
import { VirtualizedInvoiceGrid } from './components/VirtualizedInvoiceGrid';
import styles from './billing-layout.module.css';

export function OutstandingPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.billing', action as never), [roles]);
  const workspaceMode = resolveBillingWorkspaceMode(roles);

  const canView = canViewBilling(perm);
  const summaryQuery = useBillingSummary(canView);
  const invoicesQuery = useInvoices({ enabled: canView });

  const outstanding = useMemo(
    () => (invoicesQuery.data ?? []).filter((inv) => invoiceIsOutstanding(inv.status)),
    [invoicesQuery.data],
  );

  const summary = summaryQuery.data;

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
          <h1 className={styles.title}>{t('billing.outstanding.title')}</h1>
          <p className={styles.subtitle}>{t('billing.outstanding.subtitle')}</p>
        </div>
      </header>

      <BillingQuickNav mode={workspaceMode} />

      {(summaryQuery.isError || invoicesQuery.isError) && (
        <AuthAlert variant="error">{t('billing.loadError')}</AuthAlert>
      )}

      {summary && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.dashboard.agingTitle')}</h2>
          <div className={styles.agingGrid}>
            {(
              [
                ['current', summary.aging.current],
                ['days1to30', summary.aging.days1to30],
                ['days31to60', summary.aging.days31to60],
                ['days61to90', summary.aging.days61to90],
                ['over90', summary.aging.over90],
              ] as const
            ).map(([key, amount]) => (
              <button
                key={key}
                type="button"
                className={styles.agingCard}
                onClick={() => navigate(`/billing/invoices?status=issued`)}
              >
                <span>{t(`billing.aging.${key}` as 'billing.aging.current')}</span>
                <strong>{formatBillingCurrency(amount, locale)}</strong>
              </button>
            ))}
          </div>
          <p className={styles.hint}>
            {t('billing.outstanding.total')}: {formatBillingCurrency(summary.outstandingAmount, locale)} ·{' '}
            {summary.outstandingCount} {t('billing.outstanding.invoices')}
          </p>
        </section>
      )}

      <VirtualizedInvoiceGrid invoices={outstanding} loading={invoicesQuery.isLoading} />
    </div>
  );
}
