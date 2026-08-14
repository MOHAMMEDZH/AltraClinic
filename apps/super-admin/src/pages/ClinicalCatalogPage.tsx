/**
 * Phase 48 Wave A — Platform clinical procedure catalog (SYSTEM_CANONICAL).
 * Separate from Healthcare Catalog (/catalog).
 */
import { FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../layout/PageLayout';
import { Alert, EmptyState, Spinner, StatusBadge } from '../ui';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { hasPermission } from '../auth/permissions';
import {
  PlatformAuthApiError,
  type ClinicalCatalogServiceDetail,
} from '../auth/platform-auth-api';

function tr(
  service: ClinicalCatalogServiceDetail,
  locale: string,
): string {
  return service.translations.find((t) => t.locale === locale)?.displayName ?? '';
}

export function ClinicalCatalogPage() {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const formId = useId();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;

  const canAdmin = hasPermission(principal, 'clinical_catalog.admin');

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [items, setItems] = useState<ClinicalCatalogServiceDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [stableKey, setStableKey] = useState('');
  const [displayNameEn, setDisplayNameEn] = useState('');
  const [displayNameAr, setDisplayNameAr] = useState('');

  const reloadList = useCallback(() => {
    if (!canAdmin) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void withAccessTokenRef
      .current((token) =>
        clientRef.current.listClinicalCatalogServices(token, {
          provenance: 'SYSTEM_CANONICAL',
          lifecycle: lifecycle || undefined,
          search: appliedSearch || undefined,
        }),
      )
      .then((res) => {
        if (!cancelled) setItems(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof PlatformAuthApiError
              ? err.message
              : t('routes.clinicalCatalog.loadError', 'Unable to load clinical services.'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canAdmin, appliedSearch, lifecycle, t]);

  useEffect(() => reloadList(), [reloadList]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setAppliedSearch(search.trim());
  }

  async function runLifecycle(
    id: string,
    action: 'publish' | 'deprecate' | 'inactivate',
  ) {
    if (!canAdmin || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const api =
        action === 'publish'
          ? client.publishClinicalCatalogService
          : action === 'deprecate'
            ? client.deprecateClinicalCatalogService
            : client.inactivateClinicalCatalogService;
      await withAccessToken((token) => api.call(client, token, id));
      reloadList();
    } catch (err: unknown) {
      setFormError(err instanceof PlatformAuthApiError ? err.message : 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    if (!canAdmin || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await withAccessToken((token) =>
        client.createClinicalCatalogServiceDraft(token, {
          provenance: 'SYSTEM_CANONICAL',
          stableKey: stableKey.trim(),
          translations: [
            { locale: 'en', displayName: displayNameEn.trim() },
            { locale: 'ar', displayName: displayNameAr.trim() },
          ],
        }),
      );
      setStableKey('');
      setDisplayNameEn('');
      setDisplayNameAr('');
      setShowCreate(false);
      reloadList();
    } catch (err: unknown) {
      setFormError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('routes.clinicalCatalog.createError', 'Unable to create clinical service.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!canAdmin) {
    return (
      <PageLayout
        title={t('routes.clinicalCatalog.title', 'Clinical Services')}
        description={t('routes.clinicalCatalog.description', 'Clinical procedure catalog')}
      >
        <Alert tone="warning">
          {t('routes.clinicalCatalog.permissionLimited', 'Permission limited')}
        </Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={t('routes.clinicalCatalog.title', 'Clinical Services')}
      description={t(
        'routes.clinicalCatalog.description',
        'Platform canonical clinical procedures for tenant catalogs.',
      )}
    >
      <Alert tone="info" title={t('routes.clinicalCatalog.boundaryTitle', 'Clinical catalog only')}>
        {t(
          'routes.clinicalCatalog.boundaryBody',
          'This is the clinical procedure catalog (Wave A). It is separate from the Healthcare Catalog metadata at /catalog.',
        )}
      </Alert>

      <form className="sa-filter-row" onSubmit={onSearch}>
        <label className="sa-field" htmlFor={`${formId}-search`}>
          {t('routes.clinicalCatalog.searchLabel', 'Search')}{' '}
          <input
            id={`${formId}-search`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={64}
            dir="ltr"
          />
        </label>
        <label className="sa-field" htmlFor={`${formId}-lifecycle`}>
          {t('routes.clinicalCatalog.lifecycleFilter', 'Lifecycle')}{' '}
          <select
            id={`${formId}-lifecycle`}
            value={lifecycle}
            onChange={(e) => setLifecycle(e.target.value)}
          >
            <option value="">{t('routes.clinicalCatalog.allLifecycles', 'All')}</option>
            <option value="DRAFT">DRAFT</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="DEPRECATED">DEPRECATED</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>
        <button type="submit" className="sa-button">
          {t('routes.clinicalCatalog.searchButton', 'Search')}
        </button>
        <button type="button" className="sa-button" onClick={() => setShowCreate((v) => !v)}>
          {t('routes.clinicalCatalog.create', 'Create draft')}
        </button>
      </form>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      {showCreate ? (
        <section className="sa-section" aria-labelledby={`${formId}-create-heading`}>
          <h2 id={`${formId}-create-heading`}>
            {t('routes.clinicalCatalog.create', 'Create draft')}
          </h2>
          <form onSubmit={submitCreate} className="sa-form" noValidate>
            <label className="sa-field" htmlFor={`${formId}-key`}>
              {t('routes.clinicalCatalog.stableKeyLabel', 'Stable key')}{' '}
              <input
                id={`${formId}-key`}
                dir="ltr"
                value={stableKey}
                onChange={(e) => setStableKey(e.target.value)}
                placeholder="canonical.general.consultation"
                required
              />
            </label>
            <label className="sa-field" htmlFor={`${formId}-en`}>
              {t('routes.clinicalCatalog.displayNameEn', 'Display name (en)')}{' '}
              <input
                id={`${formId}-en`}
                value={displayNameEn}
                onChange={(e) => setDisplayNameEn(e.target.value)}
                required
              />
            </label>
            <label className="sa-field" htmlFor={`${formId}-ar`}>
              {t('routes.clinicalCatalog.displayNameAr', 'Display name (ar)')}{' '}
              <input
                id={`${formId}-ar`}
                value={displayNameAr}
                onChange={(e) => setDisplayNameAr(e.target.value)}
                required
                dir="rtl"
              />
            </label>
            <div className="sa-filter-row">
              <button type="submit" className="sa-button" disabled={submitting}>
                {submitting
                  ? t('routes.clinicalCatalog.submitting', 'Saving…')
                  : t('routes.clinicalCatalog.create', 'Create draft')}
              </button>
              <button
                type="button"
                className="sa-button sa-button-quiet"
                onClick={() => setShowCreate(false)}
              >
                {t('routes.clinicalCatalog.cancel', 'Cancel')}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {loading ? <Spinner label={t('common.states.loading', 'Loading…')} /> : null}
      {!loading && items.length === 0 ? (
        <EmptyState title={t('routes.clinicalCatalog.empty', 'No clinical services')} />
      ) : null}
      {!loading && items.length > 0 ? (
        <div className="sa-table-wrap">
          <table className="sa-table">
            <caption className="sa-visually-hidden">
              {t('routes.clinicalCatalog.title', 'Clinical Services')}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('routes.clinicalCatalog.col.en', 'Name (EN)')}</th>
                <th scope="col">{t('routes.clinicalCatalog.col.ar', 'Name (AR)')}</th>
                <th scope="col">{t('routes.clinicalCatalog.col.key', 'Stable key')}</th>
                <th scope="col">{t('routes.clinicalCatalog.col.lifecycle', 'Lifecycle')}</th>
                <th scope="col">{t('routes.clinicalCatalog.col.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{tr(item, 'en')}</td>
                  <td dir="rtl">{tr(item, 'ar')}</td>
                  <td dir="ltr">{item.stableKey}</td>
                  <td>
                    <StatusBadge tone="neutral" label={item.lifecycle} />
                  </td>
                  <td>
                    <div className="sa-filter-row">
                      {item.lifecycle === 'DRAFT' ? (
                        <button
                          type="button"
                          className="sa-button sa-button-quiet"
                          disabled={submitting}
                          onClick={() => void runLifecycle(item.id, 'publish')}
                        >
                          {t('routes.clinicalCatalog.publish', 'Publish')}
                        </button>
                      ) : null}
                      {item.lifecycle === 'PUBLISHED' ? (
                        <button
                          type="button"
                          className="sa-button sa-button-quiet"
                          disabled={submitting}
                          onClick={() => void runLifecycle(item.id, 'deprecate')}
                        >
                          {t('routes.clinicalCatalog.deprecate', 'Deprecate')}
                        </button>
                      ) : null}
                      {item.lifecycle === 'PUBLISHED' || item.lifecycle === 'DEPRECATED' ? (
                        <button
                          type="button"
                          className="sa-button sa-button-quiet"
                          disabled={submitting}
                          onClick={() => void runLifecycle(item.id, 'inactivate')}
                        >
                          {t('routes.clinicalCatalog.inactivate', 'Inactivate')}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PageLayout>
  );
}
