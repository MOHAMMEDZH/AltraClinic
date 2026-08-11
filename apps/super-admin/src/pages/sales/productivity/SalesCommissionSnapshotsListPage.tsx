import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../../../auth/PlatformAuthProvider';
import { hasPermission } from '../../../auth/permissions';
import {
  PlatformAuthApiError,
  type SalesCommissionSnapshot,
} from '../../../auth/platform-auth-api';
import { PageLayout } from '../../../layout/PageLayout';
import { Alert, EmptyState, StatusBadge } from '../../../ui';
import { formatMessage } from '../../../i18n/format';
import { currentUtcPeriodKey } from './ProductivityMetricsPanel';

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'FINALIZED') return 'success';
  if (status === 'SUPERSEDED') return 'warning';
  if (status === 'DRAFT') return 'neutral';
  return 'neutral';
}

function paidTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  return status === 'PAID' ? 'success' : 'neutral';
}

/**
 * Flexible Step 26 — commission snapshot review list (not payroll).
 */
export function SalesCommissionSnapshotsListPage() {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const canGenerate = hasPermission(principal, 'commission-snapshot.generate');
  const [items, setItems] = useState<SalesCommissionSnapshot[]>([]);
  const [periodKey, setPeriodKey] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [generateRepId, setGenerateRepId] = useState('');
  const [generatePeriod, setGeneratePeriod] = useState(currentUtcPeriodKey);
  const [finalize, setFinalize] = useState(false);
  const pageSize = 25;

  const load = useCallback(async () => {
    try {
      const result = await withAccessToken((token) =>
        client.listSalesCommissionSnapshots(token, {
          page,
          pageSize,
          periodKey: periodKey || undefined,
          status: status || undefined,
        }),
      );
      setItems(result.items);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesCommissions.loadError', 'Unable to load commission snapshots.'),
      );
    }
  }, [client, page, periodKey, status, withAccessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    try {
      const created = await withAccessToken((token) =>
        client.generateSalesCommissionSnapshot(
          token,
          {
            representativeId: generateRepId.trim(),
            periodKey: generatePeriod,
            finalize,
          },
          crypto.randomUUID(),
        ),
      );
      setNotice(
        t('pages.salesCommissions.generateSuccess', 'Snapshot generated ({id}).')
          .replace('{id}', created.id),
      );
      void load();
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesCommissions.generateError', 'Unable to generate snapshot.'),
      );
    }
  }

  return (
    <PageLayout
      title={t('pages.salesCommissions.title', 'Commission snapshots')}
      description={t(
        'pages.salesCommissions.description',
        'Review records only. Paid status is administrative metadata and does not move money. Calculation status remains UNCONFIGURED until rates exist.',
      )}
    >
      <p className="sa-muted" data-testid="commission-admin-notice">
        {t(
          'pages.salesCommissions.paidAdminNotice',
          'Paid status records an administrative state only and does not execute payment, payroll, bank transfer, or tax filing.',
        )}
      </p>

      <form
        className="sa-filter-row"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <label className="sa-field">
          {t('pages.salesCommissions.periodLabel', 'Month')}{' '}
          <input
            type="month"
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
            aria-label={t('pages.salesCommissions.periodLabel', 'Month')}
          />
        </label>
        <label className="sa-field">
          {t('pages.salesCommissions.statusLabel', 'Status')}{' '}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('pages.salesCommissions.statusAll', 'All statuses')}</option>
            {['DRAFT', 'FINALIZED', 'SUPERSEDED'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button className="sa-button sa-button-quiet" type="submit">
          {t('pages.salesCommissions.searchButton', 'Search')}
        </button>
      </form>

      {canGenerate ? (
        <form className="sa-filter-row" onSubmit={(e) => void onGenerate(e)} aria-label="Generate snapshot">
          <label className="sa-field">
            {t('pages.salesCommissions.generateRepLabel', 'Representative id')}{' '}
            <input
              required
              value={generateRepId}
              onChange={(e) => setGenerateRepId(e.target.value)}
            />
          </label>
          <label className="sa-field">
            {t('pages.salesCommissions.periodLabel', 'Month')}{' '}
            <input
              type="month"
              required
              value={generatePeriod}
              onChange={(e) => setGeneratePeriod(e.target.value)}
            />
          </label>
          <label className="sa-field">
            <input
              type="checkbox"
              checked={finalize}
              onChange={(e) => setFinalize(e.target.checked)}
            />{' '}
            {t('pages.salesCommissions.finalizeLabel', 'Finalize on generate')}
          </label>
          <button className="sa-button sa-button-primary" type="submit">
            {t('pages.salesCommissions.generateButton', 'Generate snapshot')}
          </button>
        </form>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="sa-table-wrap">
        <table className="sa-table">
          <caption className="sa-visually-hidden">
            {t('pages.salesCommissions.title', 'Commission snapshots')}
          </caption>
          <thead>
            <tr>
              <th>{t('pages.salesCommissions.colPeriod', 'Period')}</th>
              <th>{t('pages.salesCommissions.colRepresentative', 'Representative')}</th>
              <th>{t('pages.salesCommissions.colStatus', 'Status')}</th>
              <th>{t('pages.salesCommissions.colReview', 'Review')}</th>
              <th>{t('pages.salesCommissions.colPaid', 'Paid (admin)')}</th>
              <th>{t('pages.salesCommissions.colCalculation', 'Calculation')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link to={`/sales/commission-snapshots/${row.id}`}>{row.periodKey}</Link>
                </td>
                <td>
                  <code>{row.representativeId}</code>
                </td>
                <td>
                  <StatusBadge label={row.status} tone={statusTone(row.status)} />
                </td>
                <td>{row.reviewStatus}</td>
                <td>
                  <StatusBadge label={row.paidStatus} tone={paidTone(row.paidStatus)} />
                </td>
                <td>
                  <StatusBadge label={row.calculationStatus} tone="warning" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 && !error ? (
        <EmptyState
          title={t('pages.salesCommissions.emptyTitle', 'No snapshots found')}
          description={t(
            'pages.salesCommissions.emptyDescription',
            'Generate a snapshot for a period when permitted, or adjust filters.',
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
          {t('pages.salesCommissions.previous', 'Previous')}
        </button>
        <span>
          {formatMessage(t('pages.salesCommissions.pageSummary', 'Page {page} · {total} snapshots'), {
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
          {t('pages.salesCommissions.next', 'Next')}
        </button>
      </div>
    </PageLayout>
  );
}
