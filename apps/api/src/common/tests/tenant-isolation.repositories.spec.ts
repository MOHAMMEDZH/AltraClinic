/**
 * Cross-module tenant isolation contract tests.
 * Verifies repositories always include tenantId in Prisma WHERE clauses.
 */
import { PrismaMetricRepository } from '../../modules/analytics/infrastructure/prisma-metric.repository';
import { PrismaInvoiceRepository } from '../../modules/billing/infrastructure/prisma-invoice.repository';

describe('Tenant isolation — repository contracts', () => {
  describe('PrismaMetricRepository', () => {
    it('never queries without tenantId on findById', async () => {
      const prisma = {
        analyticsMetricRecord: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      const repo = new PrismaMetricRepository(prisma as never);
      await repo.findById('m1', 'tenant-x');
      expect(prisma.analyticsMetricRecord.findFirst).toHaveBeenCalledWith({
        where: { id: 'm1', tenantId: 'tenant-x' },
      });
    });
  });

  describe('PrismaInvoiceRepository', () => {
    it('never queries without tenantId on findById', async () => {
      const prisma = {
        invoice: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      const repo = new PrismaInvoiceRepository(prisma as never);
      await repo.findById('inv-1', 'tenant-y');
      expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-y' }),
        }),
      );
    });
  });
});
