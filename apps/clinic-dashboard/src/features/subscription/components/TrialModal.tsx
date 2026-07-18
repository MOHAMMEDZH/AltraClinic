import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { Modal } from '@/features/patients/components/Modal';
import { getPlanById, type SubscriptionPlanId } from '../config/subscription-config';
import { formatSubscription } from '../lib/subscription-format';
import styles from '../subscription-layout.module.css';

interface TrialModalProps {
  open: boolean;
  onClose: () => void;
  planId: SubscriptionPlanId;
  trialDaysRemaining: number;
  loading?: boolean;
  onStartTrial: () => void;
}

export function TrialModal({
  open,
  onClose,
  planId,
  trialDaysRemaining,
  loading = false,
  onStartTrial,
}: TrialModalProps) {
  const { t } = useI18n();
  const plan = getPlanById(planId);

  return (
    <Modal
      open={open}
      title={t('subscription.trial.title')}
      onClose={onClose}
      footer={
        <>
          <AuthButton variant="secondary" onClick={onClose} disabled={loading}>
            {t('subscription.actions.cancel')}
          </AuthButton>
          <AuthButton loading={loading} onClick={onStartTrial}>
            {t('subscription.trial.start')}
          </AuthButton>
        </>
      }
    >
      <div className={styles.page}>
        <p className={styles.pageSubtitle}>
          {formatSubscription(t, 'subscription.trial.remaining', { days: trialDaysRemaining })}
        </p>
        <p className={styles.kpiValue}>{t(`subscription.plans.${plan.id}`)}</p>
        <ul className={styles.planList}>
          {plan.highlights.slice(0, 5).map((key) => (
            <li key={key}>{t(`subscription.highlights.${key}` as 'subscription.highlights.basicDashboard')}</li>
          ))}
        </ul>
        <p className={styles.kpiLabel}>{t('subscription.trial.expirationHint')}</p>
      </div>
    </Modal>
  );
}
