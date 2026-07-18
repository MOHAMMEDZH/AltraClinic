import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { filterSettingsNav } from '../config/settings-config';
import { useSettingsOverview } from '../hooks/useSettings';
import { useAuth } from '@/app/providers/AuthProvider';
import { useSubscriptionEntitlements } from '@/features/subscription/hooks/useSubscriptionEntitlements';
import styles from '../settings-layout.module.css';

export function SettingsHomePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const overview = useSettingsOverview();
  const entitlements = useSubscriptionEntitlements();
  const quickLinks = filterSettingsNav(user?.roles ?? [], entitlements.canUseFeature).filter(
    (item) => item.id !== 'home',
  );

  if (overview.isLoading) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('settings.loading')} />;
  }

  const data = overview.data;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('settings.home.title')}</h2>
          <p className={styles.pageSubtitle}>{t('settings.home.subtitle')}</p>
        </div>
      </header>

      {overview.isError && <AuthAlert variant="error">{t('settings.loadError')}</AuthAlert>}

      <section className={styles.kpiGrid} aria-label={t('settings.home.health')}>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('settings.home.setupProgress')}</span>
          <strong className={styles.kpiValue}>{data?.setupProgress ?? 0}%</strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('settings.home.health')}</span>
          <strong className={styles.kpiValue}>{t(`settings.home.health.${data?.health ?? 'good'}`)}</strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('settings.home.branches')}</span>
          <strong className={styles.kpiValue}>{data?.counts.branches ?? 0}</strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('settings.home.users')}</span>
          <strong className={styles.kpiValue}>{data?.counts.users ?? 0}</strong>
        </article>
      </section>

      {(data?.alerts.length ?? 0) > 0 && (
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>{t('settings.home.alerts')}</h3>
          <ul className={styles.auditList}>
            {data?.alerts.map((alert) => (
              <li key={alert.id}>
                <AuthAlert variant={alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info'}>
                  {t(alert.messageKey)}{' '}
                  {alert.route && (
                    <Link to={alert.route}>{t('settings.home.fixNow')}</Link>
                  )}
                </AuthAlert>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>{t('settings.home.quickLinks')}</h3>
        <div className={styles.kpiGrid}>
          {quickLinks.slice(0, 8).map((item) => (
            <Link key={item.id} to={item.to} className={styles.kpiCard}>
              <strong>{t(item.labelKey)}</strong>
              <span className={styles.kpiLabel}>{t(item.descriptionKey)}</span>
            </Link>
          ))}
        </div>
      </section>

      {(data?.recentChanges.length ?? 0) > 0 && (
        <section className={styles.panel} aria-labelledby="settings-recent">
          <h3 id="settings-recent" className={styles.panelTitle}>
            {t('settings.home.recentChanges')}
          </h3>
          <ul className={styles.auditList}>
            {data?.recentChanges.map((change) => (
              <li key={change.at}>
                <time dateTime={change.at}>{new Date(change.at).toLocaleString()}</time>
                {' — '}
                {change.sections.join(', ')}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
