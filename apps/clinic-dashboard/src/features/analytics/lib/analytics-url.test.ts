import { describe, expect, it } from 'vitest';
import { buildAnalyticsUrl, metricShowsSection, parseAnalyticsMetric } from './analytics-url';

describe('analytics-url', () => {
  it('parses metric param with default', () => {
    expect(parseAnalyticsMetric(null)).toBe('all');
    expect(parseAnalyticsMetric('revenue')).toBe('revenue');
  });

  it('builds shareable analytics URLs', () => {
    expect(buildAnalyticsUrl('7d', null, 'all')).toBe('/analytics?branchId=all');
    expect(buildAnalyticsUrl('30d', 'b1', 'patients')).toBe(
      '/analytics?range=30d&branchId=b1&metric=patients',
    );
  });

  it('filters sections by focused metric', () => {
    expect(metricShowsSection('all', 'revenue')).toBe(true);
    expect(metricShowsSection('revenue', 'revenue')).toBe(true);
    expect(metricShowsSection('revenue', 'patients')).toBe(false);
  });
});
