import { useI18n } from '@booking/i18n/react';
import type {
  SalesMetricCompleteness,
  SalesMetricKey,
  SalesMetricValue,
  SalesProductivityMetricsBundle,
} from '../../../auth/platform-auth-api';
import { StatusBadge } from '../../../ui';

const KPI_KEYS: SalesMetricKey[] = [
  'leads_created',
  'activities',
  'demos_scheduled',
  'demos_completed',
  'trials_created',
  'won',
  'lost',
  'paid_conversions',
  'lead_to_won_rate',
  'trial_to_paid_rate',
  'time_to_convert_days',
  'active_customers',
  'cancellations',
  'addon_sales',
  'target_progress',
  'converted_customers',
];

const RATE_KEYS = new Set<SalesMetricKey>(['lead_to_won_rate', 'trial_to_paid_rate', 'target_progress']);

function completenessTone(
  completeness: SalesMetricCompleteness,
): 'neutral' | 'success' | 'warning' | 'danger' {
  if (completeness === 'COMPLETE') return 'success';
  if (completeness === 'PARTIAL') return 'warning';
  if (completeness === 'UNAVAILABLE') return 'danger';
  return 'neutral';
}

function formatMetricDisplay(
  metric: SalesMetricValue,
  t: (key: string, fallback?: string) => string,
): string {
  if (metric.completeness === 'NOT_APPLICABLE' || metric.completeness === 'UNAVAILABLE') {
    return t('pages.salesProductivity.valueNotAvailable', '—');
  }
  if (metric.value === null) {
    // Incomplete rates must never render as 0%.
    return t('pages.salesProductivity.valueIncomplete', 'Incomplete');
  }
  if (RATE_KEYS.has(metric.key) && metric.completeness !== 'COMPLETE') {
    return t('pages.salesProductivity.valueIncomplete', 'Incomplete');
  }
  if (metric.key === 'lead_to_won_rate' || metric.key === 'trial_to_paid_rate') {
    return `${(metric.value * 100).toFixed(1)}%`;
  }
  if (metric.key === 'target_progress') {
    return `${(metric.value * 100).toFixed(1)}%`;
  }
  if (metric.key === 'time_to_convert_days') {
    return metric.value.toFixed(1);
  }
  return String(metric.value);
}

function metricLabel(key: SalesMetricKey, t: (key: string, fallback?: string) => string): string {
  const labels: Record<SalesMetricKey, string> = {
    leads_created: t('pages.salesProductivity.metric.leads_created', 'Leads created'),
    activities: t('pages.salesProductivity.metric.activities', 'Activities'),
    demos_scheduled: t('pages.salesProductivity.metric.demos_scheduled', 'Demos scheduled'),
    demos_completed: t('pages.salesProductivity.metric.demos_completed', 'Demos completed'),
    trials_created: t('pages.salesProductivity.metric.trials_created', 'Trials created'),
    won: t('pages.salesProductivity.metric.won', 'Won'),
    lost: t('pages.salesProductivity.metric.lost', 'Lost'),
    paid_conversions: t('pages.salesProductivity.metric.paid_conversions', 'Paid conversions'),
    lead_to_won_rate: t('pages.salesProductivity.metric.lead_to_won_rate', 'Lead → won rate'),
    trial_to_paid_rate: t('pages.salesProductivity.metric.trial_to_paid_rate', 'Trial → paid rate'),
    time_to_convert_days: t(
      'pages.salesProductivity.metric.time_to_convert_days',
      'Time to convert (days)',
    ),
    active_customers: t('pages.salesProductivity.metric.active_customers', 'Active customers'),
    cancellations: t('pages.salesProductivity.metric.cancellations', 'Cancellations'),
    plan_version_mix: t('pages.salesProductivity.metric.plan_version_mix', 'Plan version mix'),
    addon_sales: t('pages.salesProductivity.metric.addon_sales', 'Add-on sales'),
    target_progress: t('pages.salesProductivity.metric.target_progress', 'Target progress'),
    converted_customers: t(
      'pages.salesProductivity.metric.converted_customers',
      'Converted customers',
    ),
    cancellation_attribution: t(
      'pages.salesProductivity.metric.cancellation_attribution',
      'Cancellation attribution',
    ),
    period_source_completeness: t(
      'pages.salesProductivity.metric.period_source_completeness',
      'Period source completeness',
    ),
    reporting_completeness: t(
      'pages.salesProductivity.metric.reporting_completeness',
      'Reporting completeness',
    ),
  };
  return labels[key] ?? key;
}

/**
 * Shared productivity metrics panel (self + team rows).
 * Ranking is intentionally omitted — incomplete rows stay unranked by contract.
 */
export function ProductivityMetricsPanel({
  bundle,
  showRepresentativeId = false,
}: {
  bundle: SalesProductivityMetricsBundle;
  showRepresentativeId?: boolean;
}) {
  const { t } = useI18n();
  const byKey = bundle.metricsByKey;
  const reporting = bundle.completeness.reporting_completeness;
  const rankedLabel =
    reporting === 'COMPLETE'
      ? t('pages.salesProductivity.rankEligible', 'Eligible (ranking disabled)')
      : t('pages.salesProductivity.unranked', 'UNRANKED');

  return (
    <section className="sa-stack" aria-label={t('pages.salesProductivity.metricsRegion', 'Metrics')}>
      {showRepresentativeId ? (
        <p>
          <strong>{t('pages.salesProductivity.representativeLabel', 'Representative')}</strong>{' '}
          <code>{bundle.representativeId}</code>
        </p>
      ) : null}

      <dl className="sa-definition-list">
        <div>
          <dt>{t('pages.salesProductivity.periodTimezoneLabel', 'Period timezone')}</dt>
          <dd>{bundle.periodTimezone}</dd>
        </div>
        <div>
          <dt>{t('pages.salesProductivity.sourceCutoffLabel', 'Source cutoff')}</dt>
          <dd>
            <time dateTime={bundle.sourceCutoffAt}>
              {new Date(bundle.sourceCutoffAt).toLocaleString()}
            </time>
          </dd>
        </div>
        <div>
          <dt>{t('pages.salesProductivity.reportingCompletenessLabel', 'Reporting completeness')}</dt>
          <dd>
            <StatusBadge label={reporting} tone={completenessTone(reporting)} />
          </dd>
        </div>
        <div>
          <dt>{t('pages.salesProductivity.rankingLabel', 'Ranking')}</dt>
          <dd data-testid="productivity-rank-status">{rankedLabel}</dd>
        </div>
      </dl>

      <div className="sa-table-wrap">
        <table className="sa-table">
          <caption className="sa-visually-hidden">
            {t('pages.salesProductivity.kpiCaption', 'Productivity KPIs')}
          </caption>
          <thead>
            <tr>
              <th>{t('pages.salesProductivity.colMetric', 'Metric')}</th>
              <th>{t('pages.salesProductivity.colValue', 'Value')}</th>
              <th>{t('pages.salesProductivity.colCompleteness', 'Completeness')}</th>
              <th>{t('pages.salesProductivity.colFormula', 'Formula / notes')}</th>
            </tr>
          </thead>
          <tbody>
            {KPI_KEYS.map((key) => {
              const metric = byKey[key] ?? bundle.metrics.find((m) => m.key === key);
              if (!metric) return null;
              const display = formatMetricDisplay(metric, t);
              const isRate =
                metric.key === 'lead_to_won_rate' || metric.key === 'trial_to_paid_rate';
              let formula = metric.explanation ?? '—';
              if (isRate) {
                const num = metric.numerator ?? '—';
                const den = metric.denominator ?? '—';
                formula =
                  metric.key === 'lead_to_won_rate'
                    ? t(
                        'pages.salesProductivity.formulaLeadToWon',
                        'won / leads_created_in_period ({num} / {den})',
                      )
                        .replace('{num}', String(num))
                        .replace('{den}', String(den))
                    : t(
                        'pages.salesProductivity.formulaTrialToPaid',
                        'paid_conversions / trials_created_in_period ({num} / {den})',
                      )
                        .replace('{num}', String(num))
                        .replace('{den}', String(den));
                if (metric.denominator === 0 || metric.completeness === 'NOT_APPLICABLE') {
                  formula = `${formula}. ${t(
                    'pages.salesProductivity.formulaZeroDenom',
                    'Denominator is 0 — rate is not applicable (not shown as 0%).',
                  )}`;
                }
              } else if (metric.key === 'target_progress') {
                formula =
                  metric.explanation ??
                  t(
                    'pages.salesProductivity.formulaTarget',
                    'actual / targetAmount when target period is MONTH; missing target is NOT_APPLICABLE (not zero).',
                  );
              }
              return (
                <tr key={key} data-metric-key={key} data-completeness={metric.completeness}>
                  <td>{metricLabel(key, t)}</td>
                  <td data-testid={`metric-value-${key}`}>{display}</td>
                  <td>
                    <StatusBadge
                      label={metric.completeness}
                      tone={completenessTone(metric.completeness)}
                    />
                  </td>
                  <td data-testid={`metric-formula-${key}`}>{formula}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section aria-labelledby="plan-version-mix-h">
        <h2 id="plan-version-mix-h">
          {t('pages.salesProductivity.planVersionMixTitle', 'Plan Version mix')}
        </h2>
        <p className="sa-muted">
          {t(
            'pages.salesProductivity.planVersionMixNote',
            'Counts by immutable Plan Version id — never by display name.',
          )}
        </p>
        {bundle.planVersionAttribution.length === 0 ? (
          <p className="sa-muted">{t('pages.salesProductivity.attributionEmpty', 'No attribution in period.')}</p>
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>{t('pages.salesProductivity.colPlanVersionId', 'Plan version id')}</th>
                  <th>{t('pages.salesProductivity.colCount', 'Count')}</th>
                </tr>
              </thead>
              <tbody>
                {bundle.planVersionAttribution.map((row) => (
                  <tr key={row.planVersionId}>
                    <td>
                      <code>{row.planVersionId}</code>
                    </td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="addon-attribution-h">
        <h2 id="addon-attribution-h">
          {t('pages.salesProductivity.addonAttributionTitle', 'Add-on attribution')}
        </h2>
        {bundle.addOnAttribution.length === 0 ? (
          <p className="sa-muted">{t('pages.salesProductivity.attributionEmpty', 'No attribution in period.')}</p>
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>{t('pages.salesProductivity.colAddOnVersionId', 'Add-on version id')}</th>
                  <th>{t('pages.salesProductivity.colCount', 'Count')}</th>
                  <th>{t('pages.salesProductivity.colBasis', 'Basis')}</th>
                </tr>
              </thead>
              <tbody>
                {bundle.addOnAttribution.map((row) => (
                  <tr key={`${row.addOnVersionId}-${row.basis}`}>
                    <td>
                      <code>{row.addOnVersionId}</code>
                    </td>
                    <td>{row.count}</td>
                    <td>{row.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="target-progress-h">
        <h2 id="target-progress-h">
          {t('pages.salesProductivity.targetProgressTitle', 'Target progress')}
        </h2>
        {(() => {
          const target = byKey.target_progress;
          if (!target) {
            return (
              <p className="sa-muted">
                {t('pages.salesProductivity.targetMissing', 'Target progress metric unavailable.')}
              </p>
            );
          }
          return (
            <dl className="sa-definition-list">
              <div>
                <dt>{t('pages.salesProductivity.colValue', 'Value')}</dt>
                <dd data-testid="target-progress-value">{formatMetricDisplay(target, t)}</dd>
              </div>
              <div>
                <dt>{t('pages.salesProductivity.colCompleteness', 'Completeness')}</dt>
                <dd>
                  <StatusBadge label={target.completeness} tone={completenessTone(target.completeness)} />
                </dd>
              </div>
              <div>
                <dt>{t('pages.salesProductivity.colFormula', 'Formula / notes')}</dt>
                <dd>
                  {target.explanation ??
                    t(
                      'pages.salesProductivity.formulaTarget',
                      'actual / targetAmount when target period is MONTH; missing target is NOT_APPLICABLE (not zero).',
                    )}
                </dd>
              </div>
            </dl>
          );
        })()}
      </section>
    </section>
  );
}

export function currentUtcPeriodKey(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
