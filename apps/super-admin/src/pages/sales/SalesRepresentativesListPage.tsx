import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { hasPermission } from '../../auth/permissions';
import { PlatformAuthApiError, type SalesRepresentative } from '../../auth/platform-auth-api';
import { PageLayout } from '../../layout/PageLayout';
import { Alert, EmptyState, StatusBadge } from '../../ui';
import { formatMessage } from '../../i18n/format';
import { statusLabel, statusTone } from '../status-labels';

/**
 * Flexible Step 23 — Sales Representative Management.
 * Contract: docs/SALES_REPRESENTATIVE_MANAGEMENT.md
 * No Leads/Opportunities/Pipeline/Trial navigation (Step 24+).
 */
export function SalesRepresentativesListPage() {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const [reps, setReps] = useState<SalesRepresentative[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;

  const load = useCallback(async () => {
    try {
      const result = await withAccessToken((token) =>
        client.listSalesRepresentatives(token, { page, pageSize, search, status }),
      );
      setReps(result.items);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesRepresentatives.loadError', 'Unable to load sales representatives.'),
      );
    }
  }, [client, page, search, status, withAccessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageLayout
      title={t('pages.salesRepresentatives.title', 'Sales representatives')}
      description={t('pages.salesRepresentatives.description', 'Manage sales representative accounts and customer ownership.')}
      actions={
        hasPermission(principal, 'sales-representative.manage') ? (
          <Link className="sa-button sa-button-primary" to="/sales/new">
            {t('pages.salesRepresentatives.createButton', 'New representative')}
          </Link>
        ) : null
      }
    >
      <form
        className="sa-filter-row"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <label className="sa-field">
          {t('pages.salesRepresentatives.searchLabel', 'Search')}{' '}
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="sa-field">
          {t('pages.salesRepresentatives.statusLabel', 'Status')}{' '}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('pages.salesRepresentatives.statusAll', 'All statuses')}</option>
            <option value="active">{t('status.active', 'Active')}</option>
            <option value="pending_activation">{t('status.pendingActivation', 'Pending activation')}</option>
            <option value="suspended">{t('status.suspended', 'Suspended')}</option>
            <option value="disabled">{t('status.disabled', 'Disabled')}</option>
          </select>
        </label>
        <button className="sa-button sa-button-quiet" type="submit">
          {t('pages.salesRepresentatives.searchButton', 'Search')}
        </button>
      </form>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="sa-table-wrap">
        <table className="sa-table">
          <caption className="sa-visually-hidden">
            {t('pages.salesRepresentatives.title', 'Sales representatives')}
          </caption>
          <thead>
            <tr>
              <th>{t('pages.salesRepresentatives.colEmail', 'Email')}</th>
              <th>{t('pages.salesRepresentatives.colName', 'Name')}</th>
              <th>{t('pages.salesRepresentatives.colStatus', 'Status')}</th>
              <th>{t('pages.salesRepresentatives.colRegion', 'Region')}</th>
              <th>{t('pages.salesRepresentatives.colTerritory', 'Territory')}</th>
              <th>{t('pages.salesRepresentatives.colCreated', 'Created')}</th>
            </tr>
          </thead>
          <tbody>
            {reps.map((rep) => (
              <tr key={rep.id}>
                <td>
                  <Link to={`/sales/${rep.id}`}>{rep.email}</Link>
                </td>
                <td>{rep.displayName ?? '—'}</td>
                <td>
                  <StatusBadge label={statusLabel(t, rep.status)} tone={statusTone(rep.status)} />
                </td>
                <td>{rep.regionCode ?? '—'}</td>
                <td>{rep.territoryCode ?? '—'}</td>
                <td>{new Date(rep.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!reps.length && !error ? (
        <EmptyState
          title={t('pages.salesRepresentatives.emptyTitle', 'No sales representatives found')}
          description={t(
            'pages.salesRepresentatives.emptyDescription',
            'Adjust filters or create a representative when permitted.',
          )}
        />
      ) : null}
      <div className="sa-pagination">
        <button className="sa-button sa-button-quiet" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          {t('pages.salesRepresentatives.previous', 'Previous')}
        </button>
        <span>
          {formatMessage(t('pages.salesRepresentatives.pageSummary', 'Page {page} · {total} representatives'), {
            page,
            total,
          })}
        </span>
        <button
          className="sa-button sa-button-quiet"
          disabled={reps.length < pageSize}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('pages.salesRepresentatives.next', 'Next')}
        </button>
      </div>
    </PageLayout>
  );
}
