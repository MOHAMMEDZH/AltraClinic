import { describe, expect, it } from 'vitest';
import {
  buildDashboardRangeQuery,
  defaultCustomRange,
  parseDashboardCustomRangeParams,
  parseIsoDateParam,
} from './dashboard-range';

describe('dashboard-range', () => {
  it('parses ISO date params', () => {
    expect(parseIsoDateParam('2026-06-01')).toBe('2026-06-01');
    expect(parseIsoDateParam('invalid')).toBeNull();
  });

  it('builds preset range query', () => {
    expect(buildDashboardRangeQuery('90d', defaultCustomRange())).toEqual({ range: '90d' });
  });

  it('builds custom range query', () => {
    expect(
      buildDashboardRangeQuery('custom', { from: '2026-06-01', to: '2026-06-15' }),
    ).toEqual({ range: 'custom', from: '2026-06-01', to: '2026-06-15' });
  });

  it('falls back when custom params are invalid', () => {
    const range = parseDashboardCustomRangeParams(null, null);
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
