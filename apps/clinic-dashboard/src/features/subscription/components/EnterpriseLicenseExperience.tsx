import { Link } from 'react-router-dom';
import { Activity, LogOut, ShieldAlert } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { getLicenseGateReasonKey } from '@/lib/license-gate';
import { useSubscriptionEntitlements } from '../hooks/useSubscriptionEntitlements';
import { useTenantSubscription } from '../hooks/useSubscription';
import { formatSubscription } from '../lib/subscription-format';
import styles from './enterprise-license-experience.module.css';

const STATUS_CLASS: Record<string, string> = {
  expired: styles.statusExpired,
  suspended: styles.statusSuspended,
  cancelled: styles.statusCancelled,
  grace: styles.statusGrace,
  graceExpired: styles.statusExpired,
  unverified: styles.statusUnverified,
};

export function EnterpriseLicenseExperience() {
  const { t, locale } = useI18n();
  const { user, logout } = useAuth();
  const entitlements = useSubscriptionEntitlements();
  const tenantSubscription = useTenantSubscription();

  if (entitlements.isLoading) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('subscription.loading')} />;
  }

  const license = entitlements.license;
  const tenantOverview = tenantSubscription.data;
  const subscription = tenantOverview ?? entitlements.subscription;
  const reasonKey = getLicenseGateReasonKey({
    entitlementsVerified: entitlements.entitlementsVerified,
    safeMode: entitlements.safeMode,
    licenseStatus: license?.status,
    gracePeriodEndsAt: license?.gracePeriodEndsAt,
  });
  const statusLabel = license?.status ?? subscription?.status ?? reasonKey;
  const planId = entitlements.planId;
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const expirationDate =
    license?.contractEndDate ??
    license?.endDate ??
    license?.gracePeriodEndsAt ??
    subscription?.endDate ??
    null;

  return (
    <div className={styles.page} data-testid="enterprise-license-experience">
      <aside className={styles.brandPanel} aria-hidden="true">
        <div className={styles.brandGlow} />
        <div className={styles.brandLogo}>
          <span className={styles.brandIcon}>
            <Activity size={22} strokeWidth={2.2} />
          </span>
          <span>{t('app.name')}</span>
        </div>
        <div>
          <h2 className={styles.brandHeadline}>{t('subscription.licenseGate.brandHeadline')}</h2>
          <p className={styles.brandCopy}>{t('subscription.licenseGate.brandCopy')}</p>
        </div>
      </aside>

      <div className={styles.main}>
        <div className={styles.toolbar}>
          <AuthButton variant="secondary" onClick={() => void logout()}>
            <LogOut size={16} aria-hidden style={{ marginInlineEnd: 8 }} />
            {t('auth.logout')}
          </AuthButton>
        </div>

        <div className={styles.content}>
          <span className={[styles.statusBadge, STATUS_CLASS[reasonKey] ?? styles.statusUnverified].join(' ')}>
            <ShieldAlert size={14} aria-hidden />
            {formatSubscription(t, `subscription.licenseGate.status.${reasonKey}`, { status: statusLabel })}
          </span>

          <h1 className={styles.title}>{t('subscription.licenseGate.title')}</h1>
          <p className={styles.subtitle}>{t(`subscription.licenseGate.reason.${reasonKey}`)}</p>

          {(license?.readOnly || reasonKey === 'grace' || reasonKey === 'suspended') && (
            <div className={styles.readOnlyBanner}>{t('subscription.licenseGate.readOnlyExplanation')}</div>
          )}

          <section className={styles.orgCard} aria-labelledby="license-org-title">
            <span id="license-org-title" className={styles.orgLabel}>
              {t('subscription.licenseGate.organization')}
            </span>
            <p className={styles.orgValue}>{tenantOverview?.displayName ?? user?.tenantId ?? '—'}</p>
            <div className={styles.orgMeta}>
              {user?.email && (
                <span>{formatSubscription(t, 'subscription.licenseGate.signedInAs', { email: user.email })}</span>
              )}
              {user?.tenantId && (
                <span>{formatSubscription(t, 'subscription.licenseGate.tenantId', { tenantId: user.tenantId })}</span>
              )}
            </div>
          </section>

          <div className={styles.kpiGrid}>
            <article className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{t('subscription.license.plan')}</span>
              <strong className={styles.kpiValue}>{t(`subscription.plans.${planId}`)}</strong>
            </article>
            <article className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{t('subscription.license.status')}</span>
              <strong className={styles.kpiValue}>{statusLabel}</strong>
            </article>
            <article className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{t('subscription.license.expires')}</span>
              <strong className={styles.kpiValue}>
                {expirationDate ? dateFormatter.format(new Date(expirationDate)) : '—'}
              </strong>
            </article>
          </div>

          <section className={styles.detailCard}>
            <h2 className={styles.kpiLabel}>{t('subscription.licenseGate.renewalOptions')}</h2>
            <ul className={styles.supportList}>
              <li>{t('subscription.licenseGate.renewalComparePlans')}</li>
              <li>{t('subscription.licenseGate.renewalContactSales')}</li>
              <li>{t('subscription.licenseGate.renewalContactAdmin')}</li>
            </ul>
            <div className={styles.actions}>
              <Link to="/settings/subscription/plans" className={styles.actionLinkPrimary}>
                {t('subscription.licenseGate.viewPlans')}
              </Link>
              <Link to="/settings/subscription/license" className={styles.actionLink}>
                {t('subscription.nav.license')}
              </Link>
              <AuthButton variant="secondary" onClick={() => window.open('mailto:sales@clinic.example', '_blank')}>
                {t('subscription.locked.contactSales')}
              </AuthButton>
              <AuthButton variant="secondary" onClick={() => window.open('mailto:admin@clinic.example', '_blank')}>
                {t('subscription.licenseGate.contactAdministrator')}
              </AuthButton>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
