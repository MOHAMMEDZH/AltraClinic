import { Bot, Globe, Menu, Moon, Search, Shield, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { useGlobalSearch } from '@/app/providers/GlobalSearchProvider';
import { useAiAssistant } from '@/features/ai/providers/AiAssistantProvider';
import { useTheme } from '@/app/providers/ThemeProvider';
import { useI18n } from '@booking/i18n/react';
import { NotificationBellPanel } from '@/features/notifications/components/NotificationBellPanel';
import styles from './TopNav.module.css';

interface TopNavProps {
  onOpenMobileNav: () => void;
}

export function TopNav({ onOpenMobileNav }: TopNavProps) {
  const { user, logout } = useAuth();
  const { open: openGlobalSearch } = useGlobalSearch();
  const { toggleSidebar, sidebarOpen } = useAiAssistant();
  const { t, locale, setLocale } = useI18n();
  const { isDark, toggle, mode, setMode } = useTheme();
  const nextLocale = locale === 'en-US' ? 'ar-SY' : 'en-US';
  const languageLabel = locale === 'en-US' ? t('shell.switchToArabic') : t('shell.switchToEnglish');

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.menuBtn}
        onClick={onOpenMobileNav}
        aria-label={t('shell.menu')}
      >
        <Menu size={20} />
      </button>

      <div className={styles.searchWrap}>
        <Search size={18} className={styles.searchIcon} aria-hidden />
        <input
          className={styles.searchInput}
          type="search"
          placeholder={t('shell.search')}
          aria-label={t('shell.search')}
          readOnly
          title={t('shell.searchShortcut')}
          onFocus={(e) => {
            openGlobalSearch();
            e.currentTarget.blur();
          }}
          onClick={() => openGlobalSearch()}
        />
      </div>

      <div className={styles.actions}>
        <NotificationBellPanel />

        <button
          type="button"
          className={styles.iconBtn}
          aria-label={t('ai.sidebar.title')}
          aria-expanded={sidebarOpen}
          aria-controls="ai-sidebar-panel"
          title={`${t('ai.sidebar.title')} (${t('ai.command.shortcutSidebar')})`}
          onClick={toggleSidebar}
        >
          <Bot size={18} />
        </button>

        <button
          type="button"
          className={styles.iconBtn}
          aria-label={`${t('shell.language')}: ${languageLabel}`}
          title={languageLabel}
          onClick={() => setLocale(nextLocale)}
        >
          <Globe size={18} />
          <span className={styles.langLabel}>{languageLabel}</span>
        </button>

        <button
          type="button"
          className={styles.iconBtn}
          aria-label={t('shell.theme')}
          onClick={toggle}
          onContextMenu={(e) => {
            e.preventDefault();
            setMode(mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system');
          }}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <Link
          to="/settings"
          className={styles.iconBtn}
          aria-label={t('shell.security')}
          title={t('settings.title')}
        >
          <Shield size={18} />
        </Link>

        <button type="button" className={styles.userBtn} aria-label={t('shell.userMenu')} onClick={() => void logout()}>
          <span className={styles.userLabel}>{user?.roles[0] ?? t('auth.login')}</span>
        </button>
      </div>
    </header>
  );
}
