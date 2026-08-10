/**
 * Release 47 Step 13 — Plans list page.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../../layout/PageLayout';
import { Alert, EmptyState, Spinner, StatusBadge } from '../../ui';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { hasPermission } from '../../auth/permissions';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import { planLifecycleTone, type PlanListRow } from './plans-shared';

export function PlansListPage() {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;

  const canView = hasPermission(principal, 'plan.view');
  const canCreate = hasPermission(principal, 'plan.create');
  const searchId = useId();

  const [items, setItems] = useState<PlanListRow[]>([]);
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
        clientRef.current.listPlatformPlans(token, {
          search: search || undefined,
          lifecycle: lifecycle || undefined,
          page: 1,
          pageSize: 50,
        }),
      );
      setItems(res.items as PlanListRow[]);
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : t('plansPage.loadError'));
    } finally {
      setLoading(false);
    }
  }, [canView, search, lifecycle, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <PageLayout title={t('routes.plans.title')}>
        <Alert tone="warning">{t('plansPage.permissionLimited')}</Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={t('routes.plans.title')}
      description={t('routes.plans.description')}
      actions={
        <>
          {canCreate ? (
            <Link className="sa-button sa-button-primary" to="/plans/new">
              {t('plansPage.create')}
            </Link>
          ) : null}
          <Link className="sa-button" to="/plans/legacy-mappings">
            {t('plansPage.legacyMappings')}
          </Link>
        </>
      }
    >
      <Alert tone="info" title={t('plansPage.boundaryTitle')}>
        {t('plansPage.boundaryBody')}
      </Alert>

      <div
        className="sa-toolbar"
        style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBlock: '1rem' }}
      >
        <label htmlFor={searchId}>
          <span className="sa-visually-hidden">{t('plansPage.searchLabel')}</span>
          <input
            id={searchId}
            className="sa-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('plansPage.searchLabel')}
          />
        </label>
        <select
          className="sa-select"
          value={lifecycle}
          onChange={(e) => setLifecycle(e.target.value)}
          aria-label={t('plansPage.lifecycleFilter')}
        >
          <option value="">{t('plansPage.allLifecycles')}</option>
          <option value="DRAFT">DRAFT</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
        <button type="button" className="sa-button" onClick={() => void load()}>
          {t('plansPage.refresh')}
        </button>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {loading ? (
        <Spinner label={t('plansPage.loading')} />
      ) : items.length === 0 ? (
        <EmptyState title={t('plansPage.empty')} />
      ) : (
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th scope="col">{t('plansPage.col.name')}</th>
                <th scope="col">{t('plansPage.col.key')}</th>
                <th scope="col">{t('plansPage.col.lifecycle')}</th>
                <th scope="col">{t('plansPage.col.draft')}</th>
                <th scope="col">{t('plansPage.col.legacyCount')}</th>
                <th scope="col">{t('plansPage.col.versionSubscribers')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/plans/${row.id}`}>{row.displayName}</Link>
                  </td>
                  <td>
                    <code dir="ltr">{row.canonicalKey}</code>
                  </td>
                  <td>
                    <StatusBadge label={row.lifecycle} tone={planLifecycleTone(row.lifecycle)} />
                  </td>
                  <td>{row.hasOpenDraft ? t('plansPage.yes') : t('plansPage.no')}</td>
                  <td>{row.legacyAssignmentCount ?? 0}</td>
                  <td>{t('plansPage.unavailable')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageLayout>
  );
}
