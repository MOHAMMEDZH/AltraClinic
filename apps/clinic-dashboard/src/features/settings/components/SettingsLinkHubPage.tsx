import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import styles from '../settings-layout.module.css';

interface SettingsLinkHubPageProps {
  titleKey: string;
  subtitleKey: string;
  links: Array<{ to: string; labelKey: string }>;
}

export function SettingsLinkHubPage({ titleKey, subtitleKey, links }: SettingsLinkHubPageProps) {
  const { t } = useI18n();
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t(titleKey)}</h2>
          <p className={styles.pageSubtitle}>{t(subtitleKey)}</p>
        </div>
      </header>
      <section className={styles.kpiGrid}>
        {links.map((link) => (
          <Link key={link.to} to={link.to} className={styles.kpiCard}>
            <strong>{t(link.labelKey)}</strong>
          </Link>
        ))}
      </section>
    </div>
  );
}
