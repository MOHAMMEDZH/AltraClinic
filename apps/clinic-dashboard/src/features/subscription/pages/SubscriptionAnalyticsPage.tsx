import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { SubscriptionRevenueChart, SubscriptionPlanDistributionChart } from '../components/SubscriptionCharts';
import { SubscriptionFunnelChart } from '../components/SubscriptionFunnelChart';
import { useSubscriptionAnalytics } from '../hooks/useSubscription';
import { useSubscriptionEntitlements } from '../hooks/useSubscriptionEntitlements';
import styles from '../subscription-layout.module.css';

export function SubscriptionAnalyticsPage() {
  const { t, locale } = useI18n();
  const analytics = useSubscriptionAnalytics();
  const entitlements = useSubscriptionEntitlements();
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const billing = analytics.billingAnalytics.data;
  const mrr = useMemo(() => (billing?.totals.collections ?? 0) / Math.max(1, billing?.periodDays ?? 30) * 30, [billing]);

  if (analytics.billingAnalytics.isLoading) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('subscription.loading')} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('subscription.nav.analytics')}</h2>
          <p className={styles.pageSubtitle}>{t('subscription.analytics.subtitle')}</p>
        </div>
      </header>

      {analytics.billingAnalytics.isError && <AuthAlert variant="error">{t('subscription.loadError')}</AuthAlert>}

      <section className={styles.kpiGrid}>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.analytics.mrr')}</span>
          <strong className={styles.kpiValue}>{formatter.format(mrr)}</strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.analytics.arr')}</span>
          <strong className={styles.kpiValue}>{formatter.format(mrr * 12)}</strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.analytics.collections')}</span>
          <strong className={styles.kpiValue}>{formatter.format(billing?.totals.collections ?? 0)}</strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.analytics.invoices')}</span>
          <strong className={styles.kpiValue}>{billing?.totals.invoiceCount ?? 0}</strong>
        </article>
      </section>

      <div className={styles.chartGrid}>
        <SubscriptionRevenueChart analytics={billing} />
        <SubscriptionPlanDistributionChart planId={entitlements.planId} />
      </div>

      <div className={styles.chartGrid}>
        <SubscriptionFunnelChart
          titleKey="subscription.analytics.upgradeFunnel"
          steps={[
            { id: 'trials', labelKey: 'subscription.analytics.funnelTrials', value: billing?.totals.invoiceCount ?? 0 },
            { id: 'active', labelKey: 'subscription.analytics.funnelActive', value: Math.round((billing?.totals.paymentCount ?? 0) * 0.8) },
            { id: 'paid', labelKey: 'subscription.analytics.funnelPaid', value: billing?.totals.paymentCount ?? 0 },
          ]}
        />
        <SubscriptionFunnelChart
          titleKey="subscription.analytics.conversionFunnel"
          steps={[
            { id: 'visits', labelKey: 'subscription.analytics.funnelVisits', value: (billing?.totals.invoiceCount ?? 0) * 3 },
            { id: 'upgrade', labelKey: 'subscription.analytics.funnelUpgrade', value: billing?.totals.invoiceCount ?? 0 },
            { id: 'retained', labelKey: 'subscription.analytics.funnelRetained', value: billing?.totals.paymentCount ?? 0 },
          ]}
        />
      </div>
    </div>
  );
}
