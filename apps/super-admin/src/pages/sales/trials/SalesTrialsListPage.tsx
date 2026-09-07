import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../../../auth/PlatformAuthProvider';
import { hasPermission } from '../../../auth/permissions';
import { PlatformAuthApiError, type SalesTrial } from '../../../auth/platform-auth-api';
import { PageLayout } from '../../../layout/PageLayout';
import { Alert, EmptyState, StatusBadge } from '../../../ui';
import { formatMessage } from '../../../i18n/format';

const TRIAL_STATUSES = [
  'DRAFT',
  'PENDING_PROVISIONING',
  'ACTIVE',
  'EXPIRED',
  'CONVERTED',
  'CANCELLED',
] as const;

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'CONVERTED') return 'success';
  if (status === 'EXPIRED') return 'warning';
  if (status === 'CANCELLED') return 'danger';
  return 'neutral';
}

/**
 * Flexible Step 25 — governed Trial list.
 * Contract: docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md
 * Entitlements are Step 16/18 authority; this surface is governance only.
 */
export function SalesTrialsListPage() {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const [trials, setTrials] = useState<SalesTrial[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;

  const load = useCallback(async () => {
    try {
      const result = await withAccessToken((token) =>
        client.listSalesTrials(token, { page, pageSize, search, status }),
      );
      setTrials(result.items);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesTrials.loadError', 'Unable to load trials.'),
      );
    }
  }, [client, page, search, status, withAccessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageLayout
      title={t('pages.salesTrials.title', 'Trials')}
      description={t(
        'pages.salesTrials.description',
        'Governed trial lifecycle. Entitlements always resolve from the commercial snapshot and the entitlement runtime — never from this page.',
      )}
      actions={
        hasPermission(principal, 'trial.create') ? (
          <Link className="sa-button sa-button-primary" to="/sales/trials/new">
            {t('pages.salesTrials.createButton', 'New trial')}
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
          {t('pages.salesTrials.searchLabel', 'Search')}{' '}
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="sa-field">
          {t('pages.salesTrials.statusLabel', 'Status')}{' '}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('pages.salesTrials.statusAll', 'All statuses')}</option>
            {TRIAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button className="sa-button sa-button-quiet" type="submit">
          {t('pages.salesTrials.searchButton', 'Search')}
        </button>
      </form>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="sa-table-wrap">
        <table className="sa-table">
          <caption className="sa-visually-hidden">{t('pages.salesTrials.title', 'Trials')}</caption>
          <thead>
            <tr>
              <th>{t('pages.salesTrials.colOrganization', 'Organization')}</th>
              <th>{t('pages.salesTrials.colStatus', 'Status')}</th>
              <th>{t('pages.salesTrials.colExpires', 'Expires')}</th>
              <th>{t('pages.salesTrials.colExtensions', 'Extensions')}</th>
              <th>{t('pages.salesTrials.colCreated', 'Created')}</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((trial) => (
              <tr key={trial.id}>
                <td>
                  <Link to={`/sales/trials/${trial.id}`}>{trial.organizationName}</Link>
                </td>
                <td>
                  <StatusBadge label={trial.status} tone={statusTone(trial.status)} />
                </td>
                <td>
                  {trial.expiresAt ? (
                    <time dateTime={trial.expiresAt}>
                      {new Date(trial.expiresAt).toLocaleString()}
                    </time>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {trial.extensionCount}/{trial.maxExtensions}
                </td>
                <td>{new Date(trial.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {trials.length === 0 && !error ? (
        <EmptyState
          title={t('pages.salesTrials.emptyTitle', 'No trials found')}
          description={t(
            'pages.salesTrials.emptyDescription',
            'Adjust filters or create a trial when permitted.',
          )}
        />
      ) : null}
      <div className="sa-pagination">
        <button
          className="sa-button sa-button-quiet"
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          {t('pages.salesTrials.previous', 'Previous')}
        </button>
        <span>
          {formatMessage(t('pages.salesTrials.pageSummary', 'Page {page} · {total} trials'), {
            page: String(page),
            total: String(total),
          })}
        </span>
        <button
          className="sa-button sa-button-quiet"
          type="button"
          disabled={page * pageSize >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('pages.salesTrials.next', 'Next')}
        </button>
      </div>
    </PageLayout>
  );
}
