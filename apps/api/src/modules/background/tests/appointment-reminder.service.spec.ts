import { AppointmentReminderService } from '../application/services/appointment-reminder.service';

describe('AppointmentReminderService', () => {
  const prisma = {
    appointment: { findMany: jest.fn().mockResolvedValue([]) },
    appointmentReminderLog: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    portalAccount: { findFirst: jest.fn().mockResolvedValue({ userId: 'user-1' }) },
  };
  const producer = { produceInApp: jest.fn().mockResolvedValue({ intentId: 'intent-1', notificationId: 'notif-1' }) };

  const licensing = { allowWorkerExecution: jest.fn().mockResolvedValue(true) };

  const svc = new AppointmentReminderService(
    prisma as any,
    producer as any,
    licensing as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('sends 24h reminder for eligible appointment', async () => {
    const now = new Date('2026-06-14T10:00:00.000Z');
    const scheduledStart = new Date('2026-06-15T09:30:00.000Z');

    prisma.appointment.findMany.mockImplementation(async (args: { where: { scheduledStart: { gte: Date; lte: Date } } }) => {
      const { gte, lte } = args.where.scheduledStart;
      if (scheduledStart >= gte && scheduledStart <= lte) {
        return [
          {
            id: 'appt-1',
            tenantId: 'tenant-1',
            branchId: 'branch-1',
            patientId: 'patient-1',
            scheduledStart,
            patient: { firstName: 'Sam', lastName: 'Patient' },
          },
        ];
      }
      return [];
    });

    const result = await svc.scanAndSendReminders(now);
    expect(result.remindersSent).toBe(1);
    expect(producer.produceInApp).toHaveBeenCalled();
    expect(prisma.appointmentReminderLog.create).toHaveBeenCalled();
  });

  it('skips duplicate reminders', async () => {
    const now = new Date('2026-06-14T10:00:00.000Z');
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: 'appt-dup',
        tenantId: 'tenant-1',
        branchId: null,
        patientId: 'patient-1',
        scheduledStart: new Date('2026-06-15T09:30:00.000Z'),
        patient: { firstName: 'A', lastName: 'B' },
      },
    ]);
    prisma.appointmentReminderLog.findUnique.mockResolvedValue({ id: 'log-1' });

    const result = await svc.scanAndSendReminders(now);
    expect(result.remindersSent).toBe(0);
    expect(result.duplicatesSkipped).toBeGreaterThan(0);
  });
});
