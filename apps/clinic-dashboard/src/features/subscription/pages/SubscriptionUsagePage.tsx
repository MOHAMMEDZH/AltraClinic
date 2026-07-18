import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { UsageMeter } from '../components/UsageMeter';
import { useSubscriptionUsage } from '../hooks/useSubscription';
import { useSubscriptionEntitlements } from '../hooks/useSubscriptionEntitlements';
import styles from '../subscription-layout.module.css';

export function SubscriptionUsagePage() {
  const { t } = useI18n();
  const usage = useSubscriptionUsage();
  const entitlements = useSubscriptionEntitlements();
  const limits = entitlements.limits;

  if (usage.isLoading) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('subscription.loading')} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('subscription.nav.usage')}</h2>
          <p className={styles.pageSubtitle}>{t('subscription.usage.subtitle')}</p>
        </div>
      </header>

      {usage.isError && <AuthAlert variant="error">{t('subscription.loadError')}</AuthAlert>}

      <section className={styles.panel}>
        <UsageMeter label={t('subscription.usage.users')} current={usage.tenantUsage?.users ?? usage.dashboard?.live.activeUsers ?? 0} max={limits.maxUsers} />
        <UsageMeter
          label={t('subscription.usage.branches')}
          current={usage.tenantUsage?.branches ?? usage.dashboard?.branchPerformance.length ?? 1}
          max={limits.maxBranches}
        />
        <UsageMeter label={t('subscription.usage.patients')} current={usage.tenantUsage?.patients ?? usage.dashboard?.kpis.totalPatients ?? 0} max={limits.maxPatients} />
        <UsageMeter
          label={t('subscription.usage.appointments')}
          current={usage.tenantUsage?.appointmentsThisMonth ?? usage.dashboard?.kpis.appointmentsToday ?? 0}
          max={limits.maxAppointmentsPerMonth}
        />
        <UsageMeter
          label={t('subscription.usage.reports')}
          current={usage.tenantUsage?.reportsThisMonth ?? usage.aiOverview?.activeConversations ?? 0}
          max={limits.maxReportsPerMonth}
        />
        <UsageMeter
          label={t('subscription.usage.apiCalls')}
          current={usage.tenantUsage?.apiCallsToday ?? usage.ai?.messagesToday ?? 0}
          max={limits.maxApiRequestsPerDay}
        />
        <UsageMeter
          label={t('subscription.usage.storage')}
          current={usage.tenantUsage?.storageGb ?? 0}
          max={limits.maxStorageGb}
          unit="GB"
        />
        <UsageMeter label={t('subscription.usage.sms')} current={usage.tenantUsage?.smsThisMonth ?? 0} max={limits.maxApiRequestsPerDay} />
        <UsageMeter label={t('subscription.usage.whatsapp')} current={usage.tenantUsage?.whatsappThisMonth ?? 0} max={limits.maxApiRequestsPerDay} />
        <UsageMeter label={t('subscription.usage.email')} current={usage.tenantUsage?.emailThisMonth ?? 0} max={limits.maxApiRequestsPerDay} />
      </section>
    </div>
  );
}
