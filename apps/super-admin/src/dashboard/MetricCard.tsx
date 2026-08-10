import { useI18n } from '@booking/i18n/react';
import { Surface, StatusBadge } from '../ui';
import { DistributionList } from './DistributionList';
import { DefinitionDisclosure } from './DefinitionDisclosure';
import { hidesValue, reasonLabelKey, statusLabelKey, statusTone } from './metric-presentation';
import type { DashboardMetric } from './types';

interface MetricCardProps {
  metric: DashboardMetric;
}

/**
 * Single metric tile. Guarantees:
 *  - Unavailable & permission-limited metrics NEVER show a number (no fake 0).
 *  - Every status is conveyed with text (StatusBadge), never color alone.
 *  - Breakdowns render as accessible CSS bars, never charts.
 */
export function MetricCard({ metric }: MetricCardProps) {
  const { t } = useI18n();
  const noValue = hidesValue(metric);

  return (
    <Surface as="section" level="raised" className="sa-metric-card" aria-labelledby={`metric-${metric.id}`}>
      <header className="sa-metric-card-header">
        <h3 id={`metric-${metric.id}`} className="sa-metric-card-title">
          {t(metric.labelKey, metric.id)}
        </h3>
        <StatusBadge
          label={t(statusLabelKey(metric.status), metric.status)}
          tone={statusTone(metric.status)}
        />
      </header>

      <p className="sa-metric-card-description sa-muted">{t(metric.descriptionKey, '')}</p>

      <div className="sa-metric-card-body">
        {metric.status === 'unavailable' ? (
          <p className="sa-metric-unavailable sa-muted" data-testid={`metric-unavailable-${metric.id}`}>
            {t(reasonLabelKey(metric.reasonCode ?? 'unavailable'), t('dashboard.unavailableGeneric', 'Not available yet.'))}
          </p>
        ) : metric.status === 'permission_limited' ? (
          <p className="sa-metric-permission sa-muted" data-testid={`metric-permission-${metric.id}`}>
            {t('dashboard.permissionLimited', 'You do not have permission to view this metric.')}
          </p>
        ) : noValue ? (
          <p className="sa-metric-degraded sa-muted" data-testid={`metric-degraded-${metric.id}`}>
            {t('dashboard.degraded', 'Temporarily unavailable. Try refreshing.')}
          </p>
        ) : (
          <p className="sa-metric-value" data-testid={`metric-value-${metric.id}`}>
            <span className="sa-metric-number">{(metric.value ?? 0).toLocaleString()}</span>{' '}
            <span className="sa-metric-unit sa-muted">{t(`dashboard.units.${metric.unit}`, metric.unit)}</span>
          </p>
        )}

        {!noValue && metric.breakdown && metric.breakdown.length > 0 ? (
          <DistributionList breakdown={metric.breakdown} captionKey={metric.labelKey} />
        ) : null}

        {metric.isStale ? (
          <p className="sa-metric-stale-note sa-muted" role="status">
            {t('dashboard.staleNote', 'Showing a recently cached value.')}
          </p>
        ) : null}
      </div>

      {metric.status !== 'permission_limited' ? <DefinitionDisclosure metric={metric} /> : null}
    </Surface>
  );
}
