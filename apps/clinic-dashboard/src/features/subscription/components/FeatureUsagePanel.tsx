import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import { FEATURE_MATRIX, type SubscriptionPlanId } from '../config/subscription-config';
import styles from '../subscription-layout.module.css';

interface FeatureUsagePanelProps {
  planId: SubscriptionPlanId;
}

export function FeatureUsagePanel({ planId }: FeatureUsagePanelProps) {
  const { t } = useI18n();

  const rows = useMemo(
    () =>
      FEATURE_MATRIX.filter((row) => {
        const state = row.plans[planId];
        return state === 'enabled' || state === 'limited';
      }).slice(0, 8),
    [planId],
  );

  return (
    <section className={styles.panel} aria-labelledby="feature-usage-title">
      <h3 id="feature-usage-title" className={styles.panelTitle}>
        {t('subscription.featureUsage.title')}
      </h3>
      <ul className={styles.featureUsageList}>
        {rows.map((row) => (
          <li key={row.id} className={styles.featureUsageItem}>
            <span>{t(row.labelKey as 'subscription.features.dashboard')}</span>
            <span className={row.plans[planId] === 'limited' ? styles.badgeLimited : styles.badgeEnabled}>
              {t(`subscription.features.state.${row.plans[planId]}`)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
