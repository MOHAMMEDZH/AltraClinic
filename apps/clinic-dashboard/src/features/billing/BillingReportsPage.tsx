import { useCallback, useMemo, useState } from 'react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canExportBilling,
  canViewBilling,
  formatBillingCurrency,
  resolveBillingWorkspaceMode,
} from './config/billing-config';
import { useBillingAnalytics, useExportInvoices } from './hooks/useBilling';
import { BillingQuickNav } from './components/BillingQuickNav';
import { downloadBillingCsv } from './utils/billing-export';
import styles from './billing-layout.module.css';

const PIE_COLORS = [
  'var(--color-primary-500)',
  'var(--color-accent)',
  'var(--color-warning)',
  'var(--color-success)',
  'var(--color-danger)',
  'var(--color-text-secondary)',
];

export function BillingReportsPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.billing', action as never), [roles]);
  const workspaceMode = resolveBillingWorkspaceMode(roles);

  const [days, setDays] = useState(30);
  const canView = canViewBilling(perm);
  const canExport = canExportBilling(perm);
  const analyticsQuery = useBillingAnalytics(days, canView);
  const exportMutation = useExportInvoices();

  const analytics = analyticsQuery.data;

  const methodChart = useMemo(
    () =>
      (analytics?.byPaymentMethod ?? []).map((row) => ({
        name: t(`billing.paymentMethods.${row.method}` as 'billing.paymentMethods.cash'),
        value: row.amount,
      })),
    [analytics, t],
  );

  const statusChart = useMemo(
    () =>
      (analytics?.byStatus ?? [])
        .filter((row) => row.status !== 'CANCELLED' && row.status !== 'DRAFT')
        .map((row) => {
          const key = String(row.status).toLowerCase();
          return {
            name: t(`billing.status.${key}` as 'billing.status.draft'),
            count: row.count,
          };
        }),
    [analytics, t],
  );

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
          <h1 className={styles.title}>{t('billing.reports.title')}</h1>
          <p className={styles.subtitle}>{t('billing.reports.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <select
            className={styles.selectInput}
            value={days}
            aria-label={t('billing.reports.period')}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>{t('billing.reports.days7')}</option>
            <option value={30}>{t('billing.reports.days30')}</option>
            <option value={90}>{t('billing.reports.days90')}</option>
          </select>
          {canExport && (
            <AuthButton
              variant="secondary"
              loading={exportMutation.isPending}
              onClick={() => {
                void exportMutation.mutateAsync({}).then(({ csv, filename }) => downloadBillingCsv(filename, csv));
              }}
            >
              {t('billing.export.csv')}
            </AuthButton>
          )}
        </div>
      </header>

      <BillingQuickNav mode={workspaceMode} />

      {analyticsQuery.isError && <AuthAlert variant="error">{t('billing.loadError')}</AuthAlert>}

      {analytics && (
        <>
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>{t('billing.reports.totals')}</h2>
            <div className={styles.agingGrid}>
              <article className={styles.agingCard}>
                <span>{t('billing.reports.totalCollections')}</span>
                <strong>{formatBillingCurrency(analytics.totals.collections, locale)}</strong>
              </article>
              <article className={styles.agingCard}>
                <span>{t('billing.reports.totalInvoiced')}</span>
                <strong>{formatBillingCurrency(analytics.totals.invoiced, locale)}</strong>
              </article>
              <article className={styles.agingCard}>
                <span>{t('billing.reports.paymentCount')}</span>
                <strong>{analytics.totals.paymentCount}</strong>
              </article>
              <article className={styles.agingCard}>
                <span>{t('billing.reports.invoiceCount')}</span>
                <strong>{analytics.totals.invoiceCount}</strong>
              </article>
            </div>
          </section>

          {methodChart.length > 0 && (
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('billing.reports.byMethod')}</h2>
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={methodChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {methodChart.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatBillingCurrency(Number(value ?? 0), locale)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {statusChart.length > 0 && (
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{t('billing.reports.byStatus')}</h2>
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={statusChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--color-primary-500)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
