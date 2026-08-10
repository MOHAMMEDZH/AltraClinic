import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '../i18n/format';
import type { DashboardMetric } from './types';

interface DefinitionDisclosureProps {
  metric: DashboardMetric;
}

/**
 * Progressive-disclosure panel exposing a metric's provenance: its definition,
 * Source of Record label, time window, and the "as of" timestamp. Keeps the
 * card compact while making every number auditable.
 */
export function DefinitionDisclosure({ metric }: DefinitionDisclosureProps) {
  const { t } = useI18n();
  const asOf = metric.asOf ? new Date(metric.asOf).toLocaleString() : t('dashboard.asOfUnknown', '—');
  const timeWindow = t(`dashboard.timeWindow.${metric.timeWindow}`, metric.timeWindow);

  return (
    <details className="sa-definition-disclosure">
      <summary>{t('dashboard.definitionSummary', 'How is this measured?')}</summary>
      <dl className="sa-definition-list">
        <dt>{t('dashboard.definitionLabel', 'Definition')}</dt>
        <dd>{t(metric.definitionKey, '')}</dd>
        <dt>{t('dashboard.sourceLabel', 'Source')}</dt>
        <dd>{t(metric.sourceLabelKey, metric.sourceKey)}</dd>
        <dt>{t('dashboard.timeWindowLabel', 'Time window')}</dt>
        <dd>{timeWindow}</dd>
        <dt>{t('dashboard.asOfLabel', 'As of')}</dt>
        <dd>{formatMessage(t('dashboard.asOfValue', '{value}'), { value: asOf })}</dd>
      </dl>
    </details>
  );
}
