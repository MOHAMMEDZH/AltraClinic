import { RealtimeDomainEventListener } from '../application/listeners/realtime-domain-event.listener';
import { RealtimeBroadcastService } from '../application/services/realtime-broadcast.service';
import { RealtimeDashboardService } from '../application/services/realtime-dashboard.service';
import { AppointmentScheduledEvent } from '../../scheduling/domain/events/appointment-scheduled.event';
import { PatientRegisteredEvent } from '../../patients/domain/events/patient-registered.event';
import { NotificationCreatedEvent } from '../../notifications/domain/events/notification-created.event';

describe('RealtimeDomainEventListener', () => {
  let listener: RealtimeDomainEventListener;
  let broadcast: jest.Mocked<RealtimeBroadcastService>;
  let dashboard: jest.Mocked<RealtimeDashboardService>;

  beforeEach(() => {
    broadcast = {
      publish: jest.fn().mockImplementation(async (e) => ({ ...e, sequence: 1, timestamp: new Date().toISOString() })),
      setServer: jest.fn(),
      isReady: false,
      emitToUser: jest.fn(),
      emitToSocket: jest.fn(),
    } as unknown as jest.Mocked<RealtimeBroadcastService>;

    dashboard = {
      getSnapshot: jest.fn().mockResolvedValue({
        date: '2026-06-15',
        appointments: 5,
        newPatients: 2,
        activeUsers: 10,
        queue: { depth: 0, processedThisHour: 0, failedThisHour: 0, failureRate: 0 },
      }),
    } as unknown as jest.Mocked<RealtimeDashboardService>;

    listener = new RealtimeDomainEventListener(null as any, broadcast, dashboard);
  });

  it('broadcasts appointment and queue events on AppointmentScheduledEvent', async () => {
    await listener.handle(
      new AppointmentScheduledEvent('tenant-1', 'branch-1', 'appt-1', 'patient-1', 'doc-1', '2026-06-15T10:00:00Z', '2026-06-15T11:00:00Z'),
    );

    expect(broadcast.publish).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'appointments', type: 'appointment.scheduled' }),
    );
    expect(broadcast.publish).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'queue', type: 'queue.enqueued' }),
    );
    expect(broadcast.publish).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'dashboard', type: 'dashboard.metrics_updated' }),
    );
  });

  it('broadcasts patient.registered on PatientRegisteredEvent', async () => {
    await listener.handle(
      new PatientRegisteredEvent('tenant-1', null, 'patient-1', 'Alice', 'female', '1990-01-01'),
    );

    expect(broadcast.publish).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'patients', type: 'patient.registered' }),
    );
  });

  it('targets user room on NotificationCreatedEvent', async () => {
    await listener.handle(
      new NotificationCreatedEvent('tenant-1', null, 'notif-1', 'user-recipient', 'in-app', 'high'),
    );

    expect(broadcast.publish).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'notifications', type: 'notification.created' }),
      { targetUserId: 'user-recipient' },
    );
  });
});
