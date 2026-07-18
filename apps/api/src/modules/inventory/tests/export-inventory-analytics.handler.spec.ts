import { ExportInventoryAnalyticsHandler } from '../application/handlers/export-inventory-analytics.handler';

describe('ExportInventoryAnalyticsHandler', () => {
  it('builds csv with valuation header', async () => {
    const analyticsHandler = {
      execute: jest.fn().mockResolvedValue({
        periodDays: 30,
        generatedAt: '2026-06-20T12:00:00.000Z',
        valuation: { totalStockValue: 100, itemCount: 2, byCategory: [] },
        stockHealth: { lowStock: 1, outOfStock: 0, expiringSoon: 0, expired: 0 },
        consumption: { totalQuantity: 5, eventCount: 2, byDay: [], topItems: [], byCategory: [], byProcedure: [] },
        procurement: { activeSupplierCount: 1, orderedValue: 0, receivedValue: 0, byStatus: [], topSuppliers: [] },
        movements: { byType: [] },
      }),
    };

    const handler = new ExportInventoryAnalyticsHandler(analyticsHandler as never);
    const csv = await handler.execute(30);

    expect(csv).toContain('Inventory Analytics Report');
    expect(csv).toContain('Total Stock Value,100');
    expect(csv).toContain('Low Stock,1');
  });
});
