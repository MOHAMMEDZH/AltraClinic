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
import { useStaffCommissionOwnerReport } from './hooks/useStaffCommissionOwnerReport';
import styles from './billing-layout.module.css';

const STATUS_FILTERS = ['', 'calculated', 'approved', 'paid'] as const;

export function CommissionPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.commission', action as never), [roles]);
  const canExportStaff = hasPermission(roles, 'api.staff-commission', 'export');
  const workspaceMode = resolveBillingWorkspaceMode(roles);
  const canView = perm('view');
  const canApprove = perm('approve');

  const [statusFilter, setStatusFilter] = useState<string>('');
  const listQuery = useCommissions(canView, statusFilter ? { status: statusFilter } : undefined);
  const staffReportQuery = useStaffCommissionOwnerReport(90, canExportStaff);
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
    <div className={styles.page} id="billing-commissions-region" data-testid="billing-commissions-region">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('billing.commission.title')}</h1>
          <p className={styles.subtitle}>{t('billing.commission.subtitle')}</p>
        </div>
        <Link to="/billing/commissions/rules">{t('billing.commission.manageRules')}</Link>
      </header>

      <BillingQuickNav mode={workspaceMode} />

      <div className={styles.toolbar}>
        <label>
          <span className={styles.srOnly}>{t('billing.commission.statusFilter')}</span>
          <select
            className={styles.selectInput}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={t('billing.commission.statusFilter')}
            data-testid="commission-status-filter"
          >
            <option value="">{t('billing.commission.allStatuses')}</option>
            {STATUS_FILTERS.filter(Boolean).map((status) => (
              <option key={status} value={status}>
                {t(`billing.commission.status.${status}` as 'billing.commission.status.calculated')}
              </option>
            ))}
          </select>
        </label>
      </div>

      {errorKey && <AuthAlert variant="error">{t('billing.errors.generic')}</AuthAlert>}
      {listQuery.isError && <AuthAlert variant="error">{t('billing.loadError')}</AuthAlert>}

      <section className={styles.panel} data-testid="provider-commissions-list">
        {(listQuery.data ?? []).length === 0 ? (
          <div className={styles.empty} role="status">
            <strong>{t('billing.commission.empty')}</strong>
            <p className={styles.hint}>{t('billing.commission.emptyHint')}</p>
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('billing.commission.providerId')}</th>
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
                    <td>
                      {row.providerId ? (
                        <code
                          className={styles.idCell}
                          dir="ltr"
                          title={row.providerId}
                          aria-label={`${t('billing.commission.providerId')}: ${row.providerId}`}
                        >
                          {row.providerId.slice(0, 8)}…
                        </code>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {formatBillingDate(row.periodStart, locale)} – {formatBillingDate(row.periodEnd, locale)}
                    </td>
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
                            void payMutation
                              .mutateAsync({ commissionId: row.commissionId, paymentMethod: 'bank_transfer' })
                              .catch(() => setErrorKey('generic'));
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
          </div>
        )}
      </section>

      {canExportStaff ? (
        <section
          className={styles.panel}
          aria-labelledby="staff-commission-owner-title"
          data-testid="staff-commission-owner-panel"
        >
          <h2 id="staff-commission-owner-title" className={styles.panelTitle}>
            {t('billing.commission.staffOwnerTitle')}
          </h2>
          <p className={styles.hint}>{t('billing.commission.staffOwnerSubtitle')}</p>
          {staffReportQuery.isError && <AuthAlert variant="error">{t('billing.loadError')}</AuthAlert>}
          {staffReportQuery.isLoading && !staffReportQuery.data ? (
            <p className={styles.hint} aria-busy="true">
              …
            </p>
          ) : staffReportQuery.data && staffReportQuery.data.byCurrency.length === 0 ? (
            <p className={styles.hint}>{t('billing.commission.staffOwnerEmpty')}</p>
          ) : staffReportQuery.data ? (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t('billing.commission.staffCurrency')}</th>
                    <th>{t('billing.commission.staffEarned')}</th>
                    <th>{t('billing.commission.staffSettled')}</th>
                    <th>{t('billing.commission.staffOutstanding')}</th>
                    <th>{t('billing.commission.staffNet')}</th>
                  </tr>
                </thead>
                <tbody>
                  {staffReportQuery.data.byCurrency.map((row) => (
                    <tr key={row.currency}>
                      <td>{row.currency}</td>
                      <td>{row.earned}</td>
                      <td>{row.settled}</td>
                      <td>{row.outstanding}</td>
                      <td>{row.net}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
