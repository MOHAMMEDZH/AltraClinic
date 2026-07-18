import { useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { Modal } from '@/features/patients/components/Modal';
import { lostFeaturesOnDowngrade, type SubscriptionPlanId } from '../config/subscription-config';
import { usePreviewPlanChange } from '../hooks/useSubscription';
import styles from '../subscription-layout.module.css';

interface DowngradeModalProps {
  open: boolean;
  onClose: () => void;
  currentPlanId: SubscriptionPlanId;
  targetPlanId: SubscriptionPlanId;
  loading?: boolean;
  onConfirm: (options: { scheduled: boolean }) => void;
}

export function DowngradeModal({
  open,
  onClose,
  currentPlanId,
  targetPlanId,
  loading = false,
  onConfirm,
}: DowngradeModalProps) {
  const { t } = useI18n();
  const [scheduled, setScheduled] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const previewMutation = usePreviewPlanChange();
  const lostLocal = lostFeaturesOnDowngrade(currentPlanId, targetPlanId);

  useEffect(() => {
    if (open) {
      previewMutation.mutate(targetPlanId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetPlanId]);

  const preview = previewMutation.data;
  const lostFeatureIds = preview?.lostFeatures ?? lostLocal.map((r) => r.id);
  const warnings = preview?.warnings ?? [];

  return (
    <Modal
      open={open}
      title={t('subscription.downgrade.title')}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <AuthButton variant="secondary" onClick={onClose} disabled={loading}>
            {t('subscription.actions.keepPlan')}
          </AuthButton>
          <AuthButton
            variant="danger"
            loading={loading}
            disabled={!confirmed}
            onClick={() => onConfirm({ scheduled })}
          >
            {t('subscription.actions.confirmDowngrade')}
          </AuthButton>
        </>
      }
    >
      <div className={styles.page}>
        <p className={styles.pageSubtitle}>{t('subscription.downgrade.impact')}</p>
        {lostFeatureIds.length > 0 ? (
          <ul className={styles.planList}>
            {lostFeatureIds.map((id) => (
              <li key={id}>{t(`subscription.features.${id}` as 'subscription.features.dashboard')}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.kpiLabel}>{t('subscription.downgrade.noFeatureLoss')}</p>
        )}
        {warnings.length > 0 && (
          <ul className={styles.planList}>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
        <p className={styles.pageSubtitle}>{t('subscription.downgrade.dataPreservation')}</p>
        <label className={styles.kpiLabel}>
          <input type="checkbox" checked={scheduled} onChange={(e) => setScheduled(e.target.checked)} />
          {' '}
          {t('subscription.downgrade.scheduled')}
        </label>
        <label className={styles.kpiLabel} htmlFor="downgrade-confirm">
          <input
            id="downgrade-confirm"
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          {' '}
          {t('subscription.downgrade.confirmLabel')}
        </label>
      </div>
    </Modal>
  );
}
