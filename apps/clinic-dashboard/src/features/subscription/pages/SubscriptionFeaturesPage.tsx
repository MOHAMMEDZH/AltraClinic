import { useI18n } from '@booking/i18n/react';
import { FeatureGate } from '../components/FeatureGate';
import { FeatureMatrixTable } from '../components/FeatureMatrixTable';
import { useSubscriptionEntitlements } from '../hooks/useSubscriptionEntitlements';
import styles from '../subscription-layout.module.css';

export function SubscriptionFeaturesPage() {
  const { t } = useI18n();
  const entitlements = useSubscriptionEntitlements();

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('subscription.nav.features')}</h2>
          <p className={styles.pageSubtitle}>{t('subscription.features.subtitle')}</p>
        </div>
      </header>

      <FeatureMatrixTable currentPlanId={entitlements.planId} />

      <FeatureGate
        featureId="workflow"
        featureName={t('subscription.features.workflow')}
        benefits={[t('subscription.locked.benefitAutomation'), t('subscription.locked.benefitApprovals')]}
        preview
      >
        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>{t('subscription.features.workflowPreview')}</h3>
          <p className={styles.pageSubtitle}>{t('subscription.features.workflowPreviewHint')}</p>
        </section>
      </FeatureGate>
    </div>
  );
}
