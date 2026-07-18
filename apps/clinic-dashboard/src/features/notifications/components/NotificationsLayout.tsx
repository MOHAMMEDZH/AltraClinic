import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  Bell,
  FilePen,
  FileText,
  Inbox,
  LayoutDashboard,
  PenLine,
  Radio,
  Settings2,
  Truck,
  Zap,
} from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import styles from '../notifications-layout.module.css';

const navItems = [
  { to: '/settings/notifications', end: true, icon: LayoutDashboard, labelKey: 'notifications.nav.overview' },
  { to: '/settings/notifications/inbox', icon: Inbox, labelKey: 'notifications.nav.inbox' },
  { to: '/settings/notifications/compose', icon: PenLine, labelKey: 'notifications.nav.compose' },
  { to: '/settings/notifications/drafts', icon: FilePen, labelKey: 'notifications.nav.drafts' },
  { to: '/settings/notifications/templates', icon: FileText, labelKey: 'notifications.nav.templates' },
  { to: '/settings/notifications/automation', icon: Zap, labelKey: 'notifications.nav.automation' },
  { to: '/settings/notifications/delivery', icon: Truck, labelKey: 'notifications.nav.delivery' },
  { to: '/settings/notifications/channels', icon: Radio, labelKey: 'notifications.nav.channels' },
  { to: '/settings/notifications/preferences', icon: Settings2, labelKey: 'notifications.nav.preferences' },
] as const;

export function NotificationsLayout() {
  const { t } = useI18n();

  return (
    <div className={styles.layout} id="notifications-region">
      <header className={styles.header}>
        <Link to="/settings" className={styles.backLink}>← {t('settings.title')}</Link>
        <h1 className={styles.title}>
          <Bell size={28} aria-hidden style={{ verticalAlign: 'middle', marginInlineEnd: 8 }} />
          {t('notifications.title')}
        </h1>
        <p className={styles.subtitle}>{t('notifications.subtitle')}</p>
      </header>

      <div className={styles.grid}>
        <nav className={styles.nav} aria-label={t('notifications.title')}>
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
