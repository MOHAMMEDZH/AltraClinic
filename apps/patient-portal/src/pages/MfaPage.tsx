import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalConfig } from '../app/providers/ConfigProvider';
import { usePortalI18n } from '../app/providers/LocalizationProvider';
import { persistPortalSession, portalVerifyMfa } from '../lib/portal-auth-api';

export function MfaPage() {
  const { api, storage, config } = usePortalConfig();
  const { t } = usePortalI18n();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const challenge = typeof sessionStorage !== 'undefined'
    ? sessionStorage.getItem('portal.mfaChallengeToken')
    : null;

  if (!config.centerEnabled) {
    return (
      <section className="portal-unavailable">
        <h1>{t('app.unavailable.title')}</h1>
      </section>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!challenge) {
      setError('MFA challenge missing');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tokens = await portalVerifyMfa(api, { mfaChallengeToken: challenge, code });
      sessionStorage.removeItem('portal.mfaChallengeToken');
      const tenantId = storage.getItem('portal.tenantId') ?? '';
      persistPortalSession(storage, tokens, tenantId);
      navigate('/account');
    } catch {
      setError('Verification could not be completed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-foundation" aria-labelledby="mfa-title">
      <h1 id="mfa-title">{t('auth.mfa.title')}</h1>
      <form className="portal-form" onSubmit={onSubmit}>
        <label>
          Authentication code
          <input value={code} onChange={(e) => setCode(e.target.value)} required inputMode="numeric" autoComplete="one-time-code" />
        </label>
        {error ? (
          <p role="alert" className="portal-meta">
            {error}
          </p>
        ) : null}
        <button className="portal-button" type="submit" disabled={busy}>
          {busy ? t('app.loading') : t('auth.mfa.submit')}
        </button>
      </form>
    </section>
  );
}
