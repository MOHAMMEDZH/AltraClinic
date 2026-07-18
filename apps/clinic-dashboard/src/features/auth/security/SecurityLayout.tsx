import { NavLink, Outlet, Link } from 'react-router-dom';
import { CreditCard, KeyRound, MonitorSmartphone, Shield, Smartphone, UserCog, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { buildIdentityPermCheck, canViewUsers } from '@/features/user-management/config/user-management-config';
import styles from './SecurityLayout.module.css';

const navItems = [
  { to: '/settings/security', end: true, icon: Shield, labelKey: 'security.nav.overview' },
  { to: '/settings/security/password', icon: KeyRound, labelKey: 'security.nav.password' },
  { to: '/settings/security/sessions', icon: MonitorSmartphone, labelKey: 'security.nav.sessions' },
  { to: '/settings/security/devices', icon: Smartphone, labelKey: 'security.nav.devices' },
  { to: '/settings/security/mfa', icon: Shield, labelKey: 'security.nav.mfa' },
  { to: '/settings/security/profile', icon: UserCog, labelKey: 'security.nav.profile' },
  { to: '/settings/subscription', icon: CreditCard, labelKey: 'nav.subscription' },
] as const;

export function SecurityLayout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canManageUsers = useMemo(
    () => canViewUsers(buildIdentityPermCheck(user?.roles ?? [])),
    [user?.roles],
  );

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <Link className={styles.backLink} to="/settings">
          ← {t('settings.title')}
        </Link>
        <h1 className={styles.title}>{t('security.title')}</h1>
        <p className={styles.subtitle}>{t('security.subtitle')}</p>
        {canManageUsers && (
          <Link className={styles.navLink} to="/settings/users" style={{ width: 'fit-content' }}>
            <Users size={18} aria-hidden />
            {t('users.title')}
          </Link>
        )}
      </header>

      <div className={styles.grid}>
        <nav className={styles.nav} aria-label={t('security.title')}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                [styles.navLink, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ')
              }
            >
              <item.icon size={18} aria-hidden />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div id="security-settings-content" className={styles.content}>
          <Outlet />
        </div>      </div>
    </div>
  );
}
