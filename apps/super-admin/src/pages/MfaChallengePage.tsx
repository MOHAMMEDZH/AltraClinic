import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../auth/platform-auth-api';
import { PageLayout } from '../layout/PageLayout';

/** Returning-user MFA challenge — accepts a TOTP code or a one-time recovery code. */
export function MfaChallengePage() {
  const { t } = useI18n();
  const { submitMfaChallenge, error, clearError, status } = usePlatformAuth();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    clearError();
    setClientError(null);

    const trimmed = code.trim();
    if (!trimmed) {
      setClientError(t('pages.mfa.challenge.codeRequired', 'Enter your authentication code.'));
      return;
    }

    setPending(true);
    try {
      await submitMfaChallenge(trimmed);
    } catch (err) {
      if (!(err instanceof PlatformAuthApiError)) {
        setClientError(t('pages.mfa.challenge.verifyError', 'Unable to verify code. Try again.'));
      }
    } finally {
      setPending(false);
    }
  }

  const displayError = clientError ?? error;

  return (
    <PageLayout
      title={t('pages.mfa.challenge.title', 'Two-factor verification')}
      description={t(
        'pages.mfa.challenge.description',
        "Enter the code from your authenticator app, or one of your recovery codes if you\u2019ve lost access to it.",
      )}
    >
      <form className="sa-login-form" onSubmit={onSubmit} noValidate>
        <div className="sa-field">
          <label htmlFor="challenge-code">{t('pages.mfa.challenge.codeLabel', 'Authentication code')}</label>
          <input
            id="challenge-code"
            name="code"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={pending || status === 'loading'}
            required
          />
        </div>

        {displayError ? (
          <p className="sa-error" role="alert">
            {displayError}
          </p>
        ) : null}

        <button type="submit" className="sa-button" disabled={pending || status === 'loading'}>
          {pending ? t('pages.mfa.challenge.verifying', 'Verifying…') : t('pages.mfa.challenge.verifyButton', 'Verify')}
        </button>
      </form>

      <p>
        <Link to="/login">{t('pages.mfa.challenge.backToLogin', 'Back to login')}</Link>
      </p>
    </PageLayout>
  );
}
