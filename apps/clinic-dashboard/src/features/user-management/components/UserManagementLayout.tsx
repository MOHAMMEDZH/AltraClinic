import { NavLink, Outlet, Link } from 'react-router-dom';
import { ClipboardList, LayoutDashboard, Mail, Shield, UserPlus, Users } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import styles from '../user-management-layout.module.css';

const navItems = [
  { to: '/settings/users', end: true, icon: LayoutDashboard, labelKey: 'users.nav.overview' },
  { to: '/settings/users/directory', icon: Users, labelKey: 'users.nav.directory' },
  { to: '/settings/users/create', icon: UserPlus, labelKey: 'users.nav.create' },
  { to: '/settings/users/invitations', icon: Mail, labelKey: 'users.nav.invitations' },
  { to: '/settings/users/roles', icon: Shield, labelKey: 'users.nav.roles' },
  { to: '/settings/users/audit', icon: ClipboardList, labelKey: 'users.nav.audit' },
] as const;

export function UserManagementLayout() {
  const { t } = useI18n();

  return (
    <div className={styles.layout} id="user-management-region">
      <header className={styles.header}>
        <Link to="/settings" className={styles.backLink}>← {t('settings.title')}</Link>
        <h1 className={styles.title}>{t('users.title')}</h1>
        <p className={styles.subtitle}>{t('users.subtitle')}</p>
      </header>

      <div className={styles.grid}>
        <nav className={styles.nav} aria-label={t('users.title')}>
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

        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
