import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { Modal } from '@/features/patients/components/Modal';
import { PLAN_CATALOG, mapUiPlanToBackend, type SubscriptionPlanId } from '../config/subscription-config';
import styles from '../subscription-layout.module.css';

interface GrantTenantTrialModalProps {
  open: boolean;
  tenantName: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (planId: SubscriptionPlanId, days: number) => void;
}

export function GrantTenantTrialModal({
  open,
  tenantName,
  loading = false,
  onClose,
  onConfirm,
}: GrantTenantTrialModalProps) {
  const { t } = useI18n();
  const [planId, setPlanId] = useState<SubscriptionPlanId>('professional');
  const [days, setDays] = useState('14');

  return (
    <Modal
      open={open}
      title={t('subscription.superAdmin.grantTrial')}
      onClose={onClose}
      footer={
        <>
          <AuthButton variant="secondary" onClick={onClose} disabled={loading}>
            {t('subscription.actions.cancel')}
          </AuthButton>
          <AuthButton loading={loading} onClick={() => onConfirm(planId, Number(days) || 14)}>
            {t('subscription.superAdmin.grantTrialConfirm')}
          </AuthButton>
        </>
      }
    >
      <p className={styles.pageSubtitle}>
        {t('subscription.superAdmin.grantTrialHint')} — <strong>{tenantName}</strong>
      </p>
      <AuthFormField id="trial-plan" label={t('subscription.superAdmin.plan')}>
        <select
          id="trial-plan"
          className={styles.select}
          value={planId}
          onChange={(e) => setPlanId(e.target.value as SubscriptionPlanId)}
        >
          {PLAN_CATALOG.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {t(`subscription.plans.${plan.id}`)} ({mapUiPlanToBackend(plan.id)})
            </option>
          ))}
        </select>
      </AuthFormField>
      <AuthFormField
        id="trial-days"
        label={t('subscription.superAdmin.trialDays')}
        value={days}
        onChange={(e) => setDays(e.target.value)}
        type="number"
        min={1}
        max={90}
      />
    </Modal>
  );
}
