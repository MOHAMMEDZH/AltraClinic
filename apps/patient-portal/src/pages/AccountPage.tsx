import { FormEvent, useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePortalConfig } from '../app/providers/ConfigProvider';
import { usePortalI18n } from '../app/providers/LocalizationProvider';
import type { PortalApiError } from '../lib/api-client';
import {
  clearPortalSession,
  portalChangePassword,
  portalConfirmMfa,
  portalGetMe,
  portalLogout,
  portalLogoutAll,
  portalSetupMfa,
  type PortalMeResponse,
} from '../lib/portal-auth-api';
import {
  fetchMyPreferences,
  updateMyPreferences,
  type PortalPreferences,
} from '../lib/portal-preferences-api';

/** Phase 46e — account, security, and portal-owned preferences. */
export function AccountPage() {
  const { storage, config, api } = usePortalConfig();
  const { t, setLocale } = usePortalI18n();
  const navigate = useNavigate();
  const titleId = useId();
  const securityId = useId();
  const prefsId = useId();

  const [me, setMe] = useState<PortalMeResponse | null>(null);
  const [prefs, setPrefs] = useState<PortalPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const token = storage.getItem('portal.accessToken') ?? '';
  const tenantId = storage.getItem('portal.tenantId') ?? '';
  const sessionId = storage.getItem('portal.sessionId');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [meRes, prefsRes] = await Promise.all([
          portalGetMe(api, token, tenantId),
          fetchMyPreferences(api, token, tenantId),
        ]);
        if (cancelled) return;
        setMe(meRes);
        setPrefs(prefsRes);
        setLocale(prefsRes.locale);
      } catch (err) {
        const apiErr = err as PortalApiError;
        if (apiErr.status === 401) navigate('/login', { replace: true });
        else if (!cancelled) setError(apiErr.message ?? t('auth.account.error'));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [api, token, tenantId, navigate, setLocale, t]);

  if (!config.centerEnabled) {
    return (
      <section className="portal-unavailable">
        <h1>{t('app.unavailable.title')}</h1>
      </section>
    );
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await portalChangePassword(api, token, tenantId, {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setMessage(t('security.password.success'));
    } catch (err) {
      setError((err as PortalApiError).message ?? t('security.error'));
    }
  }

  async function onSetupMfa() {
    setError(null);
    try {
      const result = await portalSetupMfa(api, token, tenantId);
      setMfaSecret(result.secret);
      setMessage(t('security.mfa.setupReady'));
    } catch (err) {
      setError((err as PortalApiError).message ?? t('security.error'));
    }
  }

  async function onConfirmMfa(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await portalConfirmMfa(api, token, tenantId, mfaCode);
      setMfaCode('');
      setMfaSecret(null);
      setMessage(t('security.mfa.success'));
      const refreshed = await portalGetMe(api, token, tenantId);
      setMe(refreshed);
    } catch (err) {
      setError((err as PortalApiError).message ?? t('security.error'));
    }
  }

  async function onSavePreferences(e: FormEvent) {
    e.preventDefault();
    if (!prefs) return;
    setError(null);
    try {
      await updateMyPreferences(api, token, tenantId, prefs);
      setLocale(prefs.locale);
      setMessage(t('preferences.success'));
    } catch (err) {
      setError((err as PortalApiError).message ?? t('preferences.error'));
    }
  }

  async function signOut(all: boolean) {
    setError(null);
    try {
      if (all) await portalLogoutAll(api, token, tenantId);
      else await portalLogout(api, token, tenantId);
    } catch {
      /* still clear local session */
    }
    clearPortalSession(storage);
    navigate('/login', { replace: true });
  }

  return (
    <section className="portal-account" aria-labelledby={titleId}>
      <h1 id={titleId}>{t('auth.account.title')}</h1>
      <p>{t('auth.account.body')}</p>
      <p className="portal-meta" data-testid="portal-session">
        session {sessionId ? 'active' : 'none'} · sessionClass patient
      </p>

      {error ? (
        <p className="portal-alert" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="portal-success" role="status">
          {message}
        </p>
      ) : null}

      <article className="portal-panel" aria-labelledby="account-info-title">
        <h2 id="account-info-title">{t('account.info')}</h2>
        {me ? (
          <dl className="portal-dl">
            <div>
              <dt>{t('account.email')}</dt>
              <dd>{me.email ?? me.userId}</dd>
            </div>
            <div>
              <dt>{t('home.enrollment')}</dt>
              <dd>
                {me.enrollmentComplete
                  ? t('home.enrollmentComplete')
                  : me.status}
              </dd>
            </div>
            <div>
              <dt>{t('security.mfa.status')}</dt>
              <dd>{me.mfaEnabled ? t('security.mfa.on') : t('security.mfa.off')}</dd>
            </div>
          </dl>
        ) : (
          <p className="portal-meta">{t('app.loading')}</p>
        )}
      </article>

      <article className="portal-panel" id="security" aria-labelledby={securityId}>
        <h2 id={securityId}>{t('security.title')}</h2>
        <form className="portal-form" onSubmit={onChangePassword}>
          <h3>{t('security.password.title')}</h3>
          <label>
            {t('security.password.current')}
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <label>
            {t('security.password.new')}
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
          <button type="submit" className="portal-button">
            {t('security.password.submit')}
          </button>
        </form>

        <div className="portal-form">
          <h3>{t('security.mfa.title')}</h3>
          <button type="button" className="portal-button" onClick={() => void onSetupMfa()}>
            {t('security.mfa.setup')}
          </button>
          {mfaSecret ? (
            <p className="portal-meta" data-testid="mfa-secret">
              {t('security.mfa.secret')}: {mfaSecret}
            </p>
          ) : null}
          <form className="portal-form" onSubmit={onConfirmMfa}>
            <label>
              {t('security.mfa.code')}
              <input
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                inputMode="numeric"
                required
              />
            </label>
            <button type="submit" className="portal-button">
              {t('security.mfa.confirm')}
            </button>
          </form>
        </div>

        <div className="portal-nav" aria-label={t('security.sessions')}>
          <button type="button" className="portal-button" onClick={() => void signOut(false)}>
            {t('auth.logout')}
          </button>
          <button
            type="button"
            className="portal-button portal-button-danger"
            onClick={() => void signOut(true)}
          >
            {t('auth.logoutAll')}
          </button>
        </div>
      </article>

      <article className="portal-panel" id="preferences" aria-labelledby={prefsId}>
        <h2 id={prefsId}>{t('preferences.title')}</h2>
        <p>{t('preferences.body')}</p>
        {prefs ? (
          <form className="portal-form" onSubmit={onSavePreferences}>
            <fieldset>
              <legend>{t('preferences.locale')}</legend>
              <label className="portal-checkbox">
                <input
                  type="radio"
                  name="locale"
                  checked={prefs.locale === 'en'}
                  onChange={() => setPrefs({ ...prefs, locale: 'en' })}
                />
                English
              </label>
              <label className="portal-checkbox">
                <input
                  type="radio"
                  name="locale"
                  checked={prefs.locale === 'ar'}
                  onChange={() => setPrefs({ ...prefs, locale: 'ar' })}
                />
                العربية
              </label>
            </fieldset>
            <fieldset>
              <legend>{t('preferences.channels')}</legend>
              {(['email', 'sms', 'push'] as const).map((channel) => (
                <label key={channel} className="portal-checkbox">
                  <input
                    type="checkbox"
                    checked={prefs.channels[channel]}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        channels: { ...prefs.channels, [channel]: e.target.checked },
                      })
                    }
                  />
                  {t(`preferences.channel.${channel}`)}
                </label>
              ))}
            </fieldset>
            <button type="submit" className="portal-button">
              {t('preferences.save')}
            </button>
          </form>
        ) : (
          <p className="portal-meta">{t('app.loading')}</p>
        )}
      </article>

      <nav className="portal-nav" aria-label={t('app.name')}>
        <Link className="portal-button" to="/">
          {t('nav.home')}
        </Link>
        <Link className="portal-button" to="/profile">
          {t('nav.profile')}
        </Link>
        {config.appointmentsEnabled ? (
          <Link className="portal-button" to="/appointments">
            {t('nav.appointments')}
          </Link>
        ) : null}
        {config.caregiverEnabled ? (
          <Link className="portal-button" to="/caregivers">
            {t('nav.caregivers')}
          </Link>
        ) : null}
      </nav>
    </section>
  );
}
