import { useCallback, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canCreateBilling,
  canViewBilling,
  formatBillingCurrency,
  formatBillingDate,
  isFinanceWorkspace,
  resolveBillingWorkspaceMode,
} from './config/billing-config';
import { useBillingAnalytics, useBillingSummary } from './hooks/useBilling';
import { BillingMetrics } from './components/BillingMetrics';
import { BillingQuickNav } from './components/BillingQuickNav';
import styles from './billing-layout.module.css';

export function BillingDashboardPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.billing', action as never), [roles]);
  const workspaceMode = resolveBillingWorkspaceMode(roles);

  const canView = canViewBilling(perm);
  const canCreate = canCreateBilling(perm);
  const summaryQuery = useBillingSummary(canView);
  const analyticsQuery = useBillingAnalytics(30, canView);

  const summary = summaryQuery.data;
  const analytics = analyticsQuery.data;
  const refreshing = summaryQuery.isFetching || analyticsQuery.isFetching;

  const chartData = useMemo(
    () =>
      (analytics?.byDay ?? []).map((row) => ({
        date: row.date.slice(5),
        collections: row.collections,
        invoiced: row.invoiced,
      })),
    [analytics],
  );

  useEffect(() => {
    if (searchParams.get('focus') === 'outstanding') {
      navigate('/billing/outstanding', { replace: true });
    }
    const patientId = searchParams.get('patientId');
    if (patientId) {
      navigate(`/billing/invoices?patientId=${encodeURIComponent(patientId)}`, { replace: true });
    }
  }, [searchParams, navigate]);

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('billing.accessDenied')}</AuthAlert>
      </div>
    );
  }

  const loading = (summaryQuery.isLoading || analyticsQuery.isLoading) && !summary && !analytics;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('billing.dashboard.title')}</h1>
          <p className={styles.subtitle}>{t('billing.dashboard.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <AuthButton
            variant="secondary"
            disabled={refreshing}
            onClick={() => {
              void summaryQuery.refetch();
              void analyticsQuery.refetch();
            }}
          >
            <RefreshCw size={16} aria-hidden className={refreshing ? styles.spin : undefined} />
            {t('billing.refresh')}
          </AuthButton>
          {canCreate && (
            <AuthButton onClick={() => navigate('/billing/invoices/new')}>{t('billing.nav.create')}</AuthButton>
          )}
        </div>
      </header>

      {isFinanceWorkspace(workspaceMode) && (
        <p className={styles.workspaceBanner}>{t('billing.dashboard.financeBanner')}</p>
      )}
      {workspaceMode === 'reception' && (
        <p className={styles.workspaceBanner}>{t('billing.dashboard.receptionBanner')}</p>
      )}

      <BillingQuickNav mode={workspaceMode} canCreate={canCreate} />

      {!online && <AuthAlert variant="warning">{t('auth.offline')}</AuthAlert>}
      {(summaryQuery.isError || analyticsQuery.isError) && online && (
        <AuthAlert variant="error">{t('billing.loadError')}</AuthAlert>
      )}

      {loading ? (
        <div className={styles.skeleton} aria-busy="true" aria-label={t('billing.dashboard.loading')} />
      ) : (
        <>
          <BillingMetrics
            summary={summary}
            onOutstandingClick={() => navigate('/billing/outstanding')}
            onDraftClick={() => navigate('/billing/invoices?status=draft')}
            onOverdueClick={() => navigate('/billing/invoices?status=overdue')}
          />

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
                  <article key={key} className={styles.agingCard}>
                    <span>{t(`billing.aging.${key}` as 'billing.aging.current')}</span>
                    <strong>{formatBillingCurrency(amount, locale)}</strong>
                  </article>
                ))}
              </div>
            </section>
          )}

          {chartData.length > 0 && (
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('billing.dashboard.collectionsChart')}</h2>
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => [
                        formatBillingCurrency(Number(value ?? 0), locale),
                        '',
                      ]}
                    />
                    <Bar dataKey="collections" fill="var(--color-primary-500)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="invoiced" fill="var(--color-accent)" radius={[4, 4, 0, 0]} opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {summary && summary.recentPayments.length > 0 && (
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('billing.dashboard.recentPayments')}</h2>
              <ul className={styles.recentList}>
                {summary.recentPayments.map((payment) => (
                  <li key={payment.paymentId} className={styles.recentItem}>
                    <div>
                      <Link to={`/billing/invoices/${payment.invoiceId}`}>{payment.invoiceNumber}</Link>
                      <span className={styles.hint}>
                        {' · '}
                        {t(`billing.paymentMethods.${payment.paymentMethod}` as 'billing.paymentMethods.cash')}
                        {' · '}
                        {formatBillingDate(payment.paymentDate, locale)}
                      </span>
                    </div>
                    <strong>{formatBillingCurrency(payment.amount, locale, payment.currency)}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
