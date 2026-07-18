import { Test, TestingModule } from '@nestjs/testing';
import { PrismaAuditEntryRepository } from '../infrastructure/prisma-audit-entry.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AuditEntry } from '../domain/audit-entry.entity';
import { LocalizedTextVO } from '../domain/value-objects/localized-text.vo';

const mockPrismaService = {
  auditEntry: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

const TENANT_ID = 'tenant-001';

function makeAuditEntry(): AuditEntry {
  return new AuditEntry(
    'audit-001',
    TENANT_ID,
    'branch-001',
    'UPDATE',
    'Patient',
    'patient-001',
    'user-001',
    ['doctor'],
    { field: 'name' },
    { name: { before: 'Old Name', after: 'New Name' } },
    'clinical',
    new LocalizedTextVO(null, 'تغيير اسم المريض'),
    'Correcting patient record',
    '192.168.1.1',
    'Mozilla/5.0',
    'corr-001',
    'ar',
    new Date('2024-01-15'),
  );
}

describe('PrismaAuditEntryRepository', () => {
  let repo: PrismaAuditEntryRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaAuditEntryRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaAuditEntryRepository>(PrismaAuditEntryRepository);
  });

  describe('save()', () => {
    it('uses create (not upsert) to enforce append-only', async () => {
      const entry = makeAuditEntry();
      await repo.save(entry);

      // Must call create, never upsert
      expect(mockPrismaService.auditEntry.create).toHaveBeenCalled();
      expect(mockPrismaService.auditEntry).not.toHaveProperty('upsert');
    });

    it('persists all mandatory fields', async () => {
      const entry = makeAuditEntry();
      await repo.save(entry);

      const call = mockPrismaService.auditEntry.create.mock.calls[0][0].data;
      expect(call.id).toBe('audit-001');
      expect(call.tenantId).toBe(TENANT_ID);
      expect(call.action).toBe('UPDATE');
      expect(call.resourceType).toBe('Patient');
      expect(call.actorId).toBe('user-001');
    });

    it('serialises LocalizedTextVO as JSON object', async () => {
      const entry = makeAuditEntry();
      await repo.save(entry);

      const call = mockPrismaService.auditEntry.create.mock.calls[0][0].data;
      // description is stored as descriptionAr/descriptionEn separate text columns
      expect(call.descriptionAr).toBe('تغيير اسم المريض');
    });
  });

  describe('findById()', () => {
    it('returns null when not found', async () => {
      mockPrismaService.auditEntry.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findById('nonexistent', TENANT_ID);
      expect(result).toBeNull();
    });

    it('reconstructs AuditEntry with LocalizedTextVO', async () => {
      mockPrismaService.auditEntry.findFirst.mockResolvedValueOnce({
        id: 'audit-001',
        tenantId: TENANT_ID,
        branchId: 'branch-001',
        action: 'UPDATE',
        resourceType: 'Patient',
        resourceId: 'patient-001',
        actorId: 'user-001',
        actorRoles: ['doctor'],
        details: { field: 'name' },
        changes: {},
        category: 'clinical',
        descriptionAr: 'وصف',
        descriptionEn: null,
        reason: null,
        ipAddress: null,
        userAgent: null,
        correlationId: null,
        locale: 'ar',
        createdAt: new Date('2024-01-15'),
      });

      const result = await repo.findById('audit-001', TENANT_ID);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('audit-001');
      expect(result!.description).toBeInstanceOf(LocalizedTextVO);
    });
  });

  describe('search()', () => {
    it('applies tenantId filter', async () => {
      mockPrismaService.auditEntry.findMany.mockResolvedValueOnce([]);

      await repo.search({ tenantId: TENANT_ID, limit: 10, offset: 0 });

      expect(mockPrismaService.auditEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID }),
        }),
      );
    });

    it('applies optional filters when provided', async () => {
      mockPrismaService.auditEntry.findMany.mockResolvedValueOnce([]);

      await repo.search({
        tenantId: TENANT_ID,
        action: 'UPDATE',
        actorId: 'user-001',
        limit: 5,
        offset: 0,
      });

      expect(mockPrismaService.auditEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: 'UPDATE',
            actorId: 'user-001',
          }),
          take: 5,
          skip: 0,
        }),
      );
    });
  });
});
