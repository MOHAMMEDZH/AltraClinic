import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { useSuperAdminConfig } from '../app/providers/ConfigProvider';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { getRouteByPath } from '../routing/route-registry';
import { useRouteFocus } from '../routing/useRouteFocus';
import { DocumentTitle } from '../routing/DocumentTitle';
import { Breadcrumbs } from '../layout/Breadcrumbs';
import { IconButton } from '../ui/IconButton';
import { Drawer } from '../ui/Drawer';
import { FeedbackRegion } from '../ui/FeedbackProvider';
import { AuthPageFrame } from './AuthPageFrame';
import { EnvironmentBadge } from './EnvironmentBadge';
import { UserMenu } from './UserMenu';
import { PrimaryNavLinks } from './PrimaryNavLinks';

/**
 * Step 09 design system shell. Replaces the Step 06 scaffold layout.
 *
 * - Renders a minimal `AuthPageFrame` (no nav, no sidebar) for `auth`/`bare`
 *   routes and whenever the caller isn't fully authenticated.
 * - Renders the full authenticated app chrome (header, grouped primary
 *   nav, breadcrumbs, feedback region) otherwise.
 * - Never renders a tenant or patient selector.
 */
export function AppShell() {
  const location = useLocation();
  const { status, principal } = usePlatformAuth();
  const config = useSuperAdminConfig();
  const { t } = useI18n();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const route = getRouteByPath(location.pathname);
  const layout = route?.layout ?? 'app';
  const isAuthenticated = status === 'authenticated';

  useRouteFocus([() => setMobileNavOpen(false)]);

  const skipLink = (
    <a href="#main-content" className="skip-link">
      {t('a11y.skipToContent', 'Skip to main content')}
    </a>
  );

  if (layout !== 'app' || !isAuthenticated) {
    return (
      <>
        {skipLink}
        <DocumentTitle />
        <AuthPageFrame>
          <Outlet />
        </AuthPageFrame>
      </>
    );
  }

  return (
    <div className="sa-shell">
      {skipLink}
      <DocumentTitle />

      <header className="sa-shell-header">
        <IconButton
          aria-label={mobileNavOpen ? t('a11y.closeMenu', 'Close navigation menu') : t('a11y.menuButton', 'Menu')}
          aria-expanded={mobileNavOpen}
          aria-controls="sa-mobile-nav"
          className="sa-shell-menu-toggle"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span aria-hidden="true" className="sa-shell-menu-icon" />
        </IconButton>

        <Link to="/" className="sa-brand-link">
          {config.appName}
        </Link>

        <div className="sa-shell-header-end">
          <EnvironmentBadge />
          {principal ? <UserMenu /> : null}
        </div>
      </header>

      <div className="sa-shell-body">
        <nav className="sa-shell-nav" aria-label={t('a11y.mainNavigation', 'Primary')}>
          <PrimaryNavLinks />
        </nav>

        <Drawer
          open={mobileNavOpen}
          title={t('a11y.mobileNavigation', 'Navigation menu')}
          onClose={() => setMobileNavOpen(false)}
          side="start"
        >
          <div id="sa-mobile-nav">
            <PrimaryNavLinks onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </Drawer>

        <main id="main-content" tabIndex={-1} className="sa-shell-main">
          <Breadcrumbs />
          <Outlet />
          <FeedbackRegion />
        </main>
      </div>
    </div>
  );
}
