import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { UsageMeter } from '../components/UsageMeter';
import { useSubscriptionUsage } from '../hooks/useSubscription';
import { useSubscriptionEntitlements } from '../hooks/useSubscriptionEntitlements';
import { formatSubscription } from '../lib/subscription-format';
import styles from '../subscription-layout.module.css';

export function SubscriptionAiUsagePage() {
  const { t, locale } = useI18n();
  const usage = useSubscriptionUsage();
  const entitlements = useSubscriptionEntitlements();
  const ai = usage.ai;
  const overview = usage.aiOverview;
  const provider = overview?.providerHealth?.activeProvider ?? overview?.providerStatus?.geminiConfigured ? 'gemini' : 'builtin';

  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const estimatedCost = ((ai?.tokensTodayTenant ?? 0) / 1000) * 0.002;

  if (usage.isLoading) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('subscription.loading')} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('subscription.nav.aiUsage')}</h2>
          <p className={styles.pageSubtitle}>{t('subscription.aiUsage.subtitle')}</p>
        </div>
        {entitlements.quotaExceeded && (
          <AuthButton>
            <Link to="/settings/subscription/plans">{t('subscription.actions.upgrade')}</Link>
          </AuthButton>
        )}
      </header>

      {usage.isError && <AuthAlert variant="error">{t('subscription.loadError')}</AuthAlert>}
      {entitlements.quotaExceeded && (
        <AuthAlert variant="warning">{t('subscription.aiUsage.quotaExceeded')}</AuthAlert>
      )}

      <section className={styles.kpiGrid}>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.aiUsage.provider')}</span>
          <strong className={styles.kpiValue}>{provider}</strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.aiUsage.estimatedCost')}</span>
          <strong className={styles.kpiValue}>{formatter.format(estimatedCost)}</strong>
        </article>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{t('subscription.aiUsage.successRate')}</span>
          <strong className={styles.kpiValue}>{overview?.successRate ?? 0}%</strong>
        </article>
      </section>

      <section className={styles.panel}>
        <UsageMeter
          label={t('subscription.usage.aiMessages')}
          current={ai?.messagesToday ?? 0}
          max={ai?.limits.maxMessagesPerUserPerDay ?? 0}
        />
        <UsageMeter
          label={t('subscription.usage.aiTokens')}
          current={ai?.tokensTodayTenant ?? 0}
          max={ai?.limits.maxTokensPerTenantPerDay ?? 0}
        />
        <p className={styles.kpiLabel}>
          {formatSubscription(t, 'subscription.aiUsage.recommendation', {
            plan: t(`subscription.plans.${entitlements.planId}`),
          })}
        </p>
      </section>
    </div>
  );
}
