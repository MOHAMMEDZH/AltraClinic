import { Outlet, useRoutes } from 'react-router-dom';
import { Activity, LogOut } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  STATIC_ROUTE_CATALOG,
  collectShellRoutes,
} from '@/features/dynamic-routing/lib/static-route-catalog';
import { buildStaticRouteSnapshot } from '@/features/dynamic-routing/lib/route-tree-builder';
import { isRegistryRoutingEnabled } from '@/features/dynamic-routing/lib/static-route-flags';
import styles from './enterprise-license-experience.module.css';

/** Always include subscription routes — registry filtering may omit them when license-blocked. */
const MAINTENANCE_SHELL_SNAPSHOT = buildStaticRouteSnapshot(collectShellRoutes(STATIC_ROUTE_CATALOG));

function MaintenanceShellRoutes() {
  const element = useRoutes(MAINTENANCE_SHELL_SNAPSHOT.routeObjects);
  return element ?? <Outlet />;
}

/** Minimal shell for subscription-only access when the tenant license blocks the main app. */
export function LicenseMaintenanceLayout() {
  const { t } = useI18n();
  const { logout } = useAuth();
  const useRegistryRoutes = isRegistryRoutingEnabled();

  return (
    <div className={styles.page} data-testid="license-maintenance-layout">
      <div className={styles.main} style={{ gridColumn: '1 / -1' }}>
        <div className={styles.toolbar}>
          <div className={styles.brandLogo}>
            <span className={styles.brandIcon}>
              <Activity size={18} strokeWidth={2.2} />
            </span>
            <span>{t('subscription.licenseGate.maintenanceTitle')}</span>
          </div>
          <AuthButton variant="secondary" onClick={() => void logout()}>
            <LogOut size={16} aria-hidden style={{ marginInlineEnd: 8 }} />
            {t('auth.logout')}
          </AuthButton>
        </div>
        <div className={styles.content}>
          {/*
            Registry ShellRouteRenderer can omit subscription paths when modules are locked.
            Maintenance mode must always mount the static subscription center tree.
          */}
          {useRegistryRoutes ? <MaintenanceShellRoutes /> : <Outlet />}
        </div>
      </div>
    </div>
  );
}
