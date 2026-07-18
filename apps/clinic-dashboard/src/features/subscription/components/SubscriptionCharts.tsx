import { useMemo } from 'react';
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
import { useI18n } from '@booking/i18n/react';
import type { BillingAnalytics } from '@/features/billing/types/billing.types';
import { PLAN_CATALOG } from '../config/subscription-config';
import styles from '../subscription-layout.module.css';

const PIE_COLORS = [
  'var(--color-primary-500)',
  'var(--color-accent)',
  'var(--color-warning)',
  'var(--color-success)',
];

interface SubscriptionChartsProps {
  analytics?: BillingAnalytics;
  planId?: string;
}

export function SubscriptionRevenueChart({ analytics }: { analytics?: BillingAnalytics }) {
  const { t, locale } = useI18n();
  const data = useMemo(
    () =>
      (analytics?.byDay ?? []).slice(-30).map((row) => ({
        date: row.date.slice(5),
        collections: row.collections,
        invoiced: row.invoiced,
      })),
    [analytics?.byDay],
  );

  if (!data.length) {
    return <p className={styles.empty}>{t('subscription.analytics.noData')}</p>;
  }

  return (
    <section className={styles.panel} aria-label={t('subscription.analytics.revenueTrend')}>
      <h3 className={styles.panelTitle}>{t('subscription.analytics.revenueTrend')}</h3>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value) => [
                new Intl.NumberFormat(locale).format(Number(value ?? 0)),
                '',
              ]}
            />
            <Bar dataKey="collections" fill="var(--color-primary-500)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="invoiced" fill="var(--color-accent)" radius={[4, 4, 0, 0]} opacity={0.75} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function SubscriptionPlanDistributionChart({ planId }: { planId?: string }) {
  const { t } = useI18n();
  const data = useMemo(
    () =>
      PLAN_CATALOG.map((plan) => ({
        name: t(`subscription.plans.${plan.id}`),
        value: plan.id === planId ? 1 : 0.25,
        id: plan.id,
      })),
    [planId, t],
  );

  return (
    <section className={styles.panel} aria-label={t('subscription.analytics.planDistribution')}>
      <h3 className={styles.panelTitle}>{t('subscription.analytics.planDistribution')}</h3>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell key={entry.id} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <table className={styles.srOnly}>
        <caption>{t('subscription.analytics.planDistribution')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('subscription.table.plan')}</th>
            <th scope="col">{t('subscription.analytics.weight')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function SubscriptionCharts({ analytics, planId }: SubscriptionChartsProps) {
  return (
    <>
      <SubscriptionRevenueChart analytics={analytics} />
      <SubscriptionPlanDistributionChart planId={planId} />
    </>
  );
}
