/**
 * Release 47 Step 15 — Static commercial composition preview (no tenant apply).
 */
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../../layout/PageLayout';
import { Alert, EmptyState, Spinner } from '../../ui';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import { canPreviewComposition } from './addon-permissions';
import { StaticCommercialPreviewBanner } from './AddOnVersionTabNav';
import { STATIC_COMMERCIAL_PREVIEW_WARNING, type CompositionPreviewResult } from './addons-shared';

export function CompositionPreviewPage() {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;

  const canPreview = canPreviewComposition(principal);

  const [planVersionId, setPlanVersionId] = useState('');
  const [addonVersionIdsText, setAddonVersionIdsText] = useState('');
  const [overrideIdsText, setOverrideIdsText] = useState('');
  const [result, setResult] = useState<CompositionPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseIdList = useCallback((raw: string) => {
    return raw
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }, []);

  async function onPreview(e: FormEvent) {
    e.preventDefault();
    if (!canPreview || !planVersionId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const preview = await withAccessTokenRef.current((token) =>
        clientRef.current.previewPlatformCommercialComposition(token, {
          planVersionId: planVersionId.trim(),
          addonVersionIds: parseIdList(addonVersionIdsText),
          overrideIds: parseIdList(overrideIdsText),
        }),
      );
      setResult(preview as CompositionPreviewResult);
    } catch (err) {
      setResult(null);
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.composition.previewError', 'Unable to preview commercial composition.'),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setResult(null);
  }, [planVersionId, addonVersionIdsText, overrideIdsText]);

  if (!canPreview) {
    return (
      <PageLayout title={t('routes.compositionPreview.title', 'Composition preview')}>
        <Alert tone="warning">
          {t(
            'pages.composition.permissionLimited',
            'You need addon.view, override.view, or plan.view to preview composition.',
          )}
        </Alert>
      </PageLayout>
    );
  }

  const suppressed = result?.layers.overrideSuppressedCount ?? 0;

  return (
    <PageLayout
      title={t('routes.compositionPreview.title', 'Composition preview')}
      description={t(
        'routes.compositionPreview.description',
        'Static commercial composition of a plan version with optional add-ons and overrides.',
      )}
    >
      <p>
        <Link to="/add-ons">{t('pages.addons.backToList', 'Back to add-ons')}</Link>
        {' · '}
        <Link to="/commercial-overrides">{t('pages.overrides.backToList', 'Back to overrides')}</Link>
      </p>

      <StaticCommercialPreviewBanner />
      <Alert tone="info" title={t('pages.composition.boundaryTitle', 'Commercial definition only')}>
        {t(
          'pages.composition.boundaryBody',
          'This preview composes commercial definitions only. It does not call LicensingEngineService and does not change tenant runtime access. Assignment is Step 16.',
        )}
      </Alert>

      <form onSubmit={(e) => void onPreview(e)} className="sa-form" style={{ marginBlock: '1rem' }}>
        <label>
          {t('pages.composition.planVersionId', 'Plan version id')}
          <input
            className="sa-input"
            value={planVersionId}
            onChange={(e) => setPlanVersionId(e.target.value)}
            required
            dir="ltr"
          />
        </label>
        <label>
          {t('pages.composition.addonVersionIds', 'Add-on version ids (comma or space separated)')}
          <input
            className="sa-input"
            value={addonVersionIdsText}
            onChange={(e) => setAddonVersionIdsText(e.target.value)}
            dir="ltr"
          />
        </label>
        <label>
          {t('pages.composition.overrideIds', 'Override ids (comma or space separated)')}
          <input
            className="sa-input"
            value={overrideIdsText}
            onChange={(e) => setOverrideIdsText(e.target.value)}
            dir="ltr"
          />
        </label>
        <button type="submit" className="sa-button sa-button-primary" disabled={loading}>
          {loading
            ? t('pages.composition.previewing', 'Previewing…')
            : t('pages.composition.runPreview', 'Run preview')}
        </button>
      </form>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {loading ? <Spinner label={t('pages.composition.loading', 'Loading preview')} /> : null}

      {result ? (
        <div className="sa-composition-result">
          <Alert tone="warning" title={t('pages.composition.disclaimerTitle', 'Disclaimer')}>
            {result.disclaimer || t('pages.composition.staticWarning', STATIC_COMMERCIAL_PREVIEW_WARNING)}
          </Alert>

          <h2>{t('pages.composition.capabilitiesHeading', 'Capabilities')}</h2>
          {result.entitlements.length === 0 ? (
            <EmptyState title={t('pages.composition.noCapabilities', 'No capabilities in preview')} />
          ) : (
            <ul>
              {result.entitlements.map((key) => (
                <li key={key}>
                  <code dir="ltr">{key}</code>
                </li>
              ))}
            </ul>
          )}

          <h2>{t('pages.composition.limitsHeading', 'Limits')}</h2>
          {result.limits.length === 0 ? (
            <EmptyState title={t('pages.composition.noLimits', 'No limits in preview')} />
          ) : (
            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th scope="col">{t('pages.composition.col.key', 'Canonical key')}</th>
                    <th scope="col">{t('pages.composition.col.value', 'Value')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.limits.map((limit) => (
                    <tr key={limit.canonicalKey}>
                      <td>
                        <code dir="ltr">{limit.canonicalKey}</code>
                      </td>
                      <td>
                        {limit.unlimited
                          ? t('pages.composition.unlimited', 'Unlimited')
                          : (limit.valueText ?? '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2>{t('pages.composition.conflictsHeading', 'Conflicts / suppressions')}</h2>
          {suppressed === 0 ? (
            <p>{t('pages.composition.noConflicts', 'No override suppressions in this preview.')}</p>
          ) : (
            <p>
              {t('pages.composition.suppressedCount', 'Override suppressions applied: {count}').replace(
                '{count}',
                String(suppressed),
              )}
            </p>
          )}

          <dl className="sa-metadata">
            <dt>{t('pages.composition.layers.base', 'Base entitlements')}</dt>
            <dd>{result.layers.baseEntitlementCount}</dd>
            <dt>{t('pages.composition.layers.addonGranted', 'Add-on grants')}</dt>
            <dd>{result.layers.addonGrantedCount}</dd>
            <dt>{t('pages.composition.layers.overrideGranted', 'Override grants')}</dt>
            <dd>{result.layers.overrideGrantedCount}</dd>
            <dt>{t('pages.composition.layers.overrideSuppressed', 'Override suppressions')}</dt>
            <dd>{result.layers.overrideSuppressedCount}</dd>
            <dt>{t('pages.composition.runtimeEffective', 'Runtime effective')}</dt>
            <dd>{t('pages.composition.no', 'No')}</dd>
          </dl>
        </div>
      ) : null}
    </PageLayout>
  );
}
