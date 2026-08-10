import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePortalConfig } from '../app/providers/ConfigProvider';
import { usePortalI18n } from '../app/providers/LocalizationProvider';
import { clearPortalSession, persistPortalSession, portalLogin } from '../lib/portal-auth-api';

export function LoginPage() {
  const { api, storage, config } = usePortalConfig();
  const { t } = usePortalI18n();
  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!config.centerEnabled) {
    return (
      <section className="portal-unavailable">
        <h1>{t('app.unavailable.title')}</h1>
        <p>{t('app.unavailable.body')}</p>
      </section>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await portalLogin(api, { tenantId, email, password });
      if (result.kind === 'mfa_required') {
        sessionStorage.setItem('portal.mfaChallengeToken', result.mfaChallengeToken);
        navigate('/mfa');
        return;
      }
      persistPortalSession(storage, result.tokens, tenantId);
      navigate('/account');
    } catch {
      clearPortalSession(storage);
      setError('Sign-in could not be completed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-foundation" aria-labelledby="login-title">
      <h1 id="login-title">{t('auth.login.title')}</h1>
      <form className="portal-form" onSubmit={onSubmit}>
        <label>
          Tenant ID
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} required autoComplete="organization" />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error ? (
          <p role="alert" className="portal-meta">
            {error}
          </p>
        ) : null}
        <button className="portal-button" type="submit" disabled={busy}>
          {busy ? t('app.loading') : t('auth.login.submit')}
        </button>
      </form>
      <p className="portal-meta">
        <Link to="/enroll">Complete enrollment</Link>
      </p>
    </section>
  );
}
