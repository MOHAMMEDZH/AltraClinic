import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Search, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useSubscriptionEntitlements } from '@/features/subscription/hooks/useSubscriptionEntitlements';
import { buildSettingsPermCheck, canViewSettings, filterSettingsNav, isSettingsNavLocked, SETTINGS_NAV } from '../config/settings-config';
import { loadFavorites, loadRecent, recordSettingsVisit, toggleFavorite } from '../lib/settings-nav-history';
import { MaintenanceBanner } from './MaintenanceBanner';
import styles from '../settings-layout.module.css';

export function SettingsLayout() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const entitlements = useSubscriptionEntitlements();
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());
  const perm = useMemo(() => buildSettingsPermCheck(user?.roles ?? []), [user?.roles]);
  const navItems = useMemo(
    () => filterSettingsNav(user?.roles ?? [], entitlements.canUseFeature),
    [user?.roles, entitlements.canUseFeature],
  );

  const groups = useMemo(() => {
    const map = new Map<string, typeof navItems>();
    for (const item of navItems) {
      const list = map.get(item.groupKey) ?? [];
      list.push(item);
      map.set(item.groupKey, list);
    }
    return [...map.entries()];
  }, [navItems]);

  useEffect(() => {
    recordSettingsVisit(location.pathname);
  }, [location.pathname]);

  const recentItems = useMemo(() => {
    const paths = loadRecent().filter((path) => path !== '/settings' && path !== location.pathname);
    return paths
      .map((path) => SETTINGS_NAV.find((item) => item.to === path))
      .filter(Boolean)
      .slice(0, 5) as typeof navItems;
  }, [location.pathname]);

  const favoriteItems = useMemo(
    () => favorites.map((path) => SETTINGS_NAV.find((item) => item.to === path)).filter(Boolean) as typeof navItems,
    [favorites],
  );

  if (!canViewSettings(perm) && !navItems.length) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>{t('settings.accessDenied')}</p>
      </div>
    );
  }

  function onSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!search.trim()) return;
    navigate(`/settings/search?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <div className={styles.layout} id="settings-region">
      <MaintenanceBanner />
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('settings.title')}</h1>
          <p className={styles.subtitle}>{t('settings.subtitle')}</p>
        </div>
        <form className={styles.toolbar} onSubmit={onSearchSubmit} role="search">
          <label className={styles.srOnly} htmlFor="settings-search">
            {t('settings.search.label')}
          </label>
          <input
            id="settings-search"
            className={styles.input}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('settings.search.placeholder')}
            aria-label={t('settings.search.label')}
          />
          <button type="submit" className={styles.searchButton} aria-label={t('settings.search.submit')}>
            <Search size={16} aria-hidden />
          </button>
        </form>
      </header>

      <div className={styles.grid}>
        <nav className={styles.nav} aria-label={t('settings.title')}>
          {favoriteItems.length > 0 && (
            <div className={styles.navGroup}>
              <p className={styles.navGroupLabel}>{t('settings.nav.favorites')}</p>
              {favoriteItems.map((item) => (
                <NavLink key={`fav-${item.id}`} to={item.to} end={item.to === '/settings'} className={styles.navLink}>
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </div>
          )}
          {recentItems.length > 0 && (
            <div className={styles.navGroup}>
              <p className={styles.navGroupLabel}>{t('settings.nav.recent')}</p>
              {recentItems.map((item) => (
                <NavLink key={`recent-${item.id}`} to={item.to} end={item.to === '/settings'} className={styles.navLink}>
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </div>
          )}
          {groups.map(([groupKey, items]) => (
            <div key={groupKey} className={styles.navGroup}>
              <p className={styles.navGroupLabel}>{t(groupKey)}</p>
              {items.map((item) =>
                item.external ? (
                  <Link key={item.id} to={item.to} className={styles.navLink}>
                    {t(item.labelKey)}
                  </Link>
                ) : (
                  <NavLink
                    key={item.id}
                    to={item.to}
                    end={item.to === '/settings'}
                    className={({ isActive }) =>
                      [
                        styles.navLink,
                        isActive ? styles.navLinkActive : '',
                        isSettingsNavLocked(item, entitlements.canUseFeature) ? styles.navLinkLocked : '',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    }
                  >
                    <span>{t(item.labelKey)}</span>
                    <button
                      type="button"
                      className={styles.favoriteBtn}
                      aria-label={t('settings.nav.toggleFavorite')}
                      aria-pressed={favorites.includes(item.to)}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFavorites(toggleFavorite(item.to));
                      }}
                    >
                      <Star size={14} fill={favorites.includes(item.to) ? 'currentColor' : 'none'} aria-hidden />
                    </button>
                    {isSettingsNavLocked(item, entitlements.canUseFeature) && (
                      <span className={styles.badgeLocked} aria-label={t('settings.nav.locked')}>
                        🔒
                      </span>
                    )}
                  </NavLink>
                ),
              )}
            </div>
          ))}
        </nav>

        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
