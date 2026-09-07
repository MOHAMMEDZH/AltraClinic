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
import { Alert } from '../../../ui';
import { ProductivityMetricsPanel, currentUtcPeriodKey } from './ProductivityMetricsPanel';

/**
 * Flexible Step 26 — own productivity metrics.
 * Contract: docs/SALES_PRODUCTIVITY_AND_COMMISSION_SNAPSHOT.md
 */
export function SalesProductivitySelfPage() {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const [periodKey, setPeriodKey] = useState(currentUtcPeriodKey);
  const [appliedPeriod, setAppliedPeriod] = useState(currentUtcPeriodKey);
  const [bundle, setBundle] = useState<SalesProductivityMetricsBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const canExport = hasPermission(principal, 'sales-report.export');

  const load = useCallback(async () => {
    try {
      const result = await withAccessToken((token) =>
        client.getSalesProductivitySelf(token, { periodKey: appliedPeriod }),
      );
      setBundle(result);
      setError(null);
    } catch (err) {
      setBundle(null);
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesProductivity.loadError', 'Unable to load productivity metrics.'),
      );
    }
  }, [client, appliedPeriod, withAccessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onExport() {
    setExportNotice(null);
    try {
      const file = await withAccessToken((token) =>
        client.exportSalesProductivity(token, { periodKey: appliedPeriod }),
      );
      const blob = new Blob([file.body], { type: file.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
      setExportNotice(t('pages.salesProductivity.exportReady', 'Export downloaded.'));
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesProductivity.exportError', 'Unable to export productivity CSV.'),
      );
    }
  }

  function onPeriodSubmit(e: FormEvent) {
    e.preventDefault();
    setAppliedPeriod(periodKey);
  }

  return (
    <PageLayout
      title={t('pages.salesProductivity.selfTitle', 'My productivity')}
      description={t(
        'pages.salesProductivity.selfDescription',
        'UTC monthly productivity metrics for your representative profile. Incomplete rates are never shown as zero.',
      )}
      actions={
        <>
          <Link className="sa-button sa-button-quiet" to="/sales/productivity/team">
            {t('pages.salesProductivity.teamLink', 'Team productivity')}
          </Link>
          {canExport ? (
            <button className="sa-button sa-button-quiet" type="button" onClick={() => void onExport()}>
              {t('pages.salesProductivity.exportButton', 'Export CSV')}
            </button>
          ) : null}
        </>
      }
    >
      <form className="sa-filter-row" onSubmit={onPeriodSubmit}>
        <label className="sa-field">
          {t('pages.salesProductivity.periodLabel', 'Month')}{' '}
          <input
            type="month"
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
            aria-label={t('pages.salesProductivity.periodLabel', 'Month')}
          />
        </label>
        <button className="sa-button sa-button-quiet" type="submit">
          {t('pages.salesProductivity.applyPeriod', 'Apply')}
        </button>
      </form>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {exportNotice ? <Alert tone="success">{exportNotice}</Alert> : null}
      {bundle ? <ProductivityMetricsPanel bundle={bundle} /> : null}
      <p className="sa-muted">
        {t(
          'pages.salesProductivity.boundaryNote',
          'Reporting only — no payroll, bank, tax, PHI, or notification surfaces.',
        )}
      </p>
    </PageLayout>
  );
}
