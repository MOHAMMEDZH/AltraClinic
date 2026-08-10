import { useI18n } from '@booking/i18n/react';
import { Alert } from '../../ui';
import { deferredStepLabel, type PlanCompareResult } from './plans-shared';
import { PlanVersionPreviewBanner } from './PlanVersionTabNav';

type PlanVersionCompareDiffsProps = {
  compare: PlanCompareResult;
};

export function PlanVersionCompareDiffs({ compare }: PlanVersionCompareDiffsProps) {
  const { t } = useI18n();
  const entitlementDiff = compare.entitlementDiff;
  const limitDiff = compare.limitDiff;

  return (
    <>
      <PlanVersionPreviewBanner />
      <section aria-labelledby="compare-entitlements-heading">
        <h2 id="compare-entitlements-heading">{t('pages.plans.compare.entitlements', 'Entitlements')}</h2>
        {compare.entitlements.status === 'unavailable' && !entitlementDiff ? (
          <Alert tone="warning">
            {compare.entitlements.reason
              ? deferredStepLabel(t, compare.entitlements.reason)
              : t('plansPage.unavailable', 'Unavailable')}
          </Alert>
        ) : entitlementDiff?.status === 'available' ? (
          <div className="sa-table-wrap">
            <p>
              {t('pages.plans.compare.leftCount', 'Left count')}: {entitlementDiff.leftCount} ·{' '}
              {t('pages.plans.compare.rightCount', 'Right count')}: {entitlementDiff.rightCount}
            </p>
            <table className="sa-table">
              <thead>
                <tr>
                  <th>{t('pages.plans.compare.change', 'Change')}</th>
                  <th>{t('routes.catalog.col.key', 'Canonical key')}</th>
                </tr>
              </thead>
              <tbody>
                {entitlementDiff.added.map((key) => (
                  <tr key={`add-${key}`}>
                    <td>{t('pages.plans.compare.added', 'Added')}</td>
                    <td>
                      <code dir="ltr">{key}</code>
                    </td>
                  </tr>
                ))}
                {entitlementDiff.removed.map((key) => (
                  <tr key={`remove-${key}`}>
                    <td>{t('pages.plans.compare.removed', 'Removed')}</td>
                    <td>
                      <code dir="ltr">{key}</code>
                    </td>
                  </tr>
                ))}
                {entitlementDiff.unchanged.map((key) => (
                  <tr key={`same-${key}`}>
                    <td>{t('pages.plans.compare.unchanged', 'Unchanged')}</td>
                    <td>
                      <code dir="ltr">{key}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Alert tone="info">{t('pages.plans.compare.noEntitlementDiff', 'No entitlement diff data returned.')}</Alert>
        )}
      </section>

      <section aria-labelledby="compare-limits-heading" style={{ marginBlockStart: '1.5rem' }}>
        <h2 id="compare-limits-heading">{t('pages.plans.compare.limits', 'Limits')}</h2>
        {compare.limits.status === 'unavailable' && !limitDiff ? (
          <Alert tone="warning">
            {compare.limits.reason
              ? deferredStepLabel(t, compare.limits.reason)
              : t('plansPage.unavailable', 'Unavailable')}
          </Alert>
        ) : limitDiff?.status === 'available' && limitDiff.entries.length > 0 ? (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>{t('routes.catalog.col.displayName', 'Display name')}</th>
                  <th>
                    v{compare.left.versionNumber} ({compare.left.lifecycle})
                  </th>
                  <th>
                    v{compare.right.versionNumber} ({compare.right.lifecycle})
                  </th>
                </tr>
              </thead>
              <tbody>
                {limitDiff.entries.map((entry) => (
                  <tr key={entry.canonicalKey} className={entry.changed ? 'sa-row-changed' : undefined}>
                    <td>
                      {entry.displayName}{' '}
                      <code dir="ltr">{entry.canonicalKey}</code>
                    </td>
                    <td>{entry.leftLabel}</td>
                    <td>{entry.rightLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Alert tone="info">{t('pages.plans.compare.noLimitDiff', 'No limit diff data returned.')}</Alert>
        )}
      </section>
    </>
  );
}
