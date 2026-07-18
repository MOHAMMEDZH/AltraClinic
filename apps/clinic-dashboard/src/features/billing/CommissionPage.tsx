import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { formatBillingCurrency, formatBillingDate, resolveBillingWorkspaceMode } from './config/billing-config';
import { BillingQuickNav } from './components/BillingQuickNav';
import { useApproveCommission, useCommissions, usePayCommission } from './hooks/useCommission';
import styles from './billing-layout.module.css';

export function CommissionPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.commission', action as never), [roles]);
  const workspaceMode = resolveBillingWorkspaceMode(roles);
  const canView = perm('view');
  const canApprove = perm('approve');

  const listQuery = useCommissions(canView);
  const approveMutation = useApproveCommission();
  const payMutation = usePayCommission();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('billing.commission.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('billing.commission.title')}</h1>
          <p className={styles.subtitle}>{t('billing.commission.subtitle')}</p>
        </div>
        <Link to="/billing/commissions/rules">{t('billing.commission.manageRules')}</Link>
      </header>

      <BillingQuickNav mode={workspaceMode} />

      {errorKey && <AuthAlert variant="error">{t('billing.errors.generic')}</AuthAlert>}
      {listQuery.isError && <AuthAlert variant="error">{t('billing.loadError')}</AuthAlert>}

      <section className={styles.panel}>
        {(listQuery.data ?? []).length === 0 ? (
          <p className={styles.hint}>{t('billing.commission.empty')}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('billing.commission.period')}</th>
                <th>{t('billing.commission.revenue')}</th>
                <th>{t('billing.commission.amount')}</th>
                <th>{t('billing.invoices.status')}</th>
                <th>{t('billing.invoices.view')}</th>
              </tr>
            </thead>
            <tbody>
              {(listQuery.data ?? []).map((row) => (
                <tr key={row.commissionId}>
                  <td>{formatBillingDate(row.periodStart, locale)} – {formatBillingDate(row.periodEnd, locale)}</td>
                  <td>{formatBillingCurrency(row.totalRevenue, locale, row.currency)}</td>
                  <td>{formatBillingCurrency(row.commissionAmount, locale, row.currency)}</td>
                  <td>{t(`billing.commission.status.${row.status.status}` as 'billing.commission.status.calculated')}</td>
                  <td>
                    {canApprove && row.status.status === 'calculated' && (
                      <AuthButton
                        variant="secondary"
                        loading={approveMutation.isPending}
                        onClick={() => {
                          setErrorKey(null);
                          void approveMutation.mutateAsync(row.commissionId).catch(() => setErrorKey('generic'));
                        }}
                      >
                        {t('billing.commission.approve')}
                      </AuthButton>
                    )}
                    {canApprove && row.status.status === 'approved' && (
                      <AuthButton
                        loading={payMutation.isPending}
                        onClick={() => {
                          setErrorKey(null);
                          void payMutation.mutateAsync({ commissionId: row.commissionId, paymentMethod: 'bank_transfer' }).catch(() => setErrorKey('generic'));
                        }}
                      >
                        {t('billing.commission.pay')}
                      </AuthButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
