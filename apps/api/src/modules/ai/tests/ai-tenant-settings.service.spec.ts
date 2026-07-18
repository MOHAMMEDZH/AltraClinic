import { AiTenantSettingsService } from '../application/services/ai-tenant-settings.service';
import { PrismaService } from '../../../infrastructure/prisma.service';

const TENANT = 'tenant-1';

function buildService(prismaOverrides: Partial<PrismaService> = {}) {
  const prisma = {
    aiTenantSettings: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    ...prismaOverrides,
  } as unknown as PrismaService;
  return new AiTenantSettingsService(prisma);
}

const enterpriseLimits = {
  plan: 'enterprise',
  messagesToday: 0,
  tokensTodayTenant: 0,
  limits: {
    maxMessagesPerUserPerDay: 100,
    maxTokensPerTenantPerDay: 500000,
    maxRequestsPerMinute: 30,
    attachmentsEnabled: true,
    externalProvidersEnabled: true,
    workspaces: 'all' as const,
    customPromptsEnabled: true,
  },
};

const providers = [
  { provider: 'skill' as const, configured: true, status: 'healthy' as const, model: 'builtin-skills-v1' },
  { provider: 'gemini' as const, configured: true, status: 'healthy' as const, model: 'gemini-2.5-flash' },
  { provider: 'openai' as const, configured: true, status: 'healthy' as const, model: 'gpt-4o-mini' },
];

describe('AiTenantSettingsService', () => {
  const originalBuiltin = process.env.AI_BUILTIN_ONLY;

  afterEach(() => {
    if (originalBuiltin === undefined) delete process.env.AI_BUILTIN_ONLY;
    else process.env.AI_BUILTIN_ONLY = originalBuiltin;
  });

  it('defaults provider settings when none stored', async () => {
    const svc = buildService();
    const settings = await svc.getProviderSettings(TENANT);
    expect(settings.preferredExternalProvider).toBe('auto');
    expect(settings.geminiEnabled).toBe(true);
  });

  it('resolves active provider from tenant preference', async () => {
    process.env.AI_BUILTIN_ONLY = 'false';
    const svc = buildService({
      aiTenantSettings: {
        findUnique: jest.fn().mockResolvedValue({
          settingsJson: { providers: { preferredExternalProvider: 'openai', geminiEnabled: true, openaiEnabled: true } },
        }),
      },
    } as never);

    const active = svc.resolveActiveProvider(
      { preferredExternalProvider: 'openai', geminiEnabled: true, openaiEnabled: true },
      providers,
      enterpriseLimits,
    );
    expect(active).toBe('openai');
  });

  it('blocks provider updates in built-in-only mode', async () => {
    process.env.AI_BUILTIN_ONLY = 'true';
    const svc = buildService();
    await expect(
      svc.updateProviderSettings(TENANT, enterpriseLimits, { preferredExternalProvider: 'gemini' }),
    ).rejects.toThrow('ai.admin.providersLockedBuiltin');
  });

  it('persists provider updates when management is allowed', async () => {
    process.env.AI_BUILTIN_ONLY = 'false';
    const upsert = jest.fn().mockResolvedValue({});
    const svc = buildService({ aiTenantSettings: { findUnique: jest.fn().mockResolvedValue(null), upsert } } as never);

    const next = await svc.updateProviderSettings(TENANT, enterpriseLimits, {
      preferredExternalProvider: 'gemini',
      openaiEnabled: false,
    });

    expect(next.preferredExternalProvider).toBe('gemini');
    expect(next.openaiEnabled).toBe(false);
    expect(upsert).toHaveBeenCalled();
  });
});
