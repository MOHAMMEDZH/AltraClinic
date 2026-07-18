import { PrismaGlobalSearchRepository } from '../infrastructure/prisma-global-search.repository';
import { SEARCH_ENTITY_TYPES } from '../domain/search.types';

describe('PrismaGlobalSearchRepository', () => {
  const prisma = {
    patient: { findMany: jest.fn() },
    appointment: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
    dentalToothCondition: { findMany: jest.fn() },
    beautyAnnotation: { findMany: jest.fn() },
    invoice: { findMany: jest.fn() },
    inventoryItem: { findMany: jest.fn() },
  };
  const reportRepository = { list: jest.fn().mockResolvedValue([]) };

  const repo = new PrismaGlobalSearchRepository(prisma as any, reportRepository as any);

  beforeEach(() => jest.clearAllMocks());

  it('searches patients with tenant scope', async () => {
    prisma.patient.findMany.mockResolvedValue([
      {
        id: 'p1',
        tenantId: 't1',
        branchId: null,
        firstName: 'Ahmed',
        lastName: 'Hassan',
        phone: '+963111',
        email: null,
        nationalId: null,
        createdAt: new Date(),
      },
    ]);

    const hits = await repo.search({
      tenantId: 't1',
      query: 'Ahmed',
      types: [SEARCH_ENTITY_TYPES.PATIENT],
      limit: 10,
      page: 1,
    });

    expect(hits).toHaveLength(1);
    expect(hits[0].title).toBe('Ahmed Hassan');
    expect(prisma.patient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 't1', deletedAt: null }),
      }),
    );
  });

  it('runs parallel queries for multiple types', async () => {
    prisma.patient.findMany.mockResolvedValue([]);
    prisma.appointment.findMany.mockResolvedValue([]);

    await repo.search({
      tenantId: 't1',
      query: 'test',
      types: [SEARCH_ENTITY_TYPES.PATIENT, SEARCH_ENTITY_TYPES.APPOINTMENT],
      limit: 10,
      page: 1,
    });

    expect(prisma.patient.findMany).toHaveBeenCalled();
    expect(prisma.appointment.findMany).toHaveBeenCalled();
  });
});
