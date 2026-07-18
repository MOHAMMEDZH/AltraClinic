import { Link, useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useSubscriptionEntitlements } from '@/features/subscription/hooks/useSubscriptionEntitlements';
import { filterSettingsNav } from '../config/settings-config';
import { searchSettings } from '../lib/settings-search';
import styles from '../settings-layout.module.css';

export function SettingsSearchPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  const { user } = useAuth();
  const entitlements = useSubscriptionEntitlements();
  const items = useMemo(
    () => filterSettingsNav(user?.roles ?? [], entitlements.canUseFeature),
    [user?.roles, entitlements.canUseFeature],
  );
  const results = useMemo(() => searchSettings(query, items), [query, items]);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('settings.search.resultsTitle')}</h2>
          <p className={styles.pageSubtitle}>
            {t('settings.search.resultsFor')}: {query || '—'}
          </p>
        </div>
      </header>

      <section className={styles.panel}>
        {results.length ? (
          <ul>
            {results.map((item) => (
              <li key={item.id} style={{ marginBlock: 'var(--space-3)' }}>
                <Link to={item.to}>
                  <strong>{t(item.labelKey)}</strong>
                </Link>
                <p className={styles.pageSubtitle}>{t(item.descriptionKey)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>{t('settings.search.noResults')}</p>
        )}
      </section>
    </div>
  );
}
