import { useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import {
  comparePlanTier,
  mapUiPlanToBackend,
  type BillingCycleId,
  type SubscriptionPlanId,
} from '../config/subscription-config';
import { BillingCycleToggle, PlanComparisonGrid } from '../components/PlanComparisonGrid';
import { DowngradeModal } from '../components/DowngradeModal';
import { UpgradeModal } from '../components/UpgradeModal';
import { SavingsCalculator } from '../components/SavingsCalculator';
import { useChangePlatformPlan, useSubscriptionAccess } from '../hooks/useSubscription';
import { useCurrentPlatformTenant } from '../hooks/useCurrentPlatformTenant';
import { useSubscriptionEntitlements } from '../hooks/useSubscriptionEntitlements';
import styles from '../subscription-layout.module.css';

export function SubscriptionPlansPage() {
  const { t } = useI18n();
  const access = useSubscriptionAccess();
  const entitlements = useSubscriptionEntitlements();
  const platformTenant = useCurrentPlatformTenant();
  const changePlan = useChangePlatformPlan();
  const [billingCycle, setBillingCycle] = useState<BillingCycleId>('annual');
  const [targetPlan, setTargetPlan] = useState<SubscriptionPlanId | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [downgradeOpen, setDowngradeOpen] = useState(false);

  const direction = useMemo(
    () => (targetPlan ? comparePlanTier(entitlements.planId, targetPlan) : 'same'),
    [entitlements.planId, targetPlan],
  );

  function handleSelectPlan(planId: SubscriptionPlanId) {
    setTargetPlan(planId);
    const next = comparePlanTier(entitlements.planId, planId);
    if (next === 'upgrade') setUpgradeOpen(true);
    else if (next === 'downgrade') setDowngradeOpen(true);
  }

  const platformTenantId = platformTenant.platformTenantId;

  function applyPlanChange() {
    if (!targetPlan) return;
    if (!access.canManagePlatform && !platformTenantId) return;
    changePlan.mutate(
      {
        platformTenantId: platformTenantId ?? '',
        plan: access.canManagePlatform ? mapUiPlanToBackend(targetPlan) : targetPlan,
      },
      {
        onSettled: () => {
          setUpgradeOpen(false);
          setDowngradeOpen(false);
        },
      },
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('subscription.nav.plans')}</h2>
          <p className={styles.pageSubtitle}>{t('subscription.plans.subtitle')}</p>
        </div>
        <BillingCycleToggle value={billingCycle} onChange={setBillingCycle} />
      </header>

      {changePlan.isError && <AuthAlert variant="error">{t('subscription.actionError')}</AuthAlert>}
      {!platformTenantId && access.canManage && (
        <AuthAlert variant="warning">{t('subscription.plans.noPlatformTenant')}</AuthAlert>
      )}

      <SavingsCalculator
        billingCycle={billingCycle}
        onBillingCycleChange={setBillingCycle}
        highlightPlanId={entitlements.planId}
      />

      <PlanComparisonGrid
        currentPlanId={entitlements.planId}
        billingCycle={billingCycle}
        canUpgrade={access.canManage}
        onSelectPlan={handleSelectPlan}
      />

      {targetPlan && (
        <>
          <UpgradeModal
            open={upgradeOpen && direction === 'upgrade'}
            onClose={() => setUpgradeOpen(false)}
            currentPlanId={entitlements.planId}
            targetPlanId={targetPlan}
            billingCycle={billingCycle}
            loading={changePlan.isPending}
            onConfirm={() => applyPlanChange()}
          />
          <DowngradeModal
            open={downgradeOpen && direction === 'downgrade'}
            onClose={() => setDowngradeOpen(false)}
            currentPlanId={entitlements.planId}
            targetPlanId={targetPlan}
            loading={changePlan.isPending}
            onConfirm={() => applyPlanChange()}
          />
        </>
      )}
    </div>
  );
}
