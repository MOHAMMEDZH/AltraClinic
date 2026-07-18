import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  annualSavings,
  BILLING_CYCLES,
  comparePlanTier,
  PLAN_CATALOG,
  priceForCycle,
  type BillingCycleId,
  type SubscriptionPlanId,
} from '../config/subscription-config';
import { formatSubscription } from '../lib/subscription-format';
import styles from '../subscription-layout.module.css';

interface PlanComparisonGridProps {
  currentPlanId: SubscriptionPlanId;
  billingCycle: BillingCycleId;
  onSelectPlan?: (planId: SubscriptionPlanId) => void;
  canUpgrade?: boolean;
}

export function PlanComparisonGrid({
  currentPlanId,
  billingCycle,
  onSelectPlan,
  canUpgrade = false,
}: PlanComparisonGridProps) {
  const { t, locale } = useI18n();
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  return (
    <div className={styles.kpiGrid}>
      {PLAN_CATALOG.map((plan) => {
        const isCurrent = plan.id === currentPlanId;
        const direction = comparePlanTier(currentPlanId, plan.id);
        const price = priceForCycle(plan, billingCycle);
        const savings = annualSavings(plan);

        return (
          <article
            key={plan.id}
            className={[styles.planCard, isCurrent ? styles.planCardCurrent : ''].filter(Boolean).join(' ')}
            aria-current={isCurrent ? 'true' : undefined}
          >
            <div className={styles.toolbar}>
              <h3 className={styles.panelTitle}>{t(`subscription.plans.${plan.id}`)}</h3>
              {isCurrent && <span className={styles.badgeEnabled}>{t('subscription.current')}</span>}
            </div>
            <p className={styles.planPrice}>
              {plan.id === 'enterprise' ? t('subscription.plans.customPricing') : formatter.format(price)}
              {plan.id !== 'enterprise' && (
                <span className={styles.kpiLabel}>
                  {' '}
                  / {t(`subscription.billingCycle.${billingCycle}`)}
                </span>
              )}
            </p>
            {savings > 0 && billingCycle === 'annual' && (
              <p className={styles.kpiLabel}>
                {formatSubscription(t, 'subscription.annualSavings', { amount: formatter.format(savings) })}
              </p>
            )}
            <ul className={styles.planList}>
              {plan.highlights.map((key) => (
                <li key={key}>{t(`subscription.highlights.${key}` as 'subscription.highlights.basicDashboard')}</li>
              ))}
            </ul>
            {canUpgrade && onSelectPlan && direction !== 'same' && (
              <AuthButton
                variant={direction === 'upgrade' ? 'primary' : 'secondary'}
                onClick={() => onSelectPlan(plan.id)}
              >
                {direction === 'upgrade' ? t('subscription.actions.upgrade') : t('subscription.actions.downgrade')}
              </AuthButton>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function BillingCycleToggle({
  value,
  onChange,
}: {
  value: BillingCycleId;
  onChange: (cycle: BillingCycleId) => void;
}) {
  const { t } = useI18n();

  return (
    <div className={styles.actions} role="group" aria-label={t('subscription.billingCycle.label')}>
      {BILLING_CYCLES.map((cycle) => (
        <AuthButton
          key={cycle}
          variant={value === cycle ? 'primary' : 'secondary'}
          onClick={() => onChange(cycle)}
          aria-pressed={value === cycle}
        >
          {t(`subscription.billingCycle.${cycle}`)}
        </AuthButton>
      ))}
    </div>
  );
}
