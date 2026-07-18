import { OutboxEventRehydratorService } from '../application/services/outbox-event-rehydrator.service';
import { NotificationCreatedEvent } from '../../notifications/domain/events/notification-created.event';
import { AppointmentScheduledEvent } from '../../scheduling/domain/events/appointment-scheduled.event';

describe('OutboxEventRehydratorService', () => {
  const rehydrator = new OutboxEventRehydratorService();

  it('rehydrates known event types with correct prototype', () => {
    const payload = {
      tenantId: 't1',
      branchId: null,
      notificationId: 'n1',
      recipientId: 'u1',
      channel: 'in-app',
      priority: 'high',
      eventId: 'evt-1',
      occurredAt: new Date().toISOString(),
    };

    const event = rehydrator.rehydrate('NotificationCreatedEvent', payload);
    expect(event).toBeInstanceOf(NotificationCreatedEvent);
    expect((event as NotificationCreatedEvent).tenantId).toBe('t1');
  });

  it('returns null for unknown event types', () => {
    expect(rehydrator.rehydrate('UnknownEvent', {})).toBeNull();
  });

  it('supports runtime registration', () => {
    class CustomEvent extends AppointmentScheduledEvent {}
    rehydrator.register('CustomEvent', CustomEvent as any);
    const event = rehydrator.rehydrate('CustomEvent', {
      tenantId: 't1',
      branchId: null,
      appointmentId: 'a1',
      patientId: 'p1',
      providerId: 'd1',
      start: '2026-01-01T10:00:00Z',
      end: '2026-01-01T11:00:00Z',
    });
    expect(event).toBeInstanceOf(CustomEvent);
  });
});
