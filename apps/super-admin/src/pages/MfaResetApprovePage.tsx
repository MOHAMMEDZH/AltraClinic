import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { StepUpModal } from '../auth/StepUpModal';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { useHighImpactAction } from '../shell/useHighImpactAction';
import { PageLayout } from '../layout/PageLayout';
import { ConfirmationDialog } from '../ui';

/**
 * MFA reset decisions are high-impact and irreversible-in-effect (a rejected
 * request must be resubmitted; an approved one clears the target's MFA
 * enrollment). Neither Approve nor Reject fires on first click — both open
 * a confirmation dialog with an optional decision reason.
 */
export function MfaResetApprovePage() {
  const { requestId = '' } = useParams();
  const { t } = useI18n();
  const { client, withAccessToken } = usePlatformAuth();
  const highImpact = useHighImpactAction();
  const [message, setMessage] = useState<string | null>(null);

  function openApprove() {
    setMessage(null);
    highImpact.open({
      kind: 'mfa-reset-approve',
      targetId: requestId,
      targetLabel: t('pages.mfaReset.targetLabel', 'this MFA reset request'),
      reasonRequired: false,
      execute: async (reason) => {
        await withAccessToken((token) => client.approveMfaReset(token, requestId, reason.trim() || undefined));
        setMessage(t('pages.mfaReset.approvedMessage', 'MFA reset approved.'));
      },
    });
  }

  function openReject() {
    setMessage(null);
    highImpact.open({
      kind: 'mfa-reset-reject',
      targetId: requestId,
      targetLabel: t('pages.mfaReset.targetLabel', 'this MFA reset request'),
      reasonRequired: false,
      execute: async (reason) => {
        await withAccessToken((token) => client.rejectMfaReset(token, requestId, reason.trim() || undefined));
        setMessage(t('pages.mfaReset.rejectedMessage', 'MFA reset rejected.'));
      },
    });
  }

  return (
    <PageLayout
      title={t('pages.mfaReset.title', 'Review MFA reset request')}
      description={t(
        'pages.mfaReset.description',
        'Separation of duties applies: you cannot approve a request you submitted or one affecting your own account.',
      )}
    >
      {message ? <p role="status">{message}</p> : null}

      <button type="button" className="sa-button" onClick={openApprove}>
        {t('pages.mfaReset.approveButton', 'Approve reset')}
      </button>{' '}
      <button type="button" className="sa-button sa-button-danger" onClick={openReject}>
        {t('pages.mfaReset.rejectButton', 'Reject reset')}
      </button>

      <ConfirmationDialog {...highImpact.dialogProps} />
      <StepUpModal open={highImpact.stepUpProps.open} onClose={highImpact.stepUpProps.onClose} onVerified={highImpact.stepUpProps.onVerified} />
    </PageLayout>
  );
}
