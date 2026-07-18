import { describe, expect, it } from 'vitest';
import { formatAnalyticsKpiValue } from '../lib/format-analytics-kpi';

describe('formatAnalyticsKpiValue', () => {
  it('formats currency KPIs', () => {
    const value = formatAnalyticsKpiValue(
      { id: 'r', labelKey: 'analytics.kpis.revenueMonth', value: 1200, format: 'currency' },
      'en-US',
    );
    expect(value).toContain('1');
  });

  it('formats text KPIs literally', () => {
    expect(
      formatAnalyticsKpiValue(
        { id: 't', labelKey: 'analytics.staff.providerCount', value: 'Dr. Smith', format: 'text' },
        'en-US',
      ),
    ).toBe('Dr. Smith');
  });
});
