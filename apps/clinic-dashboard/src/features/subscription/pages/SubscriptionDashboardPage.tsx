import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { annualSavings, getPlanById } from '../config/subscription-config';
import { CancelSubscriptionModal } from '../components/CancelSubscriptionModal';
import { FeatureUsagePanel } from '../components/FeatureUsagePanel';
import { ReactivateSubscriptionModal } from '../components/ReactivateSubscriptionModal';
import { SubscriptionAlertsPanel } from '../components/SubscriptionAlertsPanel';
import { TrialModal } from '../components/TrialModal';
import { UsageMeter } from '../components/UsageMeter';
import {
  useActivatePlatformTenant,
  useCancelSubscription,
  useChangePlatformPlan,
  useResumePlatformTenant,
  useSubscriptionAccess,
  useSubscriptionRecords,
  useSubscriptionUsage,
} from '../hooks/useSubscription';
import { useCurrentPlatformTenant } from '../hooks/useCurrentPlatformTenant';
import { mapUiPlanToBackend } from '../config/subscription-config';
import { useSubscriptionEntitlements } from '../hooks/useSubscriptionEntitlements';
import styles from '../subscription-layout.module.css';

export function SubscriptionDashboardPage() {
  const { t, locale } = useI18n();
  const online = useOnlineStatus();
  const access = useSubscriptionAccess();
  const entitlements = useSubscriptionEntitlements();
  const usage = useSubscriptionUsage();
  const records = useSubscriptionRecords(access.canView);
  const platformTenant = useCurrentPlatformTenant();
  const changePlan = useChangePlatformPlan();
  const activateTenant = useActivatePlatformTenant();
  const resumeTenant = useResumePlatformTenant();
  const cancelMutation = useCancelSubscription();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [trialOpen, setTrialOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);

  const formatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
    [locale],
  );
  const sub = entitlements.subscription;
  const plan = getPlanById(entitlements.planId);
  const currentRecord = records.data?.[0] ?? null;
  const savings = annualSavings(plan);

  if (usage.isLoading && !usage.dashboard) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('subscription.loading')} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('subscription.nav.dashboard')}</h2>
          <p className={styles.pageSubtitle}>{t('subscription.dashboard.subtitle')}</p>
        </div>
        <div className={styles.actions}>
          <AuthButton variant="secondary" disabled={usage.isLoading} onClick={() => usage.refetch()}>
            <RefreshCw size={16} aria-hidden />
            {t('subscription.actions.refresh')}
          </AuthButton>
          {access.canCreate && platformTenant.platformTenantId && (
            <AuthButton onClick={() => setTrialOpen(true)}>{t('subscription.actions.startTrial')}</AuthButton>
          )}
          <Link className={styles.navLink} to="/settings/subscription/plans">
            {t('subscription.actions.comparePlans')}
          </Link>
        </div>
      </header>

      {!online && <AuthAlert variant="warning">{t('auth.offline')}</AuthAlert>}
      {usage.isError && <AuthAlert variant="error">{t('subscription.loadError')}</AuthAlert>}

      <SubscriptionAlertsPanel />

      <section className={styles.kpiGrid} aria-label={t('subscription.snapshot')}>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.currentPlan')}</span>
          <strong className={styles.kpiValue}>{t(`subscription.plans.${entitlements.planId}`)}</strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.status')}</span>
          <strong className={styles.kpiValue}>{sub?.status ?? currentRecord?.status ?? 'ACTIVE'}</strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.billingCycle.label')}</span>
          <strong className={styles.kpiValue}>{t('subscription.billingCycle.annual')}</strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.renewalDate')}</span>
          <strong className={styles.kpiValue}>{sub?.endDate?.slice(0, 10) ?? '—'}</strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.trial.remainingLabel')}</span>
          <strong className={styles.kpiValue}>{entitlements.trialDaysRemaining || '—'}</strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.grace.remainingLabel')}</span>
          <strong className={styles.kpiValue}>{entitlements.graceDaysRemaining || '—'}</strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.monthlyCost')}</span>
          <strong className={styles.kpiValue}>
            {formatter.format(sub?.pricePerMonth ?? plan.monthlyPrice)} {sub?.currency ?? plan.currency}
          </strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.annualSavingsLabel')}</span>
          <strong className={styles.kpiValue}>{savings > 0 ? formatter.format(savings) : '—'}</strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.paymentStatus')}</span>
          <strong className={styles.kpiValue}>
            {(usage.billing?.outstandingAmount ?? 0) > 0 ? t('subscription.paymentDue') : t('subscription.paymentCurrent')}
          </strong>
        </article>
      </section>

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>{t('subscription.usage.title')}</h3>
        <UsageMeter
          label={t('subscription.usage.users')}
          current={usage.tenantUsage?.users ?? usage.dashboard?.live.activeUsers ?? 0}
          max={entitlements.limits.maxUsers}
        />
        <UsageMeter
          label={t('subscription.usage.branches')}
          current={usage.tenantUsage?.branches ?? usage.dashboard?.branchPerformance.length ?? 1}
          max={entitlements.limits.maxBranches}
        />
        <UsageMeter
          label={t('subscription.usage.aiMessages')}
          current={usage.ai?.messagesToday ?? 0}
          max={usage.ai?.limits.maxMessagesPerUserPerDay ?? 0}
        />
        <UsageMeter
          label={t('subscription.usage.aiTokens')}
          current={usage.ai?.tokensTodayTenant ?? 0}
          max={usage.ai?.limits.maxTokensPerTenantPerDay ?? 0}
        />
        <UsageMeter
          label={t('subscription.usage.storage')}
          current={usage.tenantUsage?.storageGb ?? 0}
          max={entitlements.limits.maxStorageGb}
          unit="GB"
        />
        <UsageMeter
          label={t('subscription.usage.apiCalls')}
          current={usage.tenantUsage?.apiCallsToday ?? usage.ai?.messagesToday ?? 0}
          max={entitlements.limits.maxApiRequestsPerDay}
        />
      </section>

      <FeatureUsagePanel planId={entitlements.planId} />

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>{t('subscription.invoiceSummary')}</h3>
        <div className={styles.kpiGrid}>
          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>{t('subscription.usage.outstanding')}</span>
            <strong className={styles.kpiValue}>{formatter.format(usage.billing?.outstandingAmount ?? 0)}</strong>
          </article>
          <article className={styles.kpiCard}>
            <span className={styles.kpiLabel}>{t('subscription.usage.overdue')}</span>
            <strong className={styles.kpiValue}>{usage.billing?.overdueCount ?? 0}</strong>
          </article>
        </div>
        <Link to="/settings/subscription/invoices">{t('subscription.actions.viewInvoices')}</Link>
      </section>

      {access.canCancel && currentRecord && (
        <div className={styles.actions}>
          {(sub?.status === 'SUSPENDED' || sub?.status === 'CANCELLED') && (
            <AuthButton onClick={() => setReactivateOpen(true)}>{t('subscription.reactivate.cta')}</AuthButton>
          )}
          <AuthButton variant="danger" onClick={() => setCancelOpen(true)}>
            {t('subscription.actions.cancel')}
          </AuthButton>
        </div>
      )}

      <CancelSubscriptionModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        loading={cancelMutation.isPending}
        onConfirm={() => {
          if (currentRecord) {
            cancelMutation.mutate(currentRecord.subscriptionId, {
              onSuccess: () => setCancelOpen(false),
            });
          }
        }}
      />

      <TrialModal
        open={trialOpen}
        onClose={() => setTrialOpen(false)}
        planId="professional"
        trialDaysRemaining={14}
        loading={changePlan.isPending || activateTenant.isPending}
        onStartTrial={() => {
          const id = platformTenant.platformTenantId;
          if (!id) return;
          activateTenant.mutate(id, {
            onSuccess: () =>
              changePlan.mutate(
                { platformTenantId: id, plan: mapUiPlanToBackend('professional') },
                { onSuccess: () => setTrialOpen(false) },
              ),
          });
        }}
      />

      <ReactivateSubscriptionModal
        open={reactivateOpen}
        onClose={() => setReactivateOpen(false)}
        loading={resumeTenant.isPending}
        onConfirm={() => {
          const id = platformTenant.platformTenantId;
          if (!id) return;
          resumeTenant.mutate(id, { onSuccess: () => setReactivateOpen(false) });
        }}
      />
    </div>
  );
}
