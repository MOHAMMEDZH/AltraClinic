import { Test, TestingModule } from '@nestjs/testing';
import { CreateNotificationHandler } from '../application/handlers/create-notification.handler';
import { InMemoryNotificationRepository } from '../infrastructure/in-memory-notification.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { NOTIFICATION_REPOSITORY, EVENT_PUBLISHER } from '../../../infrastructure/provider.tokens';
import { DeliveryOrchestratorService } from '../delivery/delivery-orchestrator.service';

describe('CreateNotificationHandler', () => {
  let handler: CreateNotificationHandler;
  let repo: InMemoryNotificationRepository;
  let orchestrator: { deliver: jest.Mock };

  beforeEach(async () => {
    orchestrator = {
      deliver: jest.fn().mockResolvedValue({
        intentId: 'intent-1',
        legacyNotificationId: null,
        status: 'dispatched',
        plan: [],
        jobIds: [],
        consentDecision: { allowed: true },
        rejectedChannels: [],
        intentPersisted: false,
        messageId: null,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateNotificationHandler,
        { provide: NOTIFICATION_REPOSITORY, useClass: InMemoryNotificationRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1', environment: 'sandbox' }) },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: async () => {} } },
        { provide: DeliveryOrchestratorService, useValue: orchestrator },
      ],
    }).compile();

    handler = module.get(CreateNotificationHandler);
    repo = module.get(NOTIFICATION_REPOSITORY);
  });

  it('routes through DeliveryOrchestrator and persists a notification shell when no legacy id', async () => {
    const command = {
      recipientId: 'user-1',
      channel: 'in-app',
      title: 'Welcome',
      body: 'Your account is ready',
      priority: 'medium' as const,
      branchId: 'branch-1',
    };

    const result = await handler.execute(command);
    expect(result).toHaveProperty('notificationId');
    expect(result.intentId).toBe('intent-1');
    expect(orchestrator.deliver).toHaveBeenCalled();

    const stored = await repo.findById(result.notificationId, 'tenant-1');
    expect(stored).not.toBeNull();
    expect(stored?.recipientId).toBe('user-1');
    expect(stored?.channel.channel).toBe('in-app');
  });

  it('returns orchestrator legacyNotificationId when present', async () => {
    orchestrator.deliver.mockResolvedValueOnce({
      intentId: 'intent-2',
      legacyNotificationId: 'notif-legacy-1',
      status: 'dispatched',
      plan: [{ channel: 'in-app' }],
      jobIds: ['job-1'],
      consentDecision: { allowed: true },
      rejectedChannels: [],
      intentPersisted: true,
      messageId: 'msg-1',
    });

    const result = await handler.execute({
      recipientId: 'user-1',
      channel: 'IN_APP',
      title: 'Hi',
      body: 'Body',
      priority: 'medium',
      branchId: null,
    });

    expect(result.notificationId).toBe('notif-legacy-1');
    expect(result.intentId).toBe('intent-2');
  });
});
