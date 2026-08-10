import { Link } from 'react-router-dom';
import { usePortalConfig } from '../app/providers/ConfigProvider';
import { usePortalI18n } from '../app/providers/LocalizationProvider';

/**
 * Shown when center flag is ON — links into enrolled surfaces.
 */
export function FoundationPage() {
  const { config, storage } = usePortalConfig();
  const { t } = usePortalI18n();
  const hasSession = Boolean(storage.getItem('portal.accessToken'));

  return (
    <section className="portal-foundation" aria-labelledby="foundation-title">
      <h1 id="foundation-title">{t('app.name')}</h1>
      <p>{t('shell.foundation')}</p>
      <p className="portal-meta" data-testid="portal-phase">
        {config.phase} · center {config.centerEnabled ? 'ON' : 'OFF'} · appointments{' '}
        {config.appointmentsEnabled ? 'ON' : 'OFF'} · caregivers{' '}
        {config.caregiverEnabled ? 'ON' : 'OFF'}
      </p>
      <nav className="portal-nav" aria-label={t('app.name')}>
        {hasSession ? (
          <>
            <Link className="portal-button" to="/account">
              {t('nav.account')}
            </Link>
            {config.appointmentsEnabled ? (
              <Link className="portal-button" to="/appointments">
                {t('nav.appointments')}
              </Link>
            ) : null}
          </>
        ) : (
          <Link className="portal-button" to="/login">
            {t('auth.login.title')}
          </Link>
        )}
      </nav>
    </section>
  );
}
