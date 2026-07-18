import { JourneyNotificationIntentService } from '../journey-notification-intent.service';
import { WorkflowNotificationIntentService } from '../workflow-notification-intent.service';

describe('JourneyNotificationIntentService', () => {
  it('creates intents only via producer (no provider calls)', async () => {
    const producer = {
      produceChannels: jest.fn().mockResolvedValue({ intentId: 'intent-1', notificationId: 'n1' }),
    };
    const service = new JourneyNotificationIntentService(producer as never);
    const result = await service.createFromJourney({
      tenantId: 't1',
      recipientId: 'u1',
      title: 'Check-in',
      body: 'Please verify',
      journeyInstanceId: 'journey-1',
      idempotencyKey: 'journey:1:checkin',
      correlationId: 'corr-1',
    });
    expect(result.intentId).toBe('intent-1');
    expect(producer.produceChannels).toHaveBeenCalledWith(
      expect.objectContaining({
        producerModuleId: 'journey.communication',
        journeyInstanceId: 'journey-1',
        correlationId: 'corr-1',
      }),
    );
  });
});

describe('WorkflowNotificationIntentService', () => {
  it('creates intents only via producer', async () => {
    const producer = {
      produceChannels: jest.fn().mockResolvedValue({ intentId: 'intent-2' }),
    };
    const service = new WorkflowNotificationIntentService(producer as never);
    await service.createFromWorkflow({
      tenantId: 't1',
      recipientId: 'u1',
      title: 'Task overdue',
      body: 'Please act',
      workflowInstanceId: 'wf-1',
      idempotencyKey: 'wf:1:overdue',
    });
    expect(producer.produceChannels).toHaveBeenCalledWith(
      expect.objectContaining({
        producerModuleId: 'workflow.notification',
        workflowInstanceId: 'wf-1',
      }),
    );
  });
});
