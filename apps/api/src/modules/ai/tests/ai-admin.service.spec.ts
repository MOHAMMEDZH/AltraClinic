import { AiAdminService } from '../application/services/ai-admin.service';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AiSubscriptionService } from '../application/services/ai-subscription.service';
import { AiInferenceService } from '../application/services/ai-inference.service';
import { AiTenantSettingsService } from '../application/services/ai-tenant-settings.service';

const TENANT = 'a1000000-0000-4000-8000-000000000001';
const USER = 'c1000000-0000-4000-8000-000000000001';

function buildService(overrides: {
  prisma?: Partial<PrismaService>;
  subscription?: Partial<AiSubscriptionService>;
  inference?: Partial<AiInferenceService>;
  tenantSettings?: Partial<AiTenantSettingsService>;
} = {}) {
  const prisma = {
    aiUsageDaily: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { tokenCount: 500, messageCount: 40, successCount: 38, failureCount: 2 },
      }),
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([
        { userId: USER, _sum: { messageCount: 20, tokenCount: 300 } },
      ]),
    },
    auditEntry: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'audit-1',
          actorId: USER,
          createdAt: new Date('2026-06-01T10:00:00.000Z'),
          resourceId: 'conv-1',
          details: { provider: 'skill', skillId: 'appointments.today', tokenCount: '12', latencyMs: '45' },
        },
      ]),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([{ id: USER, email: 'owner@demo.clinic' }]),
    },
    ...overrides.prisma,
  } as unknown as PrismaService;

  const subscription = {
    getLimits: jest.fn().mockResolvedValue({
      plan: 'lite',
      messagesToday: 2,
      tokensTodayTenant: 1000,
      limits: {
        maxMessagesPerUserPerDay: 25,
        maxTokensPerTenantPerDay: 50000,
        maxRequestsPerMinute: 5,
        attachmentsEnabled: false,
        externalProvidersEnabled: false,
        workspaces: ['chat'],
        customPromptsEnabled: false,
      },
    }),
    ...overrides.subscription,
  } as unknown as AiSubscriptionService;

  const inference = {
    getProviderHealth: jest.fn().mockResolvedValue([
      { provider: 'skill', configured: true, status: 'healthy', model: 'builtin-skills-v1' },
    ]),
    ...overrides.inference,
  } as unknown as AiInferenceService;

  const tenantSettings = {
    getProviderManagement: jest.fn().mockResolvedValue({
      settings: { preferredExternalProvider: 'auto', geminiEnabled: true, openaiEnabled: true },
      effectiveActiveProvider: 'skill',
      canManage: false,
      lockedReasonKey: 'ai.admin.providersLockedBuiltin',
      providers: [{ provider: 'skill', configured: true, status: 'healthy', model: 'builtin-skills-v1' }],
    }),
    ...overrides.tenantSettings,
  } as unknown as AiTenantSettingsService;

  return new AiAdminService(prisma, subscription, inference, tenantSettings);
}

describe('AiAdminService', () => {
  const originalBuiltin = process.env.AI_BUILTIN_ONLY;

  afterEach(() => {
    if (originalBuiltin === undefined) delete process.env.AI_BUILTIN_ONLY;
    else process.env.AI_BUILTIN_ONLY = originalBuiltin;
  });

  it('returns admin overview with usage, limits, and audit log', async () => {
    process.env.AI_BUILTIN_ONLY = 'true';
    const svc = buildService();
    const overview = await svc.getOverview(TENANT, USER);

    expect(overview.usage.totalTokens).toBe(500);
    expect(overview.usage.totalMessages).toBe(40);
    expect(overview.usage.daily).toHaveLength(14);
    expect(overview.usage.monthly.length).toBeGreaterThan(0);
    expect(overview.topUsers[0]?.email).toBe('owner@demo.clinic');
    expect(overview.providerBreakdown).toEqual([{ provider: 'skill', count: 1 }]);
    expect(overview.skillBreakdown).toEqual([{ skillId: 'appointments.today', count: 1 }]);
    expect(overview.featureFlags.builtinOnlyMode).toBe(true);
    expect(overview.featureFlags.externalProvidersEnabled).toBe(false);
    expect(overview.costEstimate.noteKey).toBe('ai.admin.cost.builtinOnly');
    expect(overview.auditLog).toHaveLength(1);
    expect(overview.skills.length).toBeGreaterThan(0);
    expect(overview.activeProvider).toBe('skill');
  });

  it('estimates external cost when providers are enabled', async () => {
    process.env.AI_BUILTIN_ONLY = 'false';
    const svc = buildService({
      subscription: {
        getLimits: jest.fn().mockResolvedValue({
          plan: 'enterprise',
          messagesToday: 2,
          tokensTodayTenant: 1000,
          limits: {
            maxMessagesPerUserPerDay: 100,
            maxTokensPerTenantPerDay: 500000,
            maxRequestsPerMinute: 30,
            attachmentsEnabled: true,
            externalProvidersEnabled: true,
            workspaces: 'all',
            customPromptsEnabled: true,
          },
        }),
      } as never,
    });

    const overview = await svc.getOverview(TENANT, USER);
    expect(overview.featureFlags.externalProvidersEnabled).toBe(true);
    expect(overview.costEstimate.estimatedExternalCost).toBeGreaterThan(0);
    expect(overview.costEstimate.noteKey).toBe('ai.admin.cost.externalEnabled');
  });
});
