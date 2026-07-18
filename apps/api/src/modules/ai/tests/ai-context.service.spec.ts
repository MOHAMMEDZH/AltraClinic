import { AiContextService } from '../application/services/ai-context.service';
import { PrismaService } from '../../../infrastructure/prisma.service';

const TENANT = 'tenant-1';

function buildService(prisma: unknown) {
  return new AiContextService(prisma as PrismaService);
}

describe('AiContextService', () => {
  it('enriches with patient and route context', async () => {
    const prisma = {
      patient: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'p1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          nationalId: 'N1',
          dateOfBirth: new Date('1815-12-10'),
          gender: 'female',
          bloodGroup: 'O+',
          profileData: { allergies: ['penicillin'] },
        }),
      },
      encounter: { findMany: jest.fn().mockResolvedValue([]) },
      aiMessage: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = buildService(prisma);
    const enriched = await svc.enrich({
      tenantId: TENANT,
      userId: 'u1',
      userMessage: 'Summarize allergies',
      context: { patientId: 'p1', path: '/patients/p1' },
    });

    expect(enriched.systemPrompt).toContain('Ada Lovelace');
    expect(enriched.systemPrompt).toContain('/patients/p1');
    expect(enriched.citations.some((c) => c.resourceType === 'patient')).toBe(true);
    expect(enriched.userParts[0].text).toContain('Summarize allergies');
  });

  it('skips history when saveHistory is false', async () => {
    const prisma = {
      aiMessage: { findMany: jest.fn() },
    };
    const svc = buildService(prisma);
    await svc.enrich({
      tenantId: TENANT,
      userId: 'u1',
      userMessage: 'Hi',
      conversationId: 'c1',
      preferences: { saveHistory: false },
    });
    expect(prisma.aiMessage.findMany).not.toHaveBeenCalled();
  });

  it('enriches appointment and inventory context blocks', async () => {
    const prisma = {
      patient: { findFirst: jest.fn() },
      encounter: { findMany: jest.fn() },
      appointment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'a1',
          scheduledStart: new Date('2026-01-01T10:00:00Z'),
          scheduledEnd: new Date('2026-01-01T10:30:00Z'),
          status: 'CONFIRMED',
          serviceType: 'consultation',
          notes: null,
          patient: { firstName: 'Ada', lastName: 'Lovelace' },
        }),
      },
      inventoryItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'i1',
          sku: 'SKU-1',
          nameEn: 'Gauze',
          quantityOnHand: 5,
          reorderThreshold: 2,
          unit: 'box',
          expiryDate: null,
        }),
      },
      aiMessage: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = buildService(prisma);
    const enriched = await svc.enrich({
      tenantId: TENANT,
      userId: 'u1',
      userMessage: 'Review stock',
      context: {
        path: '/inventory/items/i1',
        module: 'inventory',
        appointmentId: 'a1',
        inventoryItemId: 'i1',
      },
    });

    expect(enriched.systemPrompt).toContain('Appointment:');
    expect(enriched.systemPrompt).toContain('Inventory item: Gauze');
    expect(enriched.citations.some((c) => c.resourceType === 'inventory_item')).toBe(true);
  });
});
