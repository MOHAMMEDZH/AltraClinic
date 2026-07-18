import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { BILLING_CYCLES, PLAN_CATALOG, annualSavings, priceForCycle, type BillingCycleId } from '../config/subscription-config';
import { formatSubscription } from '../lib/subscription-format';
import styles from '../subscription-layout.module.css';

interface SavingsCalculatorProps {
  billingCycle: BillingCycleId;
  onBillingCycleChange: (cycle: BillingCycleId) => void;
  highlightPlanId?: string;
}

export function SavingsCalculator({ billingCycle, onBillingCycleChange, highlightPlanId }: SavingsCalculatorProps) {
  const { t, locale } = useI18n();
  const formatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
    [locale],
  );

  return (
    <section className={styles.panel} aria-labelledby="savings-calculator-title">
      <div className={styles.toolbar}>
        <div>
          <h3 id="savings-calculator-title" className={styles.panelTitle}>
            {t('subscription.savings.title')}
          </h3>
          <p className={styles.pageSubtitle}>{t('subscription.savings.subtitle')}</p>
        </div>
        <div className={styles.actions} role="group" aria-label={t('subscription.billingCycle.label')}>
          {BILLING_CYCLES.map((cycle) => (
            <button
              key={cycle}
              type="button"
              className={[styles.navLink, billingCycle === cycle ? styles.navLinkActive : ''].filter(Boolean).join(' ')}
              onClick={() => onBillingCycleChange(cycle)}
              aria-pressed={billingCycle === cycle}
            >
              {t(`subscription.billingCycle.${cycle}`)}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.kpiGrid}>
        {PLAN_CATALOG.filter((p) => p.id !== 'enterprise').map((plan) => {
          const monthly = plan.monthlyPrice * 12;
          const annual = priceForCycle(plan, 'annual');
          const savings = annualSavings(plan);
          return (
            <article
              key={plan.id}
              className={[styles.kpiCard, plan.id === highlightPlanId ? styles.planCardCurrent : ''].filter(Boolean).join(' ')}
            >
              <span className={styles.kpiLabel}>{t(`subscription.plans.${plan.id}`)}</span>
              <strong className={styles.kpiValue}>{formatter.format(priceForCycle(plan, billingCycle))}</strong>
              <span className={styles.kpiLabel}>
                {formatSubscription(t, 'subscription.savings.vsMonthly', {
                  amount: formatter.format(Math.max(0, monthly - annual)),
                })}
              </span>
              {savings > 0 && (
                <span className={styles.badgeEnabled}>
                  {formatSubscription(t, 'subscription.annualSavings', { amount: formatter.format(savings) })}
                </span>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
