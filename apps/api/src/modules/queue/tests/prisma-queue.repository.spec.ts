import { Test, TestingModule } from '@nestjs/testing';
import { PrismaQueueRepository } from '../infrastructure/prisma-queue.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { QueueTicket } from '../domain/queue-ticket.entity';

const mockPrismaService = {
  queueTicket: {
    upsert: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
};

const TENANT_ID = 'tenant-001';
const BRANCH_ID = 'branch-001';

function makeTicket(): QueueTicket {
  return QueueTicket.create({
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    appointmentId: 'appt-001',
    patientId: 'patient-001',
    providerId: 'provider-001',
    scheduledStart: new Date('2026-01-01T09:00:00Z').toISOString(),
    scheduledEnd: new Date('2026-01-01T09:30:00Z').toISOString(),
  });
}

describe('PrismaQueueRepository', () => {
  let repo: PrismaQueueRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaQueueRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaQueueRepository>(PrismaQueueRepository);
  });

  describe('save()', () => {
    it('upserts ticket with WAITING status', async () => {
      const ticket = makeTicket();
      await repo.save(ticket);

      expect(mockPrismaService.queueTicket.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            tenantId: TENANT_ID,
            branchId: BRANCH_ID,
            status: 'WAITING',
          }),
          update: expect.objectContaining({ status: 'WAITING' }),
        }),
      );
    });

    it('maps serving status to SERVING', async () => {
      const ticket = makeTicket();
      ticket.status = 'serving';
      await repo.save(ticket);

      expect(mockPrismaService.queueTicket.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: 'SERVING' }),
        }),
      );
    });

    it('maps completed status to COMPLETED', async () => {
      const ticket = makeTicket();
      ticket.status = 'completed';
      await repo.save(ticket);

      expect(mockPrismaService.queueTicket.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });
  });

  describe('existsByAppointmentId()', () => {
    it('returns true when count > 0', async () => {
      mockPrismaService.queueTicket.count.mockResolvedValueOnce(1);

      const result = await repo.existsByAppointmentId('appt-001', TENANT_ID);

      expect(result).toBe(true);
      expect(mockPrismaService.queueTicket.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { appointmentId: 'appt-001', tenantId: TENANT_ID } }),
      );
    });

    it('returns false when count === 0', async () => {
      mockPrismaService.queueTicket.count.mockResolvedValueOnce(0);
      const result = await repo.existsByAppointmentId('appt-999', TENANT_ID);
      expect(result).toBe(false);
    });
  });

  describe('listWaiting()', () => {
    it('queries WAITING status ordered by scheduledStart', async () => {
      mockPrismaService.queueTicket.findMany.mockResolvedValueOnce([]);

      await repo.listWaiting(TENANT_ID, BRANCH_ID);

      expect(mockPrismaService.queueTicket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID, status: 'WAITING', branchId: BRANCH_ID }),
          orderBy: { scheduledStart: 'asc' },
        }),
      );
    });

    it('omits branchId filter when not provided', async () => {
      mockPrismaService.queueTicket.findMany.mockResolvedValueOnce([]);

      await repo.listWaiting(TENANT_ID);

      const callArg = mockPrismaService.queueTicket.findMany.mock.calls[0][0];
      expect(callArg.where.branchId).toBeUndefined();
    });

    it('reconstructs QueueTicket domain objects', async () => {
      const ticket = makeTicket();
      const row = {
        id: ticket.queueTicketId,
        tenantId: ticket.tenantId,
        branchId: ticket.branchId,
        appointmentId: ticket.appointmentId,
        patientId: ticket.patientId,
        providerId: ticket.providerId,
        scheduledStart: new Date(ticket.scheduledStart),
        scheduledEnd: new Date(ticket.scheduledEnd),
        status: 'WAITING' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.queueTicket.findMany.mockResolvedValueOnce([row]);

      const results = await repo.listWaiting(TENANT_ID);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('waiting');
    });
  });
});
