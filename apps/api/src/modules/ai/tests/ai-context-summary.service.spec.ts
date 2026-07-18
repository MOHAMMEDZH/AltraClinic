import { AiContextSummaryService } from '../application/services/ai-context-summary.service';
import { PrismaService } from '../../../infrastructure/prisma.service';

describe('AiContextSummaryService', () => {
  it('returns module and patient summary', async () => {
    const prisma = {
      patient: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'p1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          firstNameAr: null,
          lastNameAr: null,
        }),
      },
    } as unknown as PrismaService;

    const svc = new AiContextSummaryService(prisma);
    const result = await svc.summarize('tenant', {
      path: '/patients/p1',
      patientId: 'p1',
    });

    expect(result.module).toBe('patients');
    expect(result.moduleLabelKey).toBe('ai.context.modules.patients');
    expect(result.items.some((item) => item.key === 'patient' && item.value.includes('Ada'))).toBe(true);
  });

  it('includes inventory item on item detail route', async () => {
    const prisma = {
      inventoryItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'i1',
          sku: 'SKU-1',
          nameEn: 'Gauze',
          nameAr: null,
          quantityOnHand: 12,
          unit: 'box',
        }),
      },
    } as unknown as PrismaService;

    const svc = new AiContextSummaryService(prisma);
    const result = await svc.summarize('tenant', {
      path: '/inventory/items/i1',
      inventoryItemId: 'i1',
    });

    expect(result.module).toBe('inventory');
    expect(result.items.some((item) => item.key === 'inventoryItem')).toBe(true);
  });

  it('resolves report metadata for sidebar display', async () => {
    const prisma = {
      operationalReportRecord: {
        findFirst: jest.fn().mockResolvedValue({
          name: 'Monthly Revenue',
          reportType: 'financial',
          status: 'COMPLETED',
        }),
      },
      analyticsReportRecord: { findFirst: jest.fn().mockResolvedValue(null) },
      reportCustomDefinitionRecord: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    const svc = new AiContextSummaryService(prisma);
    const result = await svc.summarize('tenant', {
      path: '/reports/report-1',
      reportId: 'report-1',
    });

    const report = result.items.find((item) => item.key === 'report');
    expect(report?.value).toContain('Monthly Revenue');
  });
});
