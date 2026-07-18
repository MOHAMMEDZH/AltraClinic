import { AiSmartActionsService } from '../application/services/ai-smart-actions.service';
import { AiSubscriptionService } from '../application/services/ai-subscription.service';

describe('AiSmartActionsService', () => {
  const subscription = {
    getLimits: jest.fn(),
  } as unknown as AiSubscriptionService;

  beforeEach(() => {
    jest.clearAllMocks();
    (subscription.getLimits as jest.Mock).mockResolvedValue({
      plan: 'lite',
      messagesToday: 0,
      tokensTodayTenant: 0,
      limits: {
        maxMessagesPerUserPerDay: 25,
        maxTokensPerTenantPerDay: 50_000,
        maxRequestsPerMinute: 5,
        attachmentsEnabled: false,
        externalProvidersEnabled: false,
        workspaces: ['chat'],
        customPromptsEnabled: false,
      },
    });
  });

  it('filters actions by plan workspaces', async () => {
    const svc = new AiSmartActionsService(subscription);
    const result = await svc.listForContext('tenant-1', 'user-1', {
      path: '/encounters/e1',
      encounterId: 'e1',
    });
    expect(result.actions).toHaveLength(0);
  });

  it('returns medical actions on pro plan', async () => {
    (subscription.getLimits as jest.Mock).mockResolvedValue({
      plan: 'pro',
      messagesToday: 0,
      tokensTodayTenant: 0,
      limits: {
        workspaces: ['chat', 'medical'],
        maxMessagesPerUserPerDay: 100,
        maxTokensPerTenantPerDay: 250_000,
        maxRequestsPerMinute: 15,
        attachmentsEnabled: true,
        externalProvidersEnabled: true,
        customPromptsEnabled: false,
      },
    });
    const svc = new AiSmartActionsService(subscription);
    const result = await svc.listForContext('tenant-1', 'user-1', {
      path: '/encounters/e1',
      encounterId: 'e1',
    });
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.actions[0].workspaceId).toBe('medical');
    expect(result.actions[0].prompt).toContain('encounter');
  });

  it('returns Arabic prompts when locale is ar', async () => {
    (subscription.getLimits as jest.Mock).mockResolvedValue({
      plan: 'pro',
      messagesToday: 0,
      tokensTodayTenant: 0,
      limits: { workspaces: 'all' },
    });
    const svc = new AiSmartActionsService(subscription);
    const result = await svc.listForContext(
      'tenant-1',
      'user-1',
      { path: '/dashboard' },
      'ar-SY',
    );
    expect(result.actions[0].prompt).toMatch(/[\u0600-\u06FF]/);
  });
});
