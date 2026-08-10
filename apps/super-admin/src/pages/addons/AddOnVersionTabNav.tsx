import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import type { AddOnVersionPanel } from './addons-shared';
import { STATIC_COMMERCIAL_PREVIEW_WARNING } from './addons-shared';

type AddOnVersionTabNavProps = {
  addOnId: string;
  versionId: string;
  active: AddOnVersionPanel;
};

export function AddOnVersionTabNav({ addOnId, versionId, active }: AddOnVersionTabNavProps) {
  const { t } = useI18n();
  const base = `/add-ons/${addOnId}/versions/${versionId}`;

  const tabs: Array<{ id: AddOnVersionPanel; label: string; path: string }> = [
    { id: 'overview', label: t('pages.addons.version.tabs.overview', 'Overview'), path: base },
    {
      id: 'entitlements',
      label: t('pages.addons.version.tabs.entitlements', 'Entitlements'),
      path: `${base}/entitlements`,
    },
    { id: 'limits', label: t('pages.addons.version.tabs.limits', 'Limits'), path: `${base}/limits` },
    {
      id: 'applicability',
      label: t('pages.addons.version.tabs.applicability', 'Applicability'),
      path: `${base}/applicability`,
    },
    {
      id: 'readiness',
      label: t('pages.addons.version.tabs.readiness', 'Readiness'),
      path: `${base}/readiness`,
    },
    {
      id: 'compare',
      label: t('pages.addons.version.tabs.compare', 'Compare'),
      path: `${base}/compare`,
    },
  ];

  return (
    <nav aria-label={t('pages.addons.version.tabs.label', 'Add-on version sections')} className="sa-tab-nav">
      <ul className="sa-tab-list">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <Link
              className={active === tab.id ? 'sa-tab sa-tab-active' : 'sa-tab'}
              to={tab.path}
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

export function StaticCommercialPreviewBanner() {
  const { t } = useI18n();
  return (
    <p className="sa-boundary-notice" role="note" data-testid="static-commercial-preview-warning">
      {t('pages.composition.staticWarning', STATIC_COMMERCIAL_PREVIEW_WARNING)}
    </p>
  );
}
