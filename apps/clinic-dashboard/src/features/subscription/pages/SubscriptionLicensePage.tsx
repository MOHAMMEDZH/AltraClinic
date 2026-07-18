import { useI18n } from '@booking/i18n/react';

import { AuthAlert } from '@/features/auth/components/AuthAlert';

import { formatLimit } from '../config/subscription-config';

import { useSubscriptionEntitlements } from '../hooks/useSubscriptionEntitlements';

import { useTenantLicense } from '../hooks/useSubscription';

import styles from '../subscription-layout.module.css';



export function SubscriptionLicensePage() {

  const { t, locale } = useI18n();

  const entitlements = useSubscriptionEntitlements();

  const licenseQuery = useTenantLicense();

  const license = licenseQuery.data ?? entitlements.license;

  const subscription = entitlements.subscription;

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  const grantHistory = license?.grantHistory ?? [];



  if (entitlements.isLoading || licenseQuery.isLoading) {

    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('subscription.loading')} />;

  }



  return (

    <div className={styles.page}>

      <header className={styles.pageHeader}>

        <div>

          <h2 className={styles.pageTitle}>{t('subscription.nav.license')}</h2>

          <p className={styles.pageSubtitle}>{t('subscription.license.subtitle')}</p>

        </div>

      </header>



      {licenseQuery.isError && <AuthAlert variant="error">{t('subscription.loadError')}</AuthAlert>}



      {license?.readOnly && (

        <AuthAlert variant="warning">{t('subscription.license.readOnlyBanner')}</AuthAlert>

      )}



      <section className={styles.kpiGrid}>

        <article className={styles.kpiCard}>

          <span className={styles.kpiLabel}>{t('subscription.license.plan')}</span>

          <strong className={styles.kpiValue}>{t(`subscription.plans.${entitlements.planId}`)}</strong>

        </article>

        <article className={styles.kpiCard}>

          <span className={styles.kpiLabel}>{t('subscription.license.status')}</span>

          <strong className={styles.kpiValue}>{license?.status ?? subscription?.status ?? 'ACTIVE'}</strong>

        </article>

        <article className={styles.kpiCard}>

          <span className={styles.kpiLabel}>{t('subscription.license.expires')}</span>

          <strong className={styles.kpiValue}>

            {license?.contractEndDate

              ? dateFormatter.format(new Date(license.contractEndDate))

              : license?.endDate

                ? dateFormatter.format(new Date(license.endDate))

                : '—'}

          </strong>

        </article>

        <article className={styles.kpiCard}>

          <span className={styles.kpiLabel}>{t('subscription.license.seats')}</span>

          <strong className={styles.kpiValue}>{formatLimit(entitlements.limits.maxUsers)}</strong>

        </article>

        <article className={styles.kpiCard}>

          <span className={styles.kpiLabel}>{t('subscription.license.billingCycle')}</span>

          <strong className={styles.kpiValue}>{license?.billingCycle ?? 'monthly'}</strong>

        </article>

        <article className={styles.kpiCard}>

          <span className={styles.kpiLabel}>{t('subscription.license.licenseId')}</span>

          <strong className={styles.kpiValueMono}>{license?.licenseId?.slice(0, 8) ?? '—'}…</strong>

        </article>

      </section>



      {entitlements.usageLimits.length > 0 && (

        <section className={styles.panel}>

          <h3 className={styles.sectionTitle}>{t('subscription.license.usage')}</h3>

          <ul className={styles.auditList}>

            {entitlements.usageLimits.map((row) => (

              <li key={row.resource} className={styles.kpiLabel}>

                <span>{row.resource}</span>

                <span>

                  {row.current} / {formatLimit(row.maximum)}

                  {row.critical && ` (${t('subscription.license.critical')})`}

                  {row.warning && !row.critical && ` (${t('subscription.license.warning')})`}

                </span>

              </li>

            ))}

          </ul>

        </section>

      )}



      <section className={styles.panel}>

        <h3 className={styles.sectionTitle}>{t('subscription.license.audit')}</h3>

        <ul className={styles.auditList}>

          {license?.startDate && (

            <li>

              {t('subscription.license.auditActivated')} — {dateFormatter.format(new Date(license.startDate))}

            </li>

          )}

          {entitlements.trialDaysRemaining > 0 && (

            <li>

              {t('subscription.license.auditTrial')} — {entitlements.trialDaysRemaining}{' '}

              {t('subscription.license.days')}

            </li>

          )}

          {entitlements.graceDaysRemaining > 0 && (

            <li>

              {t('subscription.license.auditGrace')} — {entitlements.graceDaysRemaining}{' '}

              {t('subscription.license.days')}

            </li>

          )}

          {grantHistory.map((grant) => (

            <li key={`${grant.at}-${grant.action}`}>

              {grant.action}

              {grant.plan ? `: ${grant.plan}` : ''}

              {grant.amount != null ? ` (${grant.amount})` : ''}

              {grant.days != null ? ` — ${grant.days} ${t('subscription.license.days')}` : ''}

              {grant.note ? ` — ${grant.note}` : ''} ({new Date(grant.at).toLocaleString(locale)})

            </li>

          ))}

        </ul>

      </section>

    </div>

  );

}

