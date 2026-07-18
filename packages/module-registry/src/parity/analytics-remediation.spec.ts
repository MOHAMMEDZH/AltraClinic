import { describe, expect, it } from 'vitest';
import {
  CANONICAL_ANALYTICS_METRICS,
  CANONICAL_ANALYTICS_WIDGETS,
  CANONICAL_CROSS_MODULE_ANALYTICS,
  validateAnalyticsCapabilityContract,
  validateCanonicalAnalyticsVocabulary,
  ANALYTICS_AGGREGATE_CAPABILITY_IDS,
  ANALYTICS_AGGREGATE_CAPABILITY_CONTRACT,
} from '../analytics';

describe('analytics vocabulary remediation (Phase 34a M1/M2/M4)', () => {
  it('every canonical metric is fully self-describing', () => {
    for (const metric of CANONICAL_ANALYTICS_METRICS) {
      expect(metric.labelKey).toBeTruthy();
      expect(metric.descriptionKey).toBeTruthy();
      expect(metric.unit).toBeTruthy();
      expect(metric.format).toBeTruthy();
      expect(typeof metric.precision).toBe('number');
      expect(metric.precision).toBeGreaterThanOrEqual(0);
      expect(metric.categoryId).toBeTruthy();
      expect(metric.dataDomain).toBeTruthy();
      expect(metric.aggregation).toBeTruthy();
      expect(metric.providerKey).toBe('analytics.builtin');
      expect(metric.featureId).toBe('analytics');
    }
    expect(validateCanonicalAnalyticsVocabulary()).toEqual([]);
  });

  it('rejects cross-module widgetCatalogId collision with analytics module widgets', () => {
    const catalogIds = new Set(CANONICAL_ANALYTICS_WIDGETS.map((widget) => widget.widgetCatalogId));
    for (const crossWidget of CANONICAL_CROSS_MODULE_ANALYTICS) {
      expect(catalogIds.has(crossWidget.widgetCatalogId)).toBe(false);
    }
  });

  it('defines aggregate capability contract for Phase 34b', () => {
    expect(ANALYTICS_AGGREGATE_CAPABILITY_IDS).toEqual([
      'canViewAnalytics',
      'canCreateDashboards',
      'canExportAnalytics',
      'canScheduleAnalytics',
    ]);
    expect(ANALYTICS_AGGREGATE_CAPABILITY_CONTRACT).toHaveLength(4);
    for (const entry of ANALYTICS_AGGREGATE_CAPABILITY_CONTRACT) {
      expect(entry.derivedFrom).toBe('snapshot');
      expect(entry.forbiddenClientDuplication).toBe(true);
      expect(entry.requiredSnapshotSignals.length).toBeGreaterThan(0);
    }
    expect(validateAnalyticsCapabilityContract()).toEqual([]);
  });
});
