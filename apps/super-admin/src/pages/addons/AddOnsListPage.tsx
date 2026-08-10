/**
 * Release 47 Step 15 — Add-ons list.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../../layout/PageLayout';
import { Alert, EmptyState, Spinner, StatusBadge } from '../../ui';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import { canManageAddOns, canViewAddOns } from './addon-permissions';
import { addOnDisplayName, addOnLifecycleTone, type AddOnSummary } from './addons-shared';

export function AddOnsListPage() {
  const { t, locale } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;

  const canView = canViewAddOns(principal);
  const canManage = canManageAddOns(principal);
  const searchId = useId();

  const [items, setItems] = useState<AddOnSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await withAccessTokenRef.current((token) =>
        clientRef.current.listPlatformAddOns(token, {
          search: search || undefined,
          lifecycle: lifecycle || undefined,
          page: 1,
          pageSize: 50,
        }),
      );
      setItems(res.items as AddOnSummary[]);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.addons.loadError', 'Unable to load add-ons.'),
      );
    } finally {
      setLoading(false);
    }
  }, [canView, search, lifecycle, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <PageLayout title={t('routes.addOns.title', 'Add-ons')}>
        <Alert tone="warning">
          {t('pages.addons.permissionLimited', 'You do not have addon.view permission.')}
        </Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={t('routes.addOns.title', 'Add-ons')}
      description={t('routes.addOns.description', 'Commercial add-on definitions (not tenant assignment).')}
      actions={
        <>
          {canManage ? (
            <Link className="sa-button sa-button-primary" to="/add-ons/new">
              {t('pages.addons.create', 'Create add-on')}
            </Link>
          ) : null}
          <Link className="sa-button" to="/commercial-composition/preview">
            {t('pages.addons.compositionPreview', 'Composition preview')}
          </Link>
        </>
      }
    >
      <Alert tone="info" title={t('pages.addons.boundaryTitle', 'Commercial definition only')}>
        {t(
          'pages.addons.boundaryBody',
          'Add-ons define commercial packages. Tenant runtime access is unchanged until subscription assignment (Step 16).',
        )}
      </Alert>

      <div
        className="sa-toolbar"
        style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBlock: '1rem' }}
      >
        <label htmlFor={searchId}>
          <span className="sa-visually-hidden">{t('pages.addons.searchLabel', 'Search add-ons')}</span>
          <input
            id={searchId}
            className="sa-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('pages.addons.searchLabel', 'Search add-ons')}
          />
        </label>
        <select
          className="sa-select"
          value={lifecycle}
          onChange={(e) => setLifecycle(e.target.value)}
          aria-label={t('pages.addons.lifecycleFilter', 'Lifecycle filter')}
        >
          <option value="">{t('pages.addons.allLifecycles', 'All lifecycles')}</option>
          <option value="DRAFT">DRAFT</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
        <button type="button" className="sa-button" onClick={() => void load()}>
          {t('pages.addons.refresh', 'Refresh')}
        </button>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {loading ? (
        <Spinner label={t('pages.addons.loading', 'Loading add-ons')} />
      ) : items.length === 0 ? (
        <EmptyState title={t('pages.addons.empty', 'No add-ons')} />
      ) : (
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th scope="col">{t('pages.addons.col.name', 'Name')}</th>
                <th scope="col">{t('pages.addons.col.key', 'Canonical key')}</th>
                <th scope="col">{t('pages.addons.col.lifecycle', 'Lifecycle')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/add-ons/${row.id}`}>{addOnDisplayName(row, locale)}</Link>
                  </td>
                  <td>
                    <code dir="ltr">{row.canonicalKey}</code>
                  </td>
                  <td>
                    <StatusBadge label={row.lifecycle} tone={addOnLifecycleTone(row.lifecycle)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageLayout>
  );
}
