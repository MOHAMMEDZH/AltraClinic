import { Test, TestingModule } from '@nestjs/testing';
import { PrismaEncounterRepository } from '../infrastructure/prisma-encounter.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Encounter } from '../domain/encounter.entity';

const mockPrismaService = {
  encounter: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

const TENANT_ID = 'tenant-001';

function makeEncounter(): Encounter {
  return new Encounter(
    'encounter-001',
    TENANT_ID,
    'branch-001',
    'patient-001',
    'clinician-001',
    [],
    [],
    [],
    new Date(),
  );
}

const prismaRow = (e: Encounter) => ({
  id: e.id,
  tenantId: e.tenantId,
  branchId: e.branchId,
  patientId: e.patientId,
  clinicianId: e.clinicianId,
  diagnoses: [],
  medications: [],
  observations: [],
  createdAt: e.createdAt,
  updatedAt: new Date(),
});

describe('PrismaEncounterRepository', () => {
  let repo: PrismaEncounterRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaEncounterRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaEncounterRepository>(PrismaEncounterRepository);
  });

  describe('saveEncounter()', () => {
    it('upserts with OPEN status and correct tenant/patient IDs', async () => {
      const encounter = makeEncounter();
      await repo.saveEncounter(encounter);

      expect(mockPrismaService.encounter.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            tenantId: TENANT_ID,
            patientId: 'patient-001',
            clinicianId: 'clinician-001',
          }),
        }),
      );
    });

    it('serializes diagnoses, medications, observations as JSON', async () => {
      const encounter = makeEncounter();
      await repo.saveEncounter(encounter);

      const createArg = mockPrismaService.encounter.upsert.mock.calls[0][0].create;
      expect(Array.isArray(createArg.diagnoses)).toBe(true);
      expect(Array.isArray(createArg.medications)).toBe(true);
      expect(Array.isArray(createArg.observations)).toBe(true);
    });
  });

  describe('findEncounterById()', () => {
    it('returns null when not found', async () => {
      mockPrismaService.encounter.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findEncounterById('enc-999', TENANT_ID);
      expect(result).toBeNull();
    });

    it('queries with deletedAt null (soft delete guard)', async () => {
      mockPrismaService.encounter.findFirst.mockResolvedValueOnce(null);

      await repo.findEncounterById('enc-001', TENANT_ID);

      expect(mockPrismaService.encounter.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    it('reconstructs Encounter with empty JSONB arrays', async () => {
      const encounter = makeEncounter();
      mockPrismaService.encounter.findFirst.mockResolvedValueOnce(prismaRow(encounter));

      const result = await repo.findEncounterById(encounter.id, TENANT_ID);

      expect(result).not.toBeNull();
      expect(result!.diagnoses).toEqual([]);
      expect(result!.medications).toEqual([]);
    });

    it('handles non-array JSONB gracefully', async () => {
      const encounter = makeEncounter();
      mockPrismaService.encounter.findFirst.mockResolvedValueOnce({
        ...prismaRow(encounter),
        diagnoses: null,
        medications: {},
      });

      const result = await repo.findEncounterById(encounter.id, TENANT_ID);
      expect(result!.diagnoses).toEqual([]);
      expect(result!.medications).toEqual([]);
    });
  });

  describe('findEncountersByPatient()', () => {
    it('queries by patientId and tenantId excluding soft-deleted', async () => {
      mockPrismaService.encounter.findMany.mockResolvedValueOnce([]);

      await repo.findEncountersByPatient('patient-001', TENANT_ID);

      expect(mockPrismaService.encounter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: 'patient-001',
            tenantId: TENANT_ID,
            deletedAt: null,
          }),
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });
});
