import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useSidebarNavigation } from '@/features/dynamic-navigation/context/DynamicNavigationProvider';
import { resolveNavIcon } from '@/lib/nav-icons';
import styles from './Sidebar.module.css';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  variant?: 'desktop' | 'drawer';
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen = false,
  onMobileClose,
  variant = 'desktop',
}: SidebarProps) {
  const { t, direction } = useI18n();
  const items = useSidebarNavigation();

  const rootClass = [
    styles.sidebar,
    collapsed && variant === 'desktop' ? styles.collapsed : '',
    variant === 'drawer' ? styles.drawer : styles.sidebarDesktop,
    variant === 'drawer' && mobileOpen ? styles.drawerOpen : '',
  ]
    .filter(Boolean)
    .join(' ');

  const CollapseIcon = direction === 'rtl'
    ? collapsed
      ? ChevronLeft
      : ChevronRight
    : collapsed
      ? ChevronRight
      : ChevronLeft;

  return (
    <aside className={rootClass} aria-label={t('shell.menu')}>
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden>
          BS
        </span>
        {!collapsed && <span className={styles.brandText}>{t('app.name')}</span>}
      </div>

      <nav className={styles.nav}>
        {items.map((item) => {
          const Icon = resolveNavIcon(item.icon);
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => [styles.link, isActive ? styles.active : ''].join(' ')}
              onClick={onMobileClose}
              title={collapsed ? t(item.labelKey) : undefined}
            >
              <Icon size={20} aria-hidden />
              {!collapsed && <span className={styles.linkLabel}>{t(item.labelKey)}</span>}
            </NavLink>
          );
        })}
      </nav>

      {variant === 'desktop' && (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={onToggleCollapse}
            aria-label={t('shell.collapse')}
          >
            <CollapseIcon size={18} />
            {!collapsed && <span>{t('shell.collapse')}</span>}
          </button>
        </div>
      )}
    </aside>
  );
}
