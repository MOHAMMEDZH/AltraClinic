import { useI18n } from '@booking/i18n/react';
import { Alert } from '../../ui';
import { deferredStepLabel, type PlanReadiness, type ReadinessSectionStatus } from './plans-shared';
import { PlanVersionPreviewBanner } from './PlanVersionTabNav';

type PlanVersionReadinessPanelProps = {
  readiness: PlanReadiness | null;
  loading?: boolean;
};

function sectionLabel(t: (key: string, fallback?: string) => string, id: string): string {
  const labels: Record<string, string> = {
    metadata: t('pages.plans.readiness.metadata', 'Metadata'),
    translations: t('pages.plans.readiness.translations', 'Translations'),
    entitlements: t('pages.plans.readiness.entitlements', 'Entitlements'),
    dependencies: t('pages.plans.readiness.dependencies', 'Dependencies'),
    compatibility: t('pages.plans.readiness.compatibility', 'Compatibility'),
    limits: t('pages.plans.readiness.limits', 'Limits'),
    catalogLifecycle: t('pages.plans.readiness.catalogLifecycle', 'Catalog lifecycle'),
    addOns: t('pages.plans.readiness.addOns', 'Add-ons'),
    overrides: t('pages.plans.readiness.overrides', 'Overrides'),
  };
  return labels[id] ?? id;
}

function statusText(
  t: (key: string, fallback?: string) => string,
  section: ReadinessSectionStatus,
): string {
  switch (section.status) {
    case 'ready':
      return t('pages.plans.readiness.statusReady', 'Ready');
    case 'not_ready':
      return t('pages.plans.readiness.statusNotReady', 'Not ready');
    case 'warning':
      return t('pages.plans.readiness.statusWarning', 'Warning');
    case 'permission_limited':
      return t('pages.plans.readiness.statusPermissionLimited', 'Permission limited');
    case 'unavailable':
      return section.reason
        ? deferredStepLabel(t, section.reason)
        : t('plansPage.unavailable', 'Unavailable');
    default:
      if ((section.status as string) === 'available') {
        return t('pages.plans.readiness.statusReady', 'Ready');
      }
      return section.status;
  }
}

export function PlanVersionReadinessPanel({ readiness, loading }: PlanVersionReadinessPanelProps) {
  const { t } = useI18n();

  if (loading) {
    return <p>{t('pages.plans.loading', 'Loading plan…')}</p>;
  }

  if (!readiness) {
    return (
      <Alert tone="info">
        {t(
          'pages.plans.readiness.unavailable',
          'Publication readiness is available for draft versions when you have plan-version.review.',
        )}
      </Alert>
    );
  }

  const sections = readiness.sections ?? {
    metadata: { status: readiness.metadataReady ? 'ready' : 'not_ready' },
    translations: {
      status: readiness.translationsReady ? 'ready' : readiness.metadataReady ? 'warning' : 'not_ready',
    },
    entitlements: {
      status:
        readiness.entitlementReadiness.status === 'unavailable'
          ? 'unavailable'
          : readiness.entitlementsReady
            ? 'ready'
            : 'not_ready',
      reason: readiness.entitlementReadiness.reason,
    },
    dependencies: {
      status: readiness.dependenciesReady ? 'ready' : 'warning',
    },
    compatibility: {
      status: readiness.compatibilityReady ? 'ready' : 'warning',
    },
    limits: {
      status: readiness.limitsReady ? 'ready' : 'not_ready',
    },
    catalogLifecycle: {
      status: readiness.catalogLifecycleReady ? 'ready' : 'warning',
    },
    addOns: readiness.addOns
      ? {
          status: readiness.addOns.status === 'available' ? 'ready' : 'unavailable',
          reason: readiness.addOns.reason,
          message: readiness.addOns.reason
            ? deferredStepLabel(t, readiness.addOns.reason)
            : undefined,
        }
      : {
          status: 'ready',
          reason: 'step_15_commercial_definition',
          message: deferredStepLabel(t, 'step_15_commercial_definition'),
        },
    overrides: readiness.overrides
      ? {
          status: readiness.overrides.status === 'available' ? 'ready' : 'unavailable',
          reason: readiness.overrides.reason,
          message: readiness.overrides.reason
            ? deferredStepLabel(t, readiness.overrides.reason)
            : undefined,
        }
      : {
          status: 'ready',
          reason: 'step_15_commercial_definition',
          message: deferredStepLabel(t, 'step_15_commercial_definition'),
        },
  };

  return (
    <section aria-labelledby="readiness-heading">
      <h2 id="readiness-heading">{t('pages.plans.version.readiness', 'Publication readiness')}</h2>
      <PlanVersionPreviewBanner />
      <p>
        {readiness.metadataReady && readiness.entitlementsReady !== false
          ? t('pages.plans.version.ready', 'Metadata ready to publish.')
          : t('pages.plans.version.notReady', 'Not ready to publish.')}
      </p>
      <dl className="sa-metadata">
        <dt>{t('pages.plans.readiness.subscriptionEligibility', 'Subscription eligibility')}</dt>
        <dd>{readiness.subscriptionEligibility ? t('plansPage.yes', 'Yes') : t('plansPage.no', 'No')}</dd>
        <dt>{t('pages.plans.readiness.runtimeEffective', 'Runtime effective')}</dt>
        <dd>{readiness.runtimeEffective ? t('plansPage.yes', 'Yes') : t('plansPage.no', 'No')}</dd>
      </dl>

      <h3>{t('pages.plans.readiness.sections', 'Readiness sections')}</h3>
      <div className="sa-table-wrap">
        <table className="sa-table">
          <thead>
            <tr>
              <th>{t('pages.plans.readiness.section', 'Section')}</th>
              <th>{t('pages.plans.readiness.status', 'Status')}</th>
              <th>{t('pages.plans.readiness.detail', 'Detail')}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(sections).map(([id, section]) => (
              <tr key={id}>
                <td>{sectionLabel(t, id)}</td>
                <td>{statusText(t, section)}</td>
                <td>
                  {section.message ??
                    (section.reason ? deferredStepLabel(t, section.reason) : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {readiness.blockers.length > 0 ? (
        <Alert tone="danger" title={t('pages.plans.version.blockers', 'Blockers')}>
          <ul>
            {readiness.blockers.map((b) => (
              <li key={b.code}>
                {b.section ? `[${b.section}] ` : ''}
                {b.message}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {readiness.warnings.length > 0 ? (
        <Alert tone="warning" title={t('pages.plans.version.warnings', 'Warnings')}>
          <ul>
            {readiness.warnings.map((w) => (
              <li key={w.code}>
                {w.section ? `[${w.section}] ` : ''}
                {w.message}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </section>
  );
}
