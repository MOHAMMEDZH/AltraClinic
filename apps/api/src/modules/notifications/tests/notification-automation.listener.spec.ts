import { NotificationAutomationListener } from '../application/integrations/notification-automation.listener';
import { NotificationAutomationExecutorService } from '../application/services/notification-automation.executor';
import { AppointmentScheduledEvent } from '../../scheduling/domain/events/appointment-scheduled.event';
import { SuspiciousLoginEvent } from '../../auth/domain/events/auth.events';

describe('NotificationAutomationListener', () => {
  it('executes rules for appointment.scheduled', async () => {
    const executor = {
      executeForEventType: jest.fn().mockResolvedValue(1),
    };
    const listener = new NotificationAutomationListener(null as never, executor as never);
    const event = new AppointmentScheduledEvent('t1', 'b1', 'a1', 'p1', 'pr1', '2026-06-01T10:00:00Z', '2026-06-01T11:00:00Z');
    await listener.handle(event);
    expect(executor.executeForEventType).toHaveBeenCalledWith('appointment.scheduled', expect.objectContaining({
      tenantId: 't1',
      patientId: 'p1',
    }));
  });

  it('executes rules for security.alert', async () => {
    const executor = {
      executeForEventType: jest.fn().mockResolvedValue(1),
    };
    const listener = new NotificationAutomationListener(null as never, executor as never);
    const event = new SuspiciousLoginEvent('t1', 'u1', '1.2.3.4', 'new device');
    await listener.handle(event);
    expect(executor.executeForEventType).toHaveBeenCalledWith('security.alert', expect.objectContaining({
      tenantId: 't1',
      userId: 'u1',
    }));
  });

  it('ignores unmapped events', async () => {
    const executor = { executeForEventType: jest.fn() };
    const listener = new NotificationAutomationListener(null as never, executor as never);
    await listener.handle({ tenantId: 't1' } as never);
    expect(executor.executeForEventType).not.toHaveBeenCalled();
  });
});

describe('NotificationAutomationExecutorService', () => {
  it('sends notifications to patient role recipients', async () => {
    const createNotification = { execute: jest.fn().mockResolvedValue({ notificationId: 'n1' }) };
    const prisma = {
      notificationAutomationRule: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'r1',
            tenantId: 't1',
            name: 'Test rule',
            channel: 'IN_APP',
            recipientRoles: ['patient'],
            template: { subjectEn: 'Hi {{patientName}}', bodyEn: 'Body {{patientName}}' },
          },
        ]),
      },
      user: { findMany: jest.fn() },
    };
    const executor = new NotificationAutomationExecutorService(prisma as never, createNotification as never);
    const sent = await executor.executeForEventType('appointment.scheduled', {
      tenantId: 't1',
      patientId: 'p1',
      variables: { patientName: 'Jane' },
    });
    expect(sent).toBe(1);
    expect(createNotification.execute).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: 'p1',
      title: 'Hi Jane',
      body: 'Body Jane',
    }));
  });
});
