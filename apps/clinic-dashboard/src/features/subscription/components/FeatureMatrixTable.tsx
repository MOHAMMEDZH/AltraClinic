import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import {
  FEATURE_MATRIX,
  type FeatureMatrixState,
  type SubscriptionPlanId,
} from '../config/subscription-config';
import styles from '../subscription-layout.module.css';

const PLAN_IDS: SubscriptionPlanId[] = ['starter', 'professional', 'business', 'enterprise'];

function badgeClass(state: FeatureMatrixState): string {
  if (state === 'enabled') return styles.badgeEnabled;
  if (state === 'limited') return styles.badgeLimited;
  if (state === 'upgrade') return styles.badgeUpgrade;
  return styles.badgeDisabled;
}

interface FeatureMatrixTableProps {
  currentPlanId: SubscriptionPlanId;
  highlightUpgrades?: boolean;
}

export function FeatureMatrixTable({ currentPlanId, highlightUpgrades = true }: FeatureMatrixTableProps) {
  const { t } = useI18n();

  const rows = useMemo(() => FEATURE_MATRIX, []);

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>{t('subscription.features.matrixCaption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('subscription.features.columnFeature')}</th>
            {PLAN_IDS.map((planId) => (
              <th key={planId} scope="col">
                {t(`subscription.plans.${planId}`)}
                {planId === currentPlanId ? ` (${t('subscription.current')})` : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{t(row.labelKey as 'subscription.features.dashboard')}</th>
              {PLAN_IDS.map((planId) => {
                const state = row.plans[planId];
                const emphasize = highlightUpgrades && planId === currentPlanId && state === 'upgrade';
                return (
                  <td key={planId}>
                    <span className={badgeClass(state)}>
                      {t(`subscription.features.state.${state}`)}
                    </span>
                    {emphasize && (
                      <span className={styles.kpiLabel} style={{ display: 'block', marginTop: 4 }}>
                        {t('subscription.features.upgradeRequired')}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
