import { InventoryAlertService } from '../application/services/inventory-alert.service';
import { JobDeduplicationService } from '../application/services/job-deduplication.service';
import { MockRedisService } from '../../../infrastructure/redis/tests/mock-redis.service';
import { RedisKeyBuilder } from '../../../infrastructure/redis/redis-key.builder';

describe('InventoryAlertService', () => {
  const prisma = {
    inventoryItem: { findMany: jest.fn() },
    inventoryBatch: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'inv-mgr-1' }]) },
  };
  const producer = { produceInApp: jest.fn().mockResolvedValue({ intentId: 'intent-1', notificationId: 'notif-1' }) };
  const dedup = new JobDeduplicationService(
    new MockRedisService() as any,
    new RedisKeyBuilder('app'),
  );

  const licensing = { allowWorkerExecution: jest.fn().mockResolvedValue(true) };

  const svc = new InventoryAlertService(
    prisma as any,
    producer as any,
    dedup,
    licensing as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('alerts on low stock', async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        tenantId: 't1',
        branchId: null,
        sku: 'SKU-1',
        nameEn: 'Gloves',
        unit: 'box',
        quantityOnHand: 2,
        reorderThreshold: 10,
        expiryDate: null,
      },
    ]);

    const result = await svc.scanAndSendAlerts();
    expect(result.lowStockAlerts).toBe(1);
    expect(producer.produceInApp).toHaveBeenCalled();
  });

  it('alerts on expiring inventory', async () => {
    const now = new Date('2026-06-15T09:00:00.000Z');
    prisma.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'item-2',
        tenantId: 't1',
        branchId: null,
        sku: 'SKU-2',
        nameEn: 'Serum',
        unit: 'ml',
        quantityOnHand: 50,
        reorderThreshold: 5,
        expiryDate: new Date('2026-06-20T00:00:00.000Z'),
      },
    ]);

    const result = await svc.scanAndSendAlerts(now);
    expect(result.expiryAlerts).toBe(1);
  });
});
