import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../layout/PageLayout';
import { Alert, EmptyState, Spinner, StatusBadge } from '../ui';
import { formatMessage } from '../i18n/format';
import { statusLabel, statusTone } from '../pages/status-labels';
import { useTenantDirectoryQuery } from '../tenants/useTenantDirectoryQuery';
import { availabilityTone } from '../tenants/SectionExplanation';

export function TenantDirectoryPage() {
  const { t } = useI18n();
  const { data, loading, error, query, setQuery } = useTenantDirectoryQuery();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setQuery((q) => ({ ...q, page: 1, search, status }));
  }

  return (
    <PageLayout
      title={t('pages.tenants.title', 'Tenants')}
      description={t('pages.tenants.description', 'Search and inspect tenant control-plane metadata. Read-only.')}
    >
      <Alert tone="info" title={t('pages.tenants.readOnlyBanner', 'Read-only directory')}>
        {t(
          'pages.tenants.readOnlyBannerBody',
          'This view does not provision or mutate tenants. Lifecycle actions remain in the legacy clinic control plane until a later step.',
        )}
      </Alert>

      <form className="sa-filter-row" onSubmit={onSearchSubmit}>
        <label className="sa-field">
          {t('pages.tenants.searchLabel', 'Search')}{' '}
          <input value={search} onChange={(e) => setSearch(e.target.value)} maxLength={64} />
        </label>
        <label className="sa-field">
          {t('pages.tenants.statusLabel', 'Status')}{' '}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('pages.tenants.statusAll', 'All statuses')}</option>
            <option value="PROVISIONING">{t('status.provisioning', 'Provisioning')}</option>
            <option value="ACTIVE">{t('status.active', 'Active')}</option>
            <option value="SUSPENDED">{t('status.suspended', 'Suspended')}</option>
            <option value="ARCHIVED">{t('status.archived', 'Archived')}</option>
          </select>
        </label>
        <button className="sa-button sa-button-quiet" type="submit">
          {t('pages.tenants.searchButton', 'Search')}
        </button>
      </form>

      {loading && !data ? (
        <div role="status">
          <Spinner label={t('common.states.loading', 'Loading…')} />
        </div>
      ) : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {data ? (
        <>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <caption className="sa-visually-hidden">{t('pages.tenants.title', 'Tenants')}</caption>
              <thead>
                <tr>
                  <th>{t('pages.tenants.colName', 'Name')}</th>
                  <th>{t('pages.tenants.colStatus', 'Status')}</th>
                  <th>{t('pages.tenants.colRegion', 'Region')}</th>
                  <th>{t('pages.tenants.colFacility', 'Facility type')}</th>
                  <th>{t('pages.tenants.colLegacyPlan', 'Legacy plan')}</th>
                  <th>{t('pages.tenants.colSubscription', 'Subscription')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.platformTenantId}>
                    <td>
                      <Link to={`/tenants/${item.platformTenantId}`}>{item.displayName}</Link>
                      {item.slug ? <span className="sa-muted"> · {item.slug}</span> : null}
                    </td>
                    <td>
                      <StatusBadge label={statusLabel(t, item.status)} tone={statusTone(item.status)} />
                    </td>
                    <td>{item.region}</td>
                    <td>{item.facilityType}</td>
                    <td>
                      {item.legacyPlan ? (
                        item.legacyPlan
                      ) : (
                        <StatusBadge
                          label={t(`tenants.availability.${item.legacyPlanAvailability}`, item.legacyPlanAvailability)}
                          tone={availabilityTone(item.legacyPlanAvailability)}
                        />
                      )}
                    </td>
                    <td>
                      {item.subscriptionSummary ? (
                        `${item.subscriptionSummary.status} / ${item.subscriptionSummary.plan}`
                      ) : (
                        <StatusBadge
                          label={t(
                            `tenants.availability.${item.subscriptionAvailability}`,
                            item.subscriptionAvailability,
                          )}
                          tone={availabilityTone(item.subscriptionAvailability)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!data.items.length ? (
            <EmptyState
              title={t('pages.tenants.emptyTitle', 'No tenants found')}
              description={t('pages.tenants.emptyDescription', 'Adjust filters or search terms.')}
            />
          ) : null}

          <div className="sa-pagination">
            <button
              className="sa-button sa-button-quiet"
              disabled={(query.page ?? 1) <= 1}
              onClick={() => setQuery((q) => ({ ...q, page: Math.max(1, (q.page ?? 1) - 1) }))}
            >
              {t('pages.tenants.previous', 'Previous')}
            </button>
            <span>
              {formatMessage(t('pages.tenants.pageSummary', 'Page {page} · {total} tenants'), {
                page: data.pagination.page,
                total: data.pagination.total,
              })}
            </span>
            <button
              className="sa-button sa-button-quiet"
              disabled={!data.pagination.hasNextPage}
              onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
            >
              {t('pages.tenants.next', 'Next')}
            </button>
          </div>
        </>
      ) : null}
    </PageLayout>
  );
}
