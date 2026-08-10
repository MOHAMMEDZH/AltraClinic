import { NavLink } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { listNavRoutesByGroup, type SuperAdminNavGroup } from '../routing/route-registry';

const GROUP_LABEL_KEY: Record<SuperAdminNavGroup, string> = {
  overview: 'nav.groups.overview',
  platform: 'nav.groups.platform',
  administration: 'nav.groups.administration',
  operations: 'nav.groups.operations',
  sales: 'nav.groups.sales',
};

/**
 * Grouped navigation link list, driven entirely by permission keys (no role
 * names). No tenant/patient selectors live here or anywhere in the shell.
 * Shared by the desktop `<aside>` and the mobile navigation drawer — the
 * caller decides how (or whether) to wrap this in a landmark.
 */
export function PrimaryNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { principal } = usePlatformAuth();
  const { t } = useI18n();
  const groups = listNavRoutesByGroup(principal);

  return (
    <div className="sa-nav-groups">
      {groups.map(({ group, routes }) => (
        <div className="sa-nav-group" key={group}>
          <p className="sa-nav-group-label">{t(GROUP_LABEL_KEY[group], group)}</p>
          <ul>
            {routes.map((route) => (
              <li key={route.id}>
                <NavLink
                  to={route.path}
                  className={({ isActive }) =>
                    ['sa-nav-link', isActive ? 'sa-nav-link-active' : null].filter(Boolean).join(' ')
                  }
                  onClick={onNavigate}
                >
                  {t(route.navLabelKey ?? route.titleKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
