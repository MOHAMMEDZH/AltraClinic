import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../auth/platform-auth-api';
import { PageLayout } from '../layout/PageLayout';
import { formatMessage } from '../i18n/format';

export function ActivateInvitationPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { client, beginInvitedEnrollment } = usePlatformAuth();
  const token = params.get('token') ?? '';
  const [valid, setValid] = useState<boolean | null>(null);
  const [hint, setHint] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) {
      setValid(false);
      return;
    }
    void client
      .validateInvitation(token)
      .then((result) => {
        setValid(result.valid);
        setHint(result.emailHint ?? 'your platform account');
      })
      .catch(() => setValid(false));
  }, [client, token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError(t('pages.activate.passwordLength', 'Password must be at least 8 characters.'));
      return;
    }
    if (password !== confirm) {
      setError(t('pages.activate.passwordMismatch', 'Passwords do not match.'));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await client.acceptInvitation(token, password);
      beginInvitedEnrollment(result.preauthToken, result.email ?? hint);
      navigate('/mfa/enroll', { replace: true });
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : t('pages.activate.genericError', 'Unable to activate invitation.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <PageLayout title={t('pages.activate.title', 'Activate invitation')}>
      {valid === null ? (
        <p className="sa-loading">{t('pages.activate.validating', 'Validating invitation…')}</p>
      ) : !valid ? (
        <p className="sa-error" role="alert">
          {t('pages.activate.invalid', 'This invitation is invalid or has expired.')}
        </p>
      ) : (
        <form className="sa-login-form" onSubmit={submit} noValidate>
          <p>{formatMessage(t('pages.activate.setPasswordFor', 'Set a password for {target}.'), { target: hint })}</p>
          <label className="sa-field">
            {t('pages.activate.passwordLabel', 'Password')}
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label className="sa-field">
            {t('pages.activate.confirmPasswordLabel', 'Confirm password')}
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
          {error ? (
            <p className="sa-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="sa-button" disabled={pending}>
            {pending ? t('pages.activate.activating', 'Activating…') : t('pages.activate.activateButton', 'Activate account')}
          </button>
        </form>
      )}
    </PageLayout>
  );
}
