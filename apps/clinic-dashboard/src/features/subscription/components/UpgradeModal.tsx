import { useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { Modal } from '@/features/patients/components/Modal';
import {
  annualSavings,
  comparePlanTier,
  getPlanById,
  mapUiPlanToBackend,
  priceForCycle,
  type BillingCycleId,
  type SubscriptionPlanId,
} from '../config/subscription-config';
import { formatSubscription } from '../lib/subscription-format';
import { estimateProration } from '../lib/subscription-proration';
import styles from '../subscription-layout.module.css';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  currentPlanId: SubscriptionPlanId;
  targetPlanId: SubscriptionPlanId;
  billingCycle: BillingCycleId;
  loading?: boolean;
  onConfirm: (options: { immediate: boolean; billingCycle: BillingCycleId }) => void;
}

export function UpgradeModal({
  open,
  onClose,
  currentPlanId,
  targetPlanId,
  billingCycle,
  loading = false,
  onConfirm,
}: UpgradeModalProps) {
  const { t, locale } = useI18n();
  const [immediate, setImmediate] = useState(true);
  const formatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
    [locale],
  );
  const current = getPlanById(currentPlanId);
  const target = getPlanById(targetPlanId);
  const direction = comparePlanTier(currentPlanId, targetPlanId);
  const price = priceForCycle(target, billingCycle);
  const savings = annualSavings(target);
  const proration = estimateProration(currentPlanId, targetPlanId, billingCycle);

  return (
    <Modal
      open={open}
      title={direction === 'upgrade' ? t('subscription.upgrade.title') : t('subscription.downgrade.title')}
      onClose={onClose}
      footer={
        <>
          <AuthButton variant="secondary" onClick={onClose} disabled={loading}>
            {t('subscription.actions.cancel')}
          </AuthButton>
          <AuthButton
            loading={loading}
            onClick={() => onConfirm({ immediate, billingCycle })}
          >
            {direction === 'upgrade' ? t('subscription.actions.confirmUpgrade') : t('subscription.actions.confirmDowngrade')}
          </AuthButton>
        </>
      }
    >
      <div className={styles.page}>
        <p className={styles.pageSubtitle}>{t('subscription.upgrade.summary')}</p>
        <dl className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <dt className={styles.kpiLabel}>{t('subscription.currentPlan')}</dt>
            <dd className={styles.kpiValue}>{t(`subscription.plans.${current.id}`)}</dd>
          </div>
          <div className={styles.kpiCard}>
            <dt className={styles.kpiLabel}>{t('subscription.upgrade.newPlan')}</dt>
            <dd className={styles.kpiValue}>{t(`subscription.plans.${target.id}`)}</dd>
          </div>
          <div className={styles.kpiCard}>
            <dt className={styles.kpiLabel}>{t('subscription.monthlyCost')}</dt>
            <dd className={styles.kpiValue}>
              {target.id === 'enterprise' ? t('subscription.plans.customPricing') : formatter.format(price)}
            </dd>
          </div>
          {savings > 0 && billingCycle === 'annual' && (
            <div className={styles.kpiCard}>
              <dt className={styles.kpiLabel}>{t('subscription.annualSavingsLabel')}</dt>
              <dd className={styles.kpiValue}>{formatter.format(savings)}</dd>
            </div>
          )}
        </dl>
        <label className={styles.kpiLabel}>
          <input type="checkbox" checked={immediate} onChange={(e) => setImmediate(e.target.checked)} />
          {' '}
          {t('subscription.upgrade.immediate')}
        </label>
        {!immediate && <p className={styles.kpiLabel}>{t('subscription.upgrade.scheduledHint')}</p>}
        <p className={styles.kpiLabel}>
          {formatSubscription(t, 'subscription.upgrade.prorationPreview', { amount: formatter.format(proration) })}
        </p>
        <p className={styles.kpiLabel}>{t('subscription.upgrade.prorationHint')}</p>
        <input type="hidden" value={mapUiPlanToBackend(targetPlanId)} readOnly aria-hidden />
      </div>
    </Modal>
  );
}
