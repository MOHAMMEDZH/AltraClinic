import type { ReactNode } from 'react';
import { Activity, Globe, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/app/providers/ThemeProvider';
import { useI18n } from '@booking/i18n/react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const { t, locale, setLocale } = useI18n();
  const { isDark, toggle } = useTheme();
  const online = useOnlineStatus();
  const nextLocale = locale === 'en-US' ? 'ar-SY' : 'en-US';
  const languageLabel = locale === 'en-US' ? t('shell.switchToArabic') : t('shell.switchToEnglish');

  return (
    <div className={styles.layout}>
      <aside className={styles.brandPanel} aria-hidden="true">
        <div className={styles.brandGlow} />
        <div className={styles.brandLogo}>
          <span className={styles.brandIcon}>
            <Activity size={22} strokeWidth={2.2} />
          </span>
          <span>{t('app.name')}</span>
        </div>
        <div>
          <h2 className={styles.brandHeadline}>{t('auth.brandHeadline')}</h2>
          <p className={styles.brandCopy}>{t('auth.brandCopy')}</p>
          <ul className={styles.trustList}>
            <li className={styles.trustItem}>
              <span className={styles.trustDot} />
              {t('auth.trustSecure')}
            </li>
            <li className={styles.trustItem}>
              <span className={styles.trustDot} />
              {t('auth.trustCompliant')}
            </li>
            <li className={styles.trustItem}>
              <span className={styles.trustDot} />
              {t('auth.trustMultiTenant')}
            </li>
          </ul>
        </div>
      </aside>

      <div className={styles.formPanel}>
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.toolbarBtn}
            aria-label={`${t('shell.language')}: ${languageLabel}`}
            title={languageLabel}
            onClick={() => setLocale(nextLocale)}
          >
            <Globe size={18} />
            <span className="sr-only">{languageLabel}</span>
          </button>
          <button
            type="button"
            className={styles.toolbarBtn}
            aria-label={t('shell.theme')}
            onClick={toggle}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {!online && (
          <p className={styles.offlineBanner} role="status">
            {t('auth.offline')}
          </p>
        )}

        <main className={styles.formContent} id="auth-main">
          <div className={styles.card}>
            <header className={styles.cardHeader}>
              <h1 className={styles.cardTitle}>{title}</h1>
              {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
            </header>
            <div className={styles.cardBody}>{children}</div>
          </div>
        </main>

        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>
  );
}
