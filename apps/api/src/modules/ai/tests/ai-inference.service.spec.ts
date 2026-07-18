import { AiInferenceService } from '../application/services/ai-inference.service';
import type { AiContextService } from '../application/services/ai-context.service';
import type { AiIntentRouterService } from '../application/services/ai-intent-router.service';
import type { AiSkillExecutorService } from '../application/services/ai-skill-executor.service';
import type { AiSubscriptionService } from '../application/services/ai-subscription.service';
import type { TemplateAiProvider } from '../application/services/providers/template-ai.provider';

describe('AiInferenceService', () => {
  const enriched = {
    systemPrompt: '',
    contextBlocks: [],
    citations: [],
    history: [],
    userParts: [{ text: 'appointments today' }],
  };

  const contextService = {
    enrich: jest.fn().mockResolvedValue(enriched),
  } as unknown as AiContextService;

  const intentRouter = {
    route: jest.fn().mockReturnValue({ skillId: 'appointments.today', score: 90 }),
  } as unknown as AiIntentRouterService;

  const skillExecutor = {
    execute: jest.fn().mockResolvedValue({
      skillId: 'appointments.today',
      content: '**Today**',
      citations: [],
    }),
  } as unknown as AiSkillExecutorService;

  const subscription = {
    getLimits: jest.fn().mockResolvedValue({
      limits: { workspaces: 'all' },
    }),
  } as unknown as AiSubscriptionService;

  const template = {
    generate: jest.fn(),
    stream: jest.fn(),
  } as unknown as TemplateAiProvider;

  const makeService = () =>
    new AiInferenceService(
      contextService,
      intentRouter,
      skillExecutor,
      subscription,
      { isConfigured: () => false, generate: jest.fn(), stream: jest.fn(), healthCheck: jest.fn() } as never,
      { isConfigured: () => false, generate: jest.fn(), stream: jest.fn(), healthCheck: jest.fn() } as never,
      template,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes chat inference through skills before template', async () => {
    const svc = makeService();
    const result = await svc.generate({
      tenantId: 't1',
      userId: 'u1',
      userMessage: 'appointments today',
    });

    expect(intentRouter.route).toHaveBeenCalled();
    expect(skillExecutor.execute).toHaveBeenCalledWith(
      'appointments.today',
      expect.objectContaining({ userMessage: 'appointments today' }),
      enriched,
    );
    expect(result.provider).toBe('skill');
    expect(result.skillId).toBe('appointments.today');
    expect(template.generate).not.toHaveBeenCalled();
  });

  it('honors forced skill id from conversation context', async () => {
    const svc = makeService();
    (intentRouter.route as jest.Mock).mockReturnValueOnce({ skillId: 'billing.outstanding', score: 100 });

    await svc.generate({
      tenantId: 't1',
      userId: 'u1',
      userMessage: 'custom prompt',
      context: { forceSkillId: 'billing.outstanding' },
    });

    expect(intentRouter.route).toHaveBeenCalledWith(
      'custom prompt',
      { forceSkillId: 'billing.outstanding' },
      undefined,
      'all',
    );
  });
});
