import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  Activity,
  BookKey,
  Gauge,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  Library,
  ListTree,
  Plug,
  Settings2,
  Shield,
  Users,
  Webhook,
} from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import {
  API_INTEGRATIONS_BASE_PATH,
  canViewApiIntegrations,
} from '../config/api-integrations-config';
import { useIntegrationsOpsDashboard } from '../hooks/useIntegrationsOps';
import styles from '../api-integrations-layout.module.css';

const navItems = [
  { to: API_INTEGRATIONS_BASE_PATH, end: true, icon: LayoutDashboard, labelKey: 'apiIntegrations.nav.overview', fallback: 'Overview' },
  { to: `${API_INTEGRATIONS_BASE_PATH}/credentials`, icon: KeyRound, labelKey: 'apiIntegrations.nav.credentials', fallback: 'Credentials' },
  { to: `${API_INTEGRATIONS_BASE_PATH}/service-accounts`, icon: Users, labelKey: 'apiIntegrations.nav.serviceAccounts', fallback: 'Service accounts' },
  { to: `${API_INTEGRATIONS_BASE_PATH}/scopes`, icon: BookKey, labelKey: 'apiIntegrations.nav.scopes', fallback: 'Scopes' },
  { to: `${API_INTEGRATIONS_BASE_PATH}/providers`, icon: Plug, labelKey: 'apiIntegrations.nav.providers', fallback: 'Providers' },
  { to: `${API_INTEGRATIONS_BASE_PATH}/webhooks`, icon: Webhook, labelKey: 'apiIntegrations.nav.webhooks', fallback: 'Webhooks' },
  { to: `${API_INTEGRATIONS_BASE_PATH}/deliveries`, icon: Activity, labelKey: 'apiIntegrations.nav.deliveries', fallback: 'Deliveries' },
  { to: `${API_INTEGRATIONS_BASE_PATH}/gateway`, icon: Shield, labelKey: 'apiIntegrations.nav.gateway', fallback: 'Gateway' },
  { to: `${API_INTEGRATIONS_BASE_PATH}/quotas`, icon: Gauge, labelKey: 'apiIntegrations.nav.quotas', fallback: 'Quotas & usage' },
  { to: `${API_INTEGRATIONS_BASE_PATH}/metrics`, icon: ListTree, labelKey: 'apiIntegrations.nav.metrics', fallback: 'Metrics & audit' },
  { to: `${API_INTEGRATIONS_BASE_PATH}/permissions`, icon: Library, labelKey: 'apiIntegrations.nav.permissions', fallback: 'Permissions' },
  { to: `${API_INTEGRATIONS_BASE_PATH}/configuration`, icon: Settings2, labelKey: 'apiIntegrations.nav.configuration', fallback: 'Configuration' },
  { to: `${API_INTEGRATIONS_BASE_PATH}/health`, icon: HeartPulse, labelKey: 'apiIntegrations.nav.health', fallback: 'Health' },
] as const;

export function ApiIntegrationsLayout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles?.map(String) ?? [];
  const canView = canViewApiIntegrations(roles);
  const dashboard = useIntegrationsOpsDashboard(canView);

  if (!canView) {
    return (
      <div className={styles.layout} id="api-integrations-region">
        <AuthAlert variant="error">
          {t(
            'apiIntegrations.errors.missingView',
            'Missing api.integrations:view permission.',
          )}
        </AuthAlert>
      </div>
    );
  }

  const dormant = dashboard.data?.readiness.dormant !== false;
  const licensed = dashboard.data?.license.allowIntegrations !== false;

  return (
    <div
      className={styles.layout}
      id="api-integrations-region"
      role="region"
      aria-labelledby="api-integrations-title"
    >
      <header className={styles.header}>
        <Link to="/settings" className={styles.backLink}>
          ← {t('settings.title', 'Settings')}
        </Link>
        <h1 id="api-integrations-title" className={styles.title}>
          {t('settings.nav.apiIntegrations', 'API Keys & Integrations')}
        </h1>
        <p className={styles.subtitle}>
          {t(
            'settings.nav.apiIntegrationsDesc',
            'Credentials, scopes, webhooks, gateway diagnostics, and quotas.',
          )}
        </p>
      </header>

      {dormant ? (
        <div className={styles.banner} role="status">
          {t(
            'apiIntegrations.banner.dormant',
            'Center is dormant — API_KEYS_INTEGRATIONS_CENTER_ENABLED is off. Engines stay fail-closed until explicitly enabled.',
          )}
        </div>
      ) : null}
      {!licensed ? (
        <div className={styles.banner} role="status">
          {t(
            'apiIntegrations.banner.license',
            'Integrations are not licensed for this tenant (allowIntegrations=false).',
          )}
        </div>
      ) : null}

      <div className={styles.grid}>
        <nav
          className={styles.nav}
          aria-label={t('settings.nav.apiIntegrations', 'API Keys & Integrations')}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                [styles.navLink, isActive ? styles.navLinkActive : '']
                  .filter(Boolean)
                  .join(' ')
              }
            >
              <item.icon size={18} aria-hidden />
              {t(item.labelKey, item.fallback)}
            </NavLink>
          ))}
        </nav>
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
