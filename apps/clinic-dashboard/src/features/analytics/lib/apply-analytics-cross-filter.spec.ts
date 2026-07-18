import { describe, expect, it } from 'vitest';
import type { AnalyticsDomainOverview } from '../api/analytics-api';
import {
  applyCrossFilterToOverview,
  chartDimensionFromPoint,
} from './apply-analytics-cross-filter';

const overview: AnalyticsDomainOverview = {
  domainId: 'financial',
  generatedAt: '2026-06-20T00:00:00.000Z',
  kpis: [],
  charts: [
    {
      id: 'paymentMethods',
      type: 'pie',
      titleKey: 'analytics.financial.paymentMethods',
      data: [
        { method: 'cash', value: 100 },
        { method: 'card', value: 200 },
      ],
    },
    {
      id: 'revenueTrend',
      type: 'bar',
      titleKey: 'analytics.financial.revenueTrend',
      data: [
        { method: 'cash', amount: 50 },
        { method: 'card', amount: 75 },
      ],
    },
  ],
  tables: [
    {
      id: 'invoices',
      titleKey: 'analytics.financial.invoiceStatus',
      columns: ['status', 'count'],
      rows: [
        { status: 'cash', count: 3 },
        { status: 'card', count: 5 },
      ],
    },
  ],
};

describe('apply-analytics-cross-filter', () => {
  it('derives dimension from chart point payload', () => {
    expect(chartDimensionFromPoint('paymentMethods', { method: 'cash', value: 100 })).toEqual({
      chartId: 'paymentMethods',
      dimension: 'method',
      value: 'cash',
    });
  });

  it('filters peer charts and tables when selection is active', () => {
    const filtered = applyCrossFilterToOverview(overview, {
      chartId: 'paymentMethods',
      dimension: 'method',
      value: 'cash',
    });

    const barChart = filtered.charts.find((c) => c.id === 'revenueTrend');
    expect(barChart?.data).toEqual([{ method: 'cash', amount: 50 }]);

    expect(filtered.tables[0].rows).toEqual([{ status: 'cash', count: 3 }]);
  });

  it('returns original overview when selection is cleared', () => {
    expect(applyCrossFilterToOverview(overview, null)).toBe(overview);
  });
});
