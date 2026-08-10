import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../auth/platform-auth-api';
import { PageLayout } from '../layout/PageLayout';

export function LoginPage() {
  const { t } = useI18n();
  const { login, error, clearError, status } = usePlatformAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    clearError();
    setClientError(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setClientError(t('pages.login.validationRequired', 'Email and password are required.'));
      return;
    }
    if (password.length < 8) {
      setClientError(t('pages.login.validationPasswordLength', 'Password must be at least 8 characters.'));
      return;
    }

    setPending(true);
    try {
      await login(normalizedEmail, password);
    } catch (err) {
      if (!(err instanceof PlatformAuthApiError)) {
        setClientError(t('pages.login.genericError', 'Unable to sign in. Try again.'));
      }
    } finally {
      setPending(false);
    }
  }

  const displayError = clientError ?? error;

  return (
    <PageLayout
      title={t('pages.login.title', 'Login')}
      description={t('pages.login.description', 'Sign in with your platform operator account. This is not clinic or patient login.')}
    >
      <form className="sa-login-form" onSubmit={onSubmit} noValidate>
        <div className="sa-field">
          <label htmlFor="platform-email">{t('pages.login.emailLabel', 'Email')}</label>
          <input
            id="platform-email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending || status === 'loading'}
            required
          />
        </div>
        <div className="sa-field">
          <label htmlFor="platform-password">{t('pages.login.passwordLabel', 'Password')}</label>
          <input
            id="platform-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending || status === 'loading'}
            required
            minLength={8}
          />
        </div>

        {displayError ? (
          <p className="sa-error" role="alert">
            {displayError}
          </p>
        ) : null}

        <button type="submit" className="sa-button" disabled={pending || status === 'loading'}>
          {pending ? t('pages.login.signingIn', 'Signing in…') : t('common.buttons.signIn', 'Sign in')}
        </button>
      </form>

      <p className="sa-muted sa-recovery-note">{t('pages.login.recoveryNote', 'Password recovery for platform accounts is not enabled. Contact an operator through your secure out-of-band process if you need access restored.')}</p>

      <p>
        <Link to="/">{t('pages.login.returnHome', 'Return home')}</Link>
      </p>
    </PageLayout>
  );
}
