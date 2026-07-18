import { Test, TestingModule } from '@nestjs/testing';
import { QueueNotificationService } from '../application/services/queue-notification.service';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { NotificationIntentProducerService } from '../../notifications/delivery/notification-intent-producer.service';

describe('QueueNotificationService', () => {
  let service: QueueNotificationService;
  const prisma = {
    patient: { findFirst: jest.fn() },
  };
  const producer = {
    produceChannels: jest.fn().mockResolvedValue({ intentId: 'intent-1', notificationId: 'notif-1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueNotificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationIntentProducerService, useValue: producer },
      ],
    }).compile();
    service = module.get(QueueNotificationService);
  });

  const item = {
    queueTicketId: 'q1',
    tenantId: 't1',
    branchId: 'b1',
    appointmentId: 'a1',
    patientId: 'p1',
    patientName: 'Sarah Hassan',
    providerId: 'u1',
    scheduledStart: new Date().toISOString(),
    scheduledEnd: new Date().toISOString(),
    status: 'called' as const,
    priority: 'appointment' as const,
    position: 1,
    checkedInAt: null,
    calledAt: null,
    servedAt: null,
    completedAt: null,
    waitTimeSeconds: null,
    estimatedWaitMinutes: 5,
    etaAt: null,
    resourceId: null,
    resourceName: 'Room 1',
    elapsedWaitSeconds: null,
  };

  it('produces SMS, in-app, and push channels when patient has phone', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1', phone: '+963900000001' });

    await service.notifyCalled(item);

    expect(producer.produceChannels).toHaveBeenCalledTimes(1);
    expect(producer.produceChannels).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'p1',
        channels: ['sms', 'in-app', 'push'],
        metadata: expect.objectContaining({ recipientPhone: '+963900000001' }),
      }),
    );
  });

  it('skips SMS channel when patient has no phone', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'p1', phone: null });

    await service.notifyCalled(item);

    expect(producer.produceChannels).toHaveBeenCalledTimes(1);
    expect(producer.produceChannels).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: ['in-app', 'push'],
      }),
    );
  });

  it('does nothing when patient is not found', async () => {
    prisma.patient.findFirst.mockResolvedValue(null);

    await service.notifyCalled(item);

    expect(producer.produceChannels).not.toHaveBeenCalled();
  });
});
