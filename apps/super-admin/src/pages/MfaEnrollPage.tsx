import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../auth/platform-auth-api';
import { RecoveryCodesPanel } from '../auth/RecoveryCodesPanel';
import { PageLayout } from '../layout/PageLayout';

/**
 * First-time platform MFA enrollment. MFA is mandatory — there is no way to
 * finish signing in without confirming a TOTP code here. The otpauth URI and
 * secret are shown as copyable text only; we never call an external QR
 * rendering service.
 */
export function MfaEnrollPage() {
  const { t } = useI18n();
  const {
    status,
    beginEnrollment,
    confirmEnrollment,
    error,
    clearError,
    enrollmentEmail,
    recoveryCodes,
    acknowledgeRecoveryCodes,
  } = usePlatformAuth();

  const [enrollment, setEnrollment] = useState<{ otpauthUrl: string; secret: string } | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const beganRef = useRef(false);

  useEffect(() => {
    if (status !== 'mfa_enrollment_required' || beganRef.current) return;
    beganRef.current = true;
    beginEnrollment()
      .then((result) => setEnrollment(result))
      .catch((err) => {
        setLoadError(
          err instanceof PlatformAuthApiError ? err.message : t('pages.mfa.enroll.beginError', 'Unable to start enrollment.'),
        );
      });
  }, [status, beginEnrollment, t]);

  if (status === 'authenticated' && recoveryCodes) {
    return (
      <PageLayout title={t('pages.mfa.enroll.enabledTitle', 'Two-factor authentication enabled')}>
        <RecoveryCodesPanel codes={recoveryCodes} onAcknowledge={acknowledgeRecoveryCodes} />
      </PageLayout>
    );
  }

  async function onCopySecret() {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    clearError();
    setClientError(null);

    const trimmed = code.trim();
    if (!trimmed) {
      setClientError(t('pages.mfa.enroll.codeRequired', 'Enter the 6-digit code from your authenticator app.'));
      return;
    }

    setPending(true);
    try {
      await confirmEnrollment(trimmed);
    } catch (err) {
      if (!(err instanceof PlatformAuthApiError)) {
        setClientError(t('pages.mfa.enroll.verifyError', 'Unable to verify code. Try again.'));
      }
    } finally {
      setPending(false);
    }
  }

  const displayError = clientError ?? error;

  return (
    <PageLayout
      title={t('pages.mfa.enroll.title', 'Set up two-factor authentication')}
      description={
        <>
          {enrollmentEmail
            ? t('pages.mfa.enroll.descriptionPrefix', 'Two-factor authentication is required for {email}. ').replace(
                '{email}',
                enrollmentEmail,
              )
            : null}
          {t(
            'pages.mfa.enroll.descriptionBody',
            'Add this account to an authenticator app (such as a TOTP app that supports manual entry), then confirm a code below.',
          )}
        </>
      }
    >
      {loadError ? (
        <p className="sa-error" role="alert">
          {loadError}
        </p>
      ) : !enrollment ? (
        <div className="sa-loading" role="status" aria-live="polite">
          {t('pages.mfa.enroll.preparing', 'Preparing enrollment…')}
        </div>
      ) : (
        <>
          <div className="sa-field">
            <label htmlFor="otpauth-uri">{t('pages.mfa.enroll.setupUriLabel', 'Setup URI')}</label>
            <textarea id="otpauth-uri" readOnly rows={2} value={enrollment.otpauthUrl} />
          </div>
          <div className="sa-field">
            <label htmlFor="otpauth-secret">{t('pages.mfa.enroll.secretLabel', 'Manual entry secret')}</label>
            <div className="sa-copy-row">
              <code id="otpauth-secret" className="sa-secret">
                {enrollment.secret}
              </code>
              <button type="button" className="sa-button sa-button-quiet" onClick={onCopySecret}>
                {copyState === 'copied' ? t('pages.mfa.enroll.copiedButton', 'Copied') : t('pages.mfa.enroll.copyButton', 'Copy')}
              </button>
            </div>
            {copyState === 'error' ? (
              <span className="sa-error" role="alert">
                {t('pages.mfa.enroll.copyError', 'Unable to copy — please copy manually.')}
              </span>
            ) : null}
          </div>

          <form className="sa-login-form" onSubmit={onSubmit} noValidate>
            <div className="sa-field">
              <label htmlFor="enrollment-code">{t('pages.mfa.enroll.codeLabel', '6-digit code')}</label>
              <input
                id="enrollment-code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={pending}
                required
              />
            </div>

            {displayError ? (
              <p className="sa-error" role="alert">
                {displayError}
              </p>
            ) : null}

            <button type="submit" className="sa-button" disabled={pending}>
              {pending ? t('pages.mfa.enroll.verifying', 'Verifying…') : t('pages.mfa.enroll.confirmButton', 'Confirm and enable')}
            </button>
          </form>
        </>
      )}

      <p>
        <Link to="/login">{t('pages.mfa.enroll.backToLogin', 'Back to login')}</Link>
      </p>
    </PageLayout>
  );
}
