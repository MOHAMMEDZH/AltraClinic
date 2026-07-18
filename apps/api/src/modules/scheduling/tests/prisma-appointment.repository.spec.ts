import { Test, TestingModule } from '@nestjs/testing';
import { PrismaAppointmentRepository } from '../infrastructure/prisma-appointment.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Appointment } from '../domain/appointment.entity';
import { AppointmentStatus } from '../domain/appointment-status.enum';
import { TimeSlotVO } from '../domain/timeslot.vo';

const mockPrismaService = {
  appointment: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
  },
};

const TENANT_ID = 'tenant-001';
const SLOT = new TimeSlotVO('2024-01-15T09:00:00.000Z', '2024-01-15T10:00:00.000Z');

function makeAppointment(): Appointment {
  return new Appointment(
    'appt-001',
    TENANT_ID,
    'branch-001',
    'patient-001',
    'provider-001',
    SLOT,
    AppointmentStatus.Pending,
    new Date('2024-01-10'),
  );
}

const prismaAppointmentRow = (appt: Appointment) => ({
  id: appt.id,
  tenantId: appt.tenantId,
  branchId: appt.branchId,
  patientId: appt.patientId,
  providerId: appt.providerId,
  scheduledStart: new Date(appt.slot.start),
  scheduledEnd: new Date(appt.slot.end),
  status: 'PENDING',
  createdAt: appt.createdAt,
  updatedAt: new Date(),
  deletedAt: null,
});

describe('PrismaAppointmentRepository', () => {
  let repo: PrismaAppointmentRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaAppointmentRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaAppointmentRepository>(PrismaAppointmentRepository);
  });

  describe('save()', () => {
    it('maps domain status to uppercase Prisma enum', async () => {
      const appt = makeAppointment();
      await repo.save(appt);

      expect(mockPrismaService.appointment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });

    it('maps checked_in and in_progress statuses', async () => {
      const appt = makeAppointment();
      appt.checkIn();
      await repo.save(appt);
      expect(mockPrismaService.appointment.upsert.mock.calls.at(-1)[0].create.status).toBe(
        'CHECKED_IN',
      );

      appt.startVisit();
      await repo.save(appt);
      expect(mockPrismaService.appointment.upsert.mock.calls.at(-1)[0].create.status).toBe(
        'IN_PROGRESS',
      );
    });

    it('converts ISO slot strings to Date objects', async () => {
      const appt = makeAppointment();
      await repo.save(appt);

      const call = mockPrismaService.appointment.upsert.mock.calls[0][0];
      expect(call.create.scheduledStart).toBeInstanceOf(Date);
      expect(call.create.scheduledEnd).toBeInstanceOf(Date);
    });
  });

  describe('findById()', () => {
    it('returns null when not found', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findById('nonexistent', TENANT_ID);
      expect(result).toBeNull();
    });

    it('reconstructs appointment with correct TimeSlotVO', async () => {
      const appt = makeAppointment();
      mockPrismaService.appointment.findFirst.mockResolvedValueOnce(prismaAppointmentRow(appt));

      const result = await repo.findById('appt-001', TENANT_ID);

      expect(result).not.toBeNull();
      expect(result!.slot).toBeInstanceOf(TimeSlotVO);
      expect(result!.slot.start).toBe(new Date(SLOT.start).toISOString());
      expect(result!.status).toBe(AppointmentStatus.Pending);
    });
  });

  describe('findByProviderAndSlot()', () => {
    it('queries for overlapping slots using lt/gt range', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValueOnce(null);

      await repo.findByProviderAndSlot('provider-001', SLOT, TENANT_ID);

      expect(mockPrismaService.appointment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            providerId: 'provider-001',
            tenantId: TENANT_ID,
            scheduledStart: { lt: expect.any(Date) },
            scheduledEnd: { gt: expect.any(Date) },
          }),
        }),
      );
    });

    it('returns null when no overlap exists', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findByProviderAndSlot('provider-001', SLOT, TENANT_ID);
      expect(result).toBeNull();
    });
  });
});
