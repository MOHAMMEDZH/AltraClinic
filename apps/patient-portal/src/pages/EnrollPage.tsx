import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePortalConfig } from '../app/providers/ConfigProvider';
import { usePortalI18n } from '../app/providers/LocalizationProvider';
import { persistPortalSession, portalEnroll } from '../lib/portal-auth-api';

export function EnrollPage() {
  const { api, storage, config } = usePortalConfig();
  const { t } = usePortalI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tenantId, setTenantId] = useState(params.get('tenantId') ?? '');
  const [enrollmentToken, setEnrollmentToken] = useState(params.get('token') ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
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
      const tokens = await portalEnroll(api, {
        tenantId,
        enrollmentToken,
        email,
        password,
        consentAccepted,
      });
      persistPortalSession(storage, tokens, tenantId);
      navigate('/account');
    } catch {
      setError('Enrollment could not be completed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-foundation" aria-labelledby="enroll-title">
      <h1 id="enroll-title">{t('auth.enroll.title')}</h1>
      <form className="portal-form" onSubmit={onSubmit}>
        <label>
          Tenant ID
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} required />
        </label>
        <label>
          Enrollment token
          <input value={enrollmentToken} onChange={(e) => setEnrollmentToken(e.target.value)} required />
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
            autoComplete="new-password"
          />
        </label>
        <label className="portal-checkbox">
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(e) => setConsentAccepted(e.target.checked)}
            required
          />
          {t('auth.enroll.consent')}
        </label>
        {error ? (
          <p role="alert" className="portal-meta">
            {error}
          </p>
        ) : null}
        <button className="portal-button" type="submit" disabled={busy || !consentAccepted}>
          {busy ? t('app.loading') : t('auth.enroll.submit')}
        </button>
      </form>
      <p className="portal-meta">
        <Link to="/login">Sign in</Link>
      </p>
    </section>
  );
}
