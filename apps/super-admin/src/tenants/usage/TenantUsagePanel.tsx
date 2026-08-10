import { useCallback, useEffect, useState } from 'react';

import { useI18n } from '@booking/i18n/react';

import { Alert, Spinner, Surface } from '../../ui';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import { hasPermission } from '../../auth/permissions';

type MeterRow = {
  meterKey: string;
  limitKey: string;
  currentValue: string;
  projectedValue: string;
  limitState: string;
  limitValue?: string;
  thresholdState?: string;
  staleClass: string;
};

/** U01 — bounded Usage and Limits panel (usage.view). No PHI / raw observations. */
export function TenantUsagePanel({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const [meters, setMeters] = useState<MeterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canView = hasPermission(principal, 'usage.view');

  const formatLimitState = (state: string) =>
    t(`pages.tenantDetail.usageLimitStates.${state}`, state);
  const formatThreshold = (state?: string) =>
    state ? t(`pages.tenantDetail.usageThresholdStates.${state}`, state) : '';
  const formatFreshness = (state: string) =>
    t(`pages.tenantDetail.usageFreshnessStates.${state}`, state);

  const load = useCallback(async () => {
    if (!tenantId || !canView) return;
    setLoading(true);
    try {
      const result = await withAccessToken((token) => client.listTenantUsage(token, tenantId));
      setMeters(result.meters);
      setError(null);
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : 'Unable to load usage.');
      setMeters(null);
    } finally {
      setLoading(false);
    }
  }, [canView, client, tenantId, withAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <Surface as="section" level="raised" className="sa-metric-card">
        <header className="sa-metric-card-header">
          <h2 className="sa-metric-card-title">{t('pages.tenantDetail.usage', 'Usage and Limits')}</h2>
        </header>
        <p className="sa-muted">
          {t('pages.tenantDetail.usageForbidden', 'usage.view permission required.')}
        </p>
      </Surface>
    );
  }

  return (
    <Surface as="section" level="raised" className="sa-metric-card">
      <header className="sa-metric-card-header">
        <h2 className="sa-metric-card-title">{t('pages.tenantDetail.usage', 'Usage and Limits')}</h2>
      </header>
      {loading && !meters ? <Spinner label={t('common.states.loading', 'Loading…')} /> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {meters ? (
        <table className="sa-table">
          <thead>
            <tr>
              <th>{t('pages.tenantDetail.usageMeter', 'Meter')}</th>
              <th>{t('pages.tenantDetail.usageLimitKey', 'Limit key')}</th>
              <th>{t('pages.tenantDetail.usageCurrent', 'Current')}</th>
              <th>{t('pages.tenantDetail.usageLimitState', 'Limit state')}</th>
              <th>{t('pages.tenantDetail.usageFreshness', 'Freshness')}</th>
            </tr>
          </thead>
          <tbody>
            {meters.map((m) => (
              <tr key={m.meterKey}>
                <td>{m.meterKey}</td>
                <td>
                  {m.limitKey}
                  {m.limitValue != null ? ` (${m.limitValue})` : ''}
                </td>
                <td>
                  {m.currentValue}
                  {m.thresholdState ? ` · ${formatThreshold(m.thresholdState)}` : ''}
                </td>
                <td>{formatLimitState(m.limitState)}</td>
                <td>{formatFreshness(m.staleClass)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </Surface>
  );
}
