import { inferAiModule, inferAnalyticsDomain, inferInventoryItemId, inferReportId } from '../domain/config/ai-route-context.config';

describe('ai-route-context.config', () => {
  it('infers modules and resource ids from paths', () => {
    expect(inferAiModule('/workflows/instances/w1')).toBe('workflow');
    expect(inferInventoryItemId('/inventory/items/i1')).toBe('i1');
    expect(inferReportId('/reports/monthly-revenue')).toBe('monthly-revenue');
    expect(inferAnalyticsDomain('/analytics/financial')).toBe('financial');
    expect(inferReportId('/reports/builder')).toBeUndefined();
  });
});
