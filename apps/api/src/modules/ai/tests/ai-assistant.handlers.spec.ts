import { Test, TestingModule } from '@nestjs/testing';
import {
  GetAiAdminUsageHandler,
  GetAiAdminOverviewHandler,
  GetAiOverviewHandler,
  GetAiProviderHealthHandler,
  GetAiSmartActionsHandler,
  GetAiCommandsResolveHandler,
} from '../application/handlers/ai-assistant.handlers';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { AiInferenceService } from '../application/services/ai-inference.service';
import { AiSubscriptionService } from '../application/services/ai-subscription.service';
import { AiSmartActionsService } from '../application/services/ai-smart-actions.service';
import { AiCommandResolverService } from '../application/services/ai-command-resolver.service';
import { AiAdminService } from '../application/services/ai-admin.service';
import { AiTenantSettingsService } from '../application/services/ai-tenant-settings.service';

const TENANT_ID = 'a1000000-0000-4000-8000-000000000001';
const USER_ID = 'c1000000-0000-4000-8000-000000000001';

const mockPrisma = {
  aiConversation: { count: jest.fn().mockResolvedValue(3) },
  aiUsageDaily: {
    findUnique: jest.fn().mockResolvedValue({ tokenCount: 120, avgLatencyMs: 500 }),
    aggregate: jest.fn().mockResolvedValue({
      _sum: { tokenCount: 500, messageCount: 40, successCount: 38, failureCount: 2 },
    }),
    findMany: jest.fn().mockResolvedValue([]),
    groupBy: jest.fn().mockResolvedValue([{ userId: USER_ID }]),
  },
  aiModel: { count: jest.fn().mockResolvedValue(2) },
  aiMessage: { count: jest.fn().mockResolvedValue(5) },
};

const mockTenantContext = {
  resolve: jest.fn().mockResolvedValue({ tenantId: TENANT_ID }),
};

const mockInference = {
  getProviderHealth: jest.fn().mockResolvedValue([
    { provider: 'gemini', configured: true, status: 'healthy', model: 'gemini-2.5-flash' },
    { provider: 'template', configured: true, status: 'healthy', model: 'template-v1' },
  ]),
};

const mockSubscription = {
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
};

const mockSmartActions = {
  listForContext: jest.fn().mockResolvedValue({
    actions: [{ id: 'summarize-patient', labelKey: 'ai.actions.summarizePatient', prompt: 'Summarize', workspaceId: 'medical' }],
  }),
};

const mockCommandResolver = {
  resolve: jest.fn().mockResolvedValue({
    items: [{ id: 'book-appointment', kind: 'navigate', labelKey: 'ai.commands.bookAppointment', score: 90, disabled: false, path: '/appointments', workspaceId: null }],
  }),
};

const mockAdminOverview = {
  usage: {
    totalTokens: 500,
    totalMessages: 40,
    successCount: 38,
    failureCount: 2,
    activeUsers: 1,
    daily: Array.from({ length: 14 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      tokens: 0,
      messages: 0,
    })),
    monthly: [{ month: '2026-06', tokens: 500, messages: 40 }],
  },
  topUsers: [],
  providerBreakdown: [],
  skillBreakdown: [],
  limits: {
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
  },
  featureFlags: {
    builtinOnlyMode: true,
    externalProvidersEnabled: false,
    attachmentsEnabled: false,
    customPromptsEnabled: false,
    workspaces: ['chat'],
  },
  providers: [
    { provider: 'gemini', configured: true, status: 'healthy', model: 'gemini-2.5-flash' },
    { provider: 'template', configured: true, status: 'healthy', model: 'template-v1' },
  ],
  activeProvider: 'skill',
  costEstimate: { currency: 'USD' as const, periodTokens: 500, estimatedExternalCost: 0, noteKey: 'ai.admin.cost.builtinOnly' },
  skills: [{ id: 'appointments.today', workspace: 'scheduling' }],
  auditLog: [],
  providerManagement: {
    settings: { preferredExternalProvider: 'auto', geminiEnabled: true, openaiEnabled: true },
    effectiveActiveProvider: 'skill',
    canManage: false,
    lockedReasonKey: 'ai.admin.providersLockedBuiltin',
    providers: [{ provider: 'skill', configured: true, status: 'healthy', model: 'builtin-skills-v1' }],
  },
};

const mockAdminService = {
  getOverview: jest.fn().mockResolvedValue(mockAdminOverview),
};

const mockTenantSettings = {
  getProviderSettings: jest.fn().mockResolvedValue({
    preferredExternalProvider: 'auto',
    geminiEnabled: true,
    openaiEnabled: true,
  }),
  resolveActiveProvider: jest.fn().mockReturnValue('gemini'),
  getProviderManagement: jest.fn(),
};

describe('AI assistant handlers', () => {
  let overview: GetAiOverviewHandler;
  let adminUsage: GetAiAdminUsageHandler;
  let adminOverview: GetAiAdminOverviewHandler;
  let providerHealth: GetAiProviderHealthHandler;
  let smartActions: GetAiSmartActionsHandler;
  let commandsResolve: GetAiCommandsResolveHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAiOverviewHandler,
        GetAiAdminUsageHandler,
        GetAiAdminOverviewHandler,
        GetAiProviderHealthHandler,
        GetAiSmartActionsHandler,
        GetAiCommandsResolveHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TenantContextService, useValue: mockTenantContext },
        { provide: AiInferenceService, useValue: mockInference },
        { provide: AiSubscriptionService, useValue: mockSubscription },
        { provide: AiSmartActionsService, useValue: mockSmartActions },
        { provide: AiCommandResolverService, useValue: mockCommandResolver },
        { provide: AiAdminService, useValue: mockAdminService },
        { provide: AiTenantSettingsService, useValue: mockTenantSettings },
      ],
    }).compile();

    overview = module.get(GetAiOverviewHandler);
    adminUsage = module.get(GetAiAdminUsageHandler);
    adminOverview = module.get(GetAiAdminOverviewHandler);
    providerHealth = module.get(GetAiProviderHealthHandler);
    smartActions = module.get(GetAiSmartActionsHandler);
    commandsResolve = module.get(GetAiCommandsResolveHandler);
  });

  it('returns overview KPIs for a user', async () => {
    const result = await overview.execute(USER_ID);
    expect(result.activeConversations).toBe(3);
    expect(result.deployedModels).toBe(2);
    expect(result.messagesToday).toBe(5);
    expect(result.tokensConsumed).toBe(500);
    expect(result.providerHealth?.activeProvider).toBe('gemini');
    expect(result.subscription?.plan).toBe('lite');
  });

  it('returns tenant admin usage aggregates', async () => {
    const result = await adminUsage.execute(USER_ID);
    expect(result.totalTokens).toBe(500);
    expect(result.totalMessages).toBe(40);
    expect(result.activeUsers).toBe(1);
    expect(result.daily).toHaveLength(14);
    expect(result.monthly).toHaveLength(1);
    expect(mockAdminService.getOverview).toHaveBeenCalledWith(TENANT_ID, USER_ID);
  });

  it('returns full admin overview', async () => {
    const result = await adminOverview.execute(USER_ID);
    expect(result.usage.totalTokens).toBe(500);
    expect(result.featureFlags.builtinOnlyMode).toBe(true);
    expect(result.skills[0]?.id).toBe('appointments.today');
  });

  it('returns provider health snapshot', async () => {
    const result = await providerHealth.execute(USER_ID);
    expect(result.activeProvider).toBe('gemini');
    expect(result.providers).toHaveLength(2);
    expect(result.checkedAt).toBeTruthy();
    expect(mockTenantSettings.resolveActiveProvider).toHaveBeenCalled();
  });

  it('returns contextual smart actions', async () => {
    const result = await smartActions.execute(USER_ID, {
      path: '/patients/p1',
      patientId: 'p1',
      locale: 'en-US',
    });
    expect(mockSmartActions.listForContext).toHaveBeenCalledWith(
      TENANT_ID,
      USER_ID,
      expect.objectContaining({ path: '/patients/p1', patientId: 'p1' }),
      'en-US',
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].workspaceId).toBe('medical');
  });

  it('resolves natural language commands', async () => {
    const result = await commandsResolve.execute(USER_ID, {
      q: 'book appointment',
      path: '/dashboard',
      locale: 'en-US',
    });
    expect(mockCommandResolver.resolve).toHaveBeenCalledWith(
      TENANT_ID,
      USER_ID,
      'book appointment',
      expect.objectContaining({ path: '/dashboard' }),
      'en-US',
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].path).toBe('/appointments');
  });
});
