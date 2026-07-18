import { AppointmentScheduledEvent } from '../../scheduling/domain/events/appointment-scheduled.event';
import { PatientRegisteredEvent } from '../../patients/domain/events/patient-registered.event';
import { WorkflowAutomationListener } from '../application/integrations/workflow-automation.listener';

describe('WorkflowAutomationListener', () => {
  it('maps appointment scheduled to automation event type', async () => {
    const executor = { executeForEventType: jest.fn().mockResolvedValue(1) };
    const listener = new WorkflowAutomationListener({} as never, executor as never);
    const event = new AppointmentScheduledEvent(
      'tenant-1',
      'branch-1',
      'appt-1',
      'patient-1',
      'provider-1',
      '2026-06-01T10:00:00Z',
      '2026-06-01T10:30:00Z',
    );
    await listener.handle(event);
    expect(executor.executeForEventType).toHaveBeenCalledWith(
      'appointment.created',
      expect.objectContaining({ tenantId: 'tenant-1', patientId: 'patient-1' }),
    );
  });

  it('maps patient registered to automation event type', async () => {
    const executor = { executeForEventType: jest.fn().mockResolvedValue(0) };
    const listener = new WorkflowAutomationListener({} as never, executor as never);
    const event = new PatientRegisteredEvent(
      'tenant-1',
      'branch-1',
      'patient-1',
      'Jane Doe',
      'female',
      '1990-01-01',
    );
    await listener.handle(event);
    expect(executor.executeForEventType).toHaveBeenCalledWith(
      'patient.registered',
      expect.objectContaining({ tenantId: 'tenant-1', patientId: 'patient-1' }),
    );
  });

  it('ignores unknown domain events', async () => {
    const executor = { executeForEventType: jest.fn() };
    const listener = new WorkflowAutomationListener({} as never, executor as never);
    await listener.handle({ eventName: 'Unknown' } as never);
    expect(executor.executeForEventType).not.toHaveBeenCalled();
  });
});
