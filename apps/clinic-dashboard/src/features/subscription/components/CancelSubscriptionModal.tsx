import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { Modal } from '@/features/patients/components/Modal';
import styles from '../subscription-layout.module.css';

const CANCEL_REASONS = ['tooExpensive', 'missingFeatures', 'switchingProvider', 'temporaryPause', 'other'] as const;

interface CancelSubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  loading?: boolean;
  onConfirm: (options: {
    reason: string;
    cancelAtRenewal: boolean;
    pauseInstead: boolean;
  }) => void;
}

export function CancelSubscriptionModal({ open, onClose, loading = false, onConfirm }: CancelSubscriptionModalProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  const [cancelAtRenewal, setCancelAtRenewal] = useState(true);
  const [pauseInstead, setPauseInstead] = useState(false);
  const [notes, setNotes] = useState('');

  return (
    <Modal
      open={open}
      title={t('subscription.cancel.title')}
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
            onClick={() =>
              onConfirm({
                reason: notes.trim() ? `${reason}: ${notes}` : reason,
                cancelAtRenewal,
                pauseInstead,
              })
            }
          >
            {pauseInstead ? t('subscription.cancel.pause') : t('subscription.cancel.confirm')}
          </AuthButton>
        </>
      }
    >
      <div className={styles.page}>
        <p className={styles.pageSubtitle}>{t('subscription.cancel.retentionOffer')}</p>
        <AuthFormField id="cancel-reason" label={t('subscription.cancel.reason')}>
          <select
            id="cancel-reason"
            className={styles.select}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {CANCEL_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`subscription.cancel.reasons.${r}`)}
              </option>
            ))}
          </select>
        </AuthFormField>
        <AuthFormField
          id="cancel-notes"
          label={t('subscription.cancel.notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <label className={styles.kpiLabel}>
          <input
            type="checkbox"
            checked={cancelAtRenewal}
            onChange={(e) => setCancelAtRenewal(e.target.checked)}
            disabled={pauseInstead}
          />
          {' '}
          {t('subscription.cancel.atRenewal')}
        </label>
        <label className={styles.kpiLabel}>
          <input type="checkbox" checked={pauseInstead} onChange={(e) => setPauseInstead(e.target.checked)} />
          {' '}
          {t('subscription.cancel.pauseInstead')}
        </label>
      </div>
    </Modal>
  );
}
