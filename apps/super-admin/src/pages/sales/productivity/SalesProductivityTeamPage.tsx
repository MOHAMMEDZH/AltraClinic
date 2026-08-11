import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../../../auth/PlatformAuthProvider';
import { hasPermission } from '../../../auth/permissions';
import {
  PlatformAuthApiError,
  type SalesProductivityMetricsBundle,
} from '../../../auth/platform-auth-api';
import { PageLayout } from '../../../layout/PageLayout';
import { Alert, EmptyState } from '../../../ui';
import { ProductivityMetricsPanel, currentUtcPeriodKey } from './ProductivityMetricsPanel';

/**
 * Flexible Step 26 — manager team productivity.
 * Scope is enforced by the API (manager subtree / review scope).
 */
export function SalesProductivityTeamPage() {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const [periodKey, setPeriodKey] = useState(currentUtcPeriodKey);
  const [appliedPeriod, setAppliedPeriod] = useState(currentUtcPeriodKey);
  const [representativeId, setRepresentativeId] = useState('');
  const [appliedRepId, setAppliedRepId] = useState('');
  const [items, setItems] = useState<SalesProductivityMetricsBundle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canExport = hasPermission(principal, 'sales-report.export');

  const load = useCallback(async () => {
    try {
      const result = await withAccessToken((token) =>
        client.getSalesProductivityTeam(token, {
          periodKey: appliedPeriod,
          representativeId: appliedRepId.trim() || undefined,
        }),
      );
      setItems(result.items);
      setError(null);
    } catch (err) {
      setItems([]);
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesProductivity.teamLoadError', 'Unable to load team productivity.'),
      );
    }
  }, [client, appliedPeriod, appliedRepId, withAccessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onExport() {
    try {
      const file = await withAccessToken((token) =>
        client.exportSalesProductivity(token, {
          periodKey: appliedPeriod,
          representativeId: appliedRepId.trim() || undefined,
        }),
      );
      const blob = new Blob([file.body], { type: file.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesProductivity.exportError', 'Unable to export productivity CSV.'),
      );
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAppliedPeriod(periodKey);
    setAppliedRepId(representativeId);
  }

  return (
    <PageLayout
      title={t('pages.salesProductivity.teamTitle', 'Team productivity')}
      description={t(
        'pages.salesProductivity.teamDescription',
        'Manager-scoped productivity for your representative subtree. Ranking is disabled; incomplete rows stay UNRANKED.',
      )}
      actions={
        <>
          <Link className="sa-button sa-button-quiet" to="/sales/productivity">
            {t('pages.salesProductivity.selfLink', 'My productivity')}
          </Link>
          {canExport ? (
            <button className="sa-button sa-button-quiet" type="button" onClick={() => void onExport()}>
              {t('pages.salesProductivity.exportButton', 'Export CSV')}
            </button>
          ) : null}
        </>
      }
    >
      <form className="sa-filter-row" onSubmit={onSubmit}>
        <label className="sa-field">
          {t('pages.salesProductivity.periodLabel', 'Month')}{' '}
          <input
            type="month"
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
            aria-label={t('pages.salesProductivity.periodLabel', 'Month')}
          />
        </label>
        <label className="sa-field">
          {t('pages.salesProductivity.filterRepresentativeLabel', 'Representative id')}{' '}
          <input
            value={representativeId}
            onChange={(e) => setRepresentativeId(e.target.value)}
            placeholder="optional"
          />
        </label>
        <button className="sa-button sa-button-quiet" type="submit">
          {t('pages.salesProductivity.applyPeriod', 'Apply')}
        </button>
      </form>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {items.length === 0 && !error ? (
        <EmptyState
          title={t('pages.salesProductivity.teamEmptyTitle', 'No team metrics')}
          description={t(
            'pages.salesProductivity.teamEmptyDescription',
            'Adjust the period or confirm you have manager scope for this report.',
          )}
        />
      ) : null}
      {items.map((bundle) => (
        <div key={bundle.representativeId} className="sa-stack" data-testid="team-rep-row">
          <ProductivityMetricsPanel bundle={bundle} showRepresentativeId />
        </div>
      ))}
      <p className="sa-muted">
        {t(
          'pages.salesProductivity.boundaryNote',
          'Reporting only — no payroll, bank, tax, PHI, or notification surfaces.',
        )}
      </p>
    </PageLayout>
  );
}
