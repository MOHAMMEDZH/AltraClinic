import { Outlet } from 'react-router-dom';
import { Activity, LogOut } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import styles from './enterprise-license-experience.module.css';

/** Minimal shell for subscription-only access when the tenant license blocks the main app. */
export function LicenseMaintenanceLayout() {
  const { t } = useI18n();
  const { logout } = useAuth();

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
          <Outlet />
        </div>
      </div>
    </div>
  );
}
