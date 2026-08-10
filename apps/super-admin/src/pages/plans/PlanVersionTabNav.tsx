import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import type { PlanVersionDetailTab } from './plans-shared';

type PlanVersionTabNavProps = {
  planId: string;
  versionId: string;
  active: PlanVersionDetailTab;
  canEntitlements: boolean;
  canLimits: boolean;
  canReadiness: boolean;
};

export function PlanVersionTabNav({
  planId,
  versionId,
  active,
  canEntitlements,
  canLimits,
  canReadiness,
}: PlanVersionTabNavProps) {
  const { t } = useI18n();
  const base = `/plans/${planId}/versions/${versionId}`;

  const tabs: Array<{ id: PlanVersionDetailTab; label: string; visible: boolean }> = [
    { id: 'overview', label: t('pages.plans.version.tabs.overview', 'Overview'), visible: true },
    {
      id: 'entitlements',
      label: t('pages.plans.version.tabs.entitlements', 'Entitlements'),
      visible: canEntitlements,
    },
    { id: 'limits', label: t('pages.plans.version.tabs.limits', 'Limits'), visible: canLimits },
    {
      id: 'readiness',
      label: t('pages.plans.version.tabs.readiness', 'Readiness'),
      visible: canReadiness,
    },
  ];

  return (
    <nav aria-label={t('pages.plans.version.tabs.label', 'Plan version sections')} className="sa-tab-nav">
      <ul className="sa-tab-list">
        {tabs
          .filter((tab) => tab.visible)
          .map((tab) => (
            <li key={tab.id}>
              <Link
                className={active === tab.id ? 'sa-tab sa-tab-active' : 'sa-tab'}
                to={tab.id === 'overview' ? base : `${base}?tab=${tab.id}`}
                aria-current={active === tab.id ? 'page' : undefined}
              >
                {tab.label}
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
}

export function PlanVersionPreviewBanner() {
  const { t } = useI18n();
  return (
    <p className="sa-boundary-notice" role="note">
      {t(
        'pages.plans.version.previewDisclaimer',
        'Commercial Plan Version definition only — not tenant runtime licensing or provisioning.',
      )}
    </p>
  );
}

export function PlanVersionLegacyUnconfiguredNotice({ onClone }: { onClone?: () => void }) {
  const { t } = useI18n();
  return (
    <aside className="sa-callout" role="note">
      <p>
        {t(
          'pages.plans.version.legacyUnconfigured',
          'This published version has metadata only — entitlements and limits were never configured. Clone to a draft to define commercial grants.',
        )}
      </p>
      {onClone ? (
        <button type="button" className="sa-button" onClick={onClone}>
          {t('pages.plans.version.clone', 'Clone to draft')}
        </button>
      ) : null}
    </aside>
  );
}
