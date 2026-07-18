import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EmrEncounterService } from '../application/services/emr-encounter.service';
import { PrismaService } from '../../../infrastructure/prisma.service';

describe('EmrEncounterService', () => {
  let service: EmrEncounterService;

  const prisma = {
    encounter: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmrEncounterService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(EmrEncounterService);
  });

  it('rejects updates on signed encounters', async () => {
    prisma.encounter.findFirst.mockResolvedValue({
      id: 'e1',
      tenantId: 't1',
      branchId: null,
      patientId: 'p1',
      clinicianId: 'u1',
      appointmentId: null,
      chiefComplaint: 'Test',
      status: 'SIGNED',
      diagnoses: [],
      medications: [],
      observations: [],
      soapNotes: null,
      followUpDate: null,
      completedAt: new Date(),
      signedAt: new Date(),
      signedBy: 'u1',
      createdAt: new Date(),
      updatedAt: new Date(),
      patient: { firstName: 'Sarah', lastName: 'Hassan' },
    });

    await expect(
      service.updateClinical('e1', 't1', { chiefComplaint: 'Changed' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates encounters with IN_PROGRESS status', async () => {
    const createdAt = new Date();
    prisma.encounter.create.mockResolvedValue({
      id: 'enc-new',
      tenantId: 't1',
      branchId: 'b1',
      patientId: 'p1',
      clinicianId: 'u1',
      appointmentId: null,
      chiefComplaint: 'Headache',
      status: 'IN_PROGRESS',
      diagnoses: [],
      medications: [],
      observations: [],
      soapNotes: null,
      followUpDate: null,
      completedAt: null,
      signedAt: null,
      signedBy: null,
      createdAt,
      updatedAt: createdAt,
      patient: { firstName: 'Sarah', lastName: 'Hassan' },
    });

    const detail = await service.create('t1', 'b1', {
      patientId: 'p1',
      clinicianId: 'u1',
      chiefComplaint: 'Headache',
    });

    expect(prisma.encounter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'IN_PROGRESS', chiefComplaint: 'Headache' }),
      }),
    );
    expect(detail.status).toBe('in_progress');
    expect(detail.isReadOnly).toBe(false);
  });
});
