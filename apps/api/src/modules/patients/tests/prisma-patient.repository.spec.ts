import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPatientRepository } from '../infrastructure/prisma-patient.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Patient } from '../domain/patient.entity';
import { PatientNameVO } from '../domain/patient-name.vo';
import { AddressVO } from '../domain/address.vo';

const mockTx = {
  patient: { upsert: jest.fn() },
  patientAddress: { deleteMany: jest.fn(), createMany: jest.fn() },
};

const mockPrismaService = {
  $transaction: jest.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
  patient: {
    findFirst: jest.fn(),
  },
};

const TENANT_ID = 'tenant-001';

function makePatient(): Patient {
  const name = new PatientNameVO('Ahmed', 'Al-Rashidi');
  return new Patient('patient-001', TENANT_ID, null, name, '1990-05-15', 'male', [], new Date());
}

const prismaRow = (p: Patient) => ({
  id: p.id,
  tenantId: p.tenantId,
  branchId: p.branchId,
  firstName: p.name.firstName,
  lastName: p.name.lastName,
  firstNameAr: null,
  lastNameAr: null,
  dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
  gender: p.gender,
  addresses: [],
  createdAt: p.createdAt,
  updatedAt: p.createdAt,
  deletedAt: null,
});

describe('PrismaPatientRepository', () => {
  let repo: PrismaPatientRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaPatientRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaPatientRepository>(PrismaPatientRepository);
  });

  describe('save()', () => {
    it('upserts patient with name fields and gender', async () => {
      const patient = makePatient();
      await repo.save(patient);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockTx.patient.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            tenantId: TENANT_ID,
            firstName: 'Ahmed',
            lastName: 'Al-Rashidi',
            gender: 'male',
          }),
        }),
      );
    });

    it('deletes and recreates addresses in the same transaction', async () => {
      const name = new PatientNameVO('Fatima', 'Noor');
      const address = new AddressVO('123 Main St', 'Dubai', null, '00000', 'UAE');
      const patient = new Patient('patient-002', TENANT_ID, null, name, null, null, [address], new Date());

      await repo.save(patient);

      expect(mockTx.patientAddress.deleteMany).toHaveBeenCalledWith({ where: { patientId: 'patient-002' } });
      expect(mockTx.patientAddress.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([expect.objectContaining({ line1: '123 Main St', city: 'Dubai' })]),
        }),
      );
    });

    it('converts dateOfBirth string to Date', async () => {
      const patient = makePatient();
      await repo.save(patient);

      expect(mockTx.patient.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ dateOfBirth: expect.any(Date) }),
        }),
      );
    });
  });

  describe('findById()', () => {
    it('returns null when not found', async () => {
      mockPrismaService.patient.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findById('p-999', TENANT_ID);
      expect(result).toBeNull();
    });

    it('queries with soft delete guard', async () => {
      mockPrismaService.patient.findFirst.mockResolvedValueOnce(null);
      await repo.findById('patient-001', TENANT_ID);

      expect(mockPrismaService.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    it('reconstructs Patient with PatientNameVO', async () => {
      const patient = makePatient();
      mockPrismaService.patient.findFirst.mockResolvedValueOnce(prismaRow(patient));

      const result = await repo.findById(patient.id, TENANT_ID);

      expect(result).not.toBeNull();
      expect(result!.name.firstName).toBe('Ahmed');
      expect(result!.name.lastName).toBe('Al-Rashidi');
      expect(result!.gender).toBe('male');
    });

    it('reconstructs addresses from address relation', async () => {
      const patient = makePatient();
      mockPrismaService.patient.findFirst.mockResolvedValueOnce({
        ...prismaRow(patient),
        addresses: [{ id: 'addr-1', line1: '10 Test Rd', city: 'Abu Dhabi', state: null, postalCode: null, country: 'AE' }],
      });

      const result = await repo.findById(patient.id, TENANT_ID);
      expect(result!.addresses).toHaveLength(1);
      expect(result!.addresses[0].city).toBe('Abu Dhabi');
    });
  });

  describe('findByIdentifier()', () => {
    it('queries using nationalId field', async () => {
      mockPrismaService.patient.findFirst.mockResolvedValueOnce(null);
      await repo.findByIdentifier('MRN-001', TENANT_ID);

      expect(mockPrismaService.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ nationalId: 'MRN-001' }),
        }),
      );
    });
  });
});
