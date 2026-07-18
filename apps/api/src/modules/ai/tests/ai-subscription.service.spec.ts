import { AiSubscriptionService } from '../application/services/ai-subscription.service';
import { AiQuotaExceededException, AiRateLimitExceededException } from '../domain/exceptions/ai-quota-exceeded.exception';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { SubscriptionEnforcementService } from '../../subscription/application/services/subscription-enforcement.service';
import { RateLimiterService } from '../../../infrastructure/redis/services/rate-limiter.service';
import { RedisKeyBuilder } from '../../../infrastructure/redis/redis-key.builder';

const TENANT = 'tenant-1';
const USER = 'user-1';

function buildService(overrides: {
  uiPlan?: string;
  prisma?: Partial<PrismaService>;
  subscription?: Partial<SubscriptionEnforcementService>;
  rateLimiter?: Partial<RateLimiterService>;
} = {}) {
  const uiPlan = overrides.uiPlan ?? 'starter';
  const backendPlan = uiPlan === 'business' || uiPlan === 'professional' || uiPlan === 'enterprise' ? 'pro' : 'lite';
  const planName = backendPlan === 'pro' ? 'pro' : 'lite';

  const prisma = {
    clinicSubscription: { findFirst: jest.fn().mockResolvedValue({ plan: backendPlan }) },
    aiUsageDaily: {
      findUnique: jest.fn().mockResolvedValue({ messageCount: 0 }),
      aggregate: jest.fn().mockResolvedValue({ _sum: { tokenCount: 0 } }),
    },
    ...overrides.prisma,
  } as unknown as PrismaService;

  const subscription = {
    getActivePlanLimits: jest.fn().mockResolvedValue({
      planName,
      maxUsers: 10,
      features: {},
    }),
    resolveLicense: jest.fn().mockResolvedValue({
      uiPlan,
      backendPlan,
      effectiveLimits: { planName },
    }),
    enforceLicensedFeature: jest.fn().mockResolvedValue(undefined),
    ...overrides.subscription,
  } as unknown as SubscriptionEnforcementService;

  const rateLimiter = {
    checkFixedWindow: jest.fn().mockResolvedValue({ allowed: true, count: 1, limit: 5, remaining: 4, resetAt: 0 }),
    ...overrides.rateLimiter,
  } as unknown as RateLimiterService;

  return new AiSubscriptionService(prisma, subscription, rateLimiter, new RedisKeyBuilder('test'));
}

describe('AiSubscriptionService', () => {
  it('returns limits snapshot', async () => {
    const svc = buildService();
    const limits = await svc.getLimits(TENANT, USER);
    expect(limits.plan).toBe('lite');
    expect(limits.limits.maxMessagesPerUserPerDay).toBe(25);
  });

  it('blocks medical workspace on lite', async () => {
    const svc = buildService();
    await expect(svc.enforceWorkspaceAccess(TENANT, 'medical')).rejects.toThrow(AiQuotaExceededException);
  });

  it('blocks attachments on lite', async () => {
    const svc = buildService();
    await expect(
      svc.enforceInference(TENANT, USER, { attachments: [{ name: 'x.png', mimeType: 'image/png' }] }),
    ).rejects.toThrow(AiQuotaExceededException);
  });

  it('blocks when daily message quota reached', async () => {
    const svc = buildService({
      prisma: {
        aiUsageDaily: {
          findUnique: jest.fn().mockResolvedValue({ messageCount: 25 }),
          aggregate: jest.fn().mockResolvedValue({ _sum: { tokenCount: 0 } }),
        },
      } as never,
    });
    await expect(svc.enforceInference(TENANT, USER, {})).rejects.toThrow(AiQuotaExceededException);
  });

  it('throws rate limit when burst exceeded', async () => {
    const svc = buildService({
      rateLimiter: {
        checkFixedWindow: jest.fn().mockResolvedValue({ allowed: false, count: 6, limit: 5, remaining: 0, resetAt: 0 }),
      } as never,
    });
    await expect(svc.enforceInference(TENANT, USER, {})).rejects.toThrow(AiRateLimitExceededException);
  });

  it('allows pro medical copilot workspace', async () => {
    const svc = buildService({ uiPlan: 'professional' });
    await expect(svc.enforceWorkspaceAccess(TENANT, 'medical')).resolves.toBeUndefined();
  });

  it('blocks custom prompts on lite', async () => {
    const svc = buildService();
    await expect(svc.enforceCustomPrompts(TENANT)).rejects.toThrow(AiQuotaExceededException);
  });

  it('returns business plan label from licensing engine ui tier', async () => {
    const svc = buildService({ uiPlan: 'business' });
    const limits = await svc.getLimits(TENANT, USER);
    expect(limits.plan).toBe('business');
    expect(limits.limits.maxMessagesPerUserPerDay).toBe(200);
  });
});
