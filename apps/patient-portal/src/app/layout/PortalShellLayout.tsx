import { NavLink, Outlet } from 'react-router-dom';
import { usePortalI18n } from '../providers/LocalizationProvider';
import { usePortalTheme } from '../providers/ThemeProvider';
import { usePortalConfig } from '../providers/ConfigProvider';

/**
 * Phase 46a/46e shell — semantic landmarks, skip link, primary nav, responsive.
 */
export function PortalShellLayout() {
  const { t, dir } = usePortalI18n();
  const { brand } = usePortalTheme();
  const { config, storage } = usePortalConfig();
  const hasSession = Boolean(storage.getItem('portal.accessToken'));

  return (
    <div className="portal-shell" data-dir={dir}>
      <a className="portal-skip-link" href="#main">
        {t('nav.skip')}
      </a>
      <header className="portal-header" role="banner">
        <div className="portal-brand">
          {brand.logoUrl ? (
            <img className="portal-logo" src={brand.logoUrl} alt="" />
          ) : null}
          <p className="portal-brand-name">{brand.portalName || brand.clinicName}</p>
        </div>
        {hasSession && config.centerEnabled ? (
          <nav className="portal-primary-nav" aria-label={t('nav.primary')}>
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
              {t('nav.home')}
            </NavLink>
            {config.appointmentsEnabled ? (
              <NavLink to="/appointments" className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
                {t('nav.appointments')}
              </NavLink>
            ) : null}
            <NavLink to="/profile" className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
              {t('nav.profile')}
            </NavLink>
            {config.caregiverEnabled ? (
              <NavLink to="/caregivers" className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
                {t('nav.caregivers')}
              </NavLink>
            ) : null}
            <NavLink to="/account" className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
              {t('nav.account')}
            </NavLink>
          </nav>
        ) : null}
      </header>
      <main id="main" className="portal-main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="portal-footer" role="contentinfo">
        <p>{brand.portalName || t('shell.foundation')}</p>
      </footer>
    </div>
  );
}
