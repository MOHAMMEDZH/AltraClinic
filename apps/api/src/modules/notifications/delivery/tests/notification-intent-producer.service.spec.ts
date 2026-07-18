import { NotificationIntentProducerService } from '../notification-intent-producer.service';

describe('NotificationIntentProducerService', () => {
  const orchestrator = { deliver: jest.fn() };
  const eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const producer = new NotificationIntentProducerService(orchestrator as never, eventPublisher as never);

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator.deliver.mockResolvedValue({
      intentId: 'intent-1',
      legacyNotificationId: 'notif-1',
      status: 'dispatched',
      plan: [{ channel: 'in-app', providerKey: 'in-app-inbox', order: 0, isFallback: false }],
      jobIds: ['job-1'],
      consentDecision: { allowed: true, policyId: 'transactional-necessity', reason: 'ok', evaluatedAt: new Date() },
      rejectedChannels: [],
      intentPersisted: true,
      messageId: 'msg-1',
    });
  });

  it('produceInApp routes through the orchestrator with the in-app channel and 41d metadata', async () => {
    const result = await producer.produceInApp({
      tenantId: 'tenant-1',
      recipientId: 'user-1',
      title: 'Hello',
      body: 'World',
      idempotencyKey: 'idem-1',
      producerModuleId: 'test.module',
    });

    expect(orchestrator.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        recipientId: 'user-1',
        requestedChannels: ['in-app'],
        idempotencyKey: 'idem-1',
        producerModuleId: 'test.module',
        metadata: expect.objectContaining({ deliveryEngine: '41d', producerModuleId: 'test.module' }),
      }),
    );
    expect(result).toEqual({ intentId: 'intent-1', notificationId: 'notif-1' });
  });

  it('produceInApp republishes NotificationCreatedEvent when a legacy notification id is returned', async () => {
    await producer.produceInApp({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      recipientId: 'user-1',
      title: 'Hello',
      body: 'World',
      priority: 'high',
      idempotencyKey: 'idem-2',
      producerModuleId: 'test.module',
    });

    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
    const published = eventPublisher.publish.mock.calls[0][0];
    expect(published).toMatchObject({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      notificationId: 'notif-1',
      recipientId: 'user-1',
      channel: 'in-app',
      priority: 'high',
    });
  });

  it('does not republish NotificationCreatedEvent when no legacy notification id is produced', async () => {
    orchestrator.deliver.mockResolvedValueOnce({
      intentId: 'intent-2',
      legacyNotificationId: null,
      status: 'blocked_consent',
      plan: [],
      jobIds: [],
      consentDecision: { allowed: false, policyId: 'transactional-necessity', reason: 'blocked', evaluatedAt: new Date() },
      rejectedChannels: [],
      intentPersisted: false,
      messageId: null,
    });

    const result = await producer.produceInApp({
      tenantId: 'tenant-1',
      recipientId: 'user-1',
      title: 'Hello',
      body: 'World',
      idempotencyKey: 'idem-3',
      producerModuleId: 'test.module',
    });

    expect(eventPublisher.publish).not.toHaveBeenCalled();
    expect(result).toEqual({ intentId: 'intent-2', notificationId: null });
  });

  it('produceEmail requests the email channel and puts recipientEmail into metadata', async () => {
    await producer.produceEmail({
      tenantId: 'tenant-1',
      recipientId: 'user-1',
      recipientEmail: 'user@example.com',
      title: 'Report ready',
      body: 'Your report is ready',
      idempotencyKey: 'idem-4',
      producerModuleId: 'test.module',
    });

    expect(orchestrator.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedChannels: ['email'],
        metadata: expect.objectContaining({ recipientEmail: 'user@example.com' }),
      }),
    );
  });

  it('produceChannels forwards the requested channel list untouched', async () => {
    await producer.produceChannels({
      tenantId: 'tenant-1',
      recipientId: 'patient-1',
      title: 'Queue update',
      body: 'You are next',
      idempotencyKey: 'idem-5',
      producerModuleId: 'test.module',
      channels: ['sms', 'in-app', 'push'],
      metadata: { recipientPhone: '+963900000000' },
    });

    expect(orchestrator.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedChannels: ['sms', 'in-app', 'push'],
        metadata: expect.objectContaining({ recipientPhone: '+963900000000', deliveryEngine: '41d' }),
      }),
    );
  });

  it('mirrors correlation/causation/journey/workflow ids into metadata', async () => {
    await producer.produceInApp({
      tenantId: 'tenant-1',
      recipientId: 'user-1',
      title: 'Hello',
      body: 'World',
      idempotencyKey: 'idem-6',
      producerModuleId: 'test.module',
      correlationId: 'corr-1',
      causationId: 'cause-1',
      journeyInstanceId: 'journey-1',
      workflowInstanceId: 'workflow-1',
    });

    expect(orchestrator.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: 'corr-1',
        causationId: 'cause-1',
        journeyInstanceId: 'journey-1',
        workflowInstanceId: 'workflow-1',
        metadata: expect.objectContaining({
          correlationId: 'corr-1',
          causationId: 'cause-1',
          journeyInstanceId: 'journey-1',
          workflowInstanceId: 'workflow-1',
        }),
      }),
    );
  });
});
