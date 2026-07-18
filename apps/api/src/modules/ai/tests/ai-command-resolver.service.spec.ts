import { AiCommandResolverService } from '../application/services/ai-command-resolver.service';
import type { AiSubscriptionService } from '../application/services/ai-subscription.service';
import type { AiSmartActionsService } from '../application/services/ai-smart-actions.service';

describe('AiCommandResolverService', () => {
  const subscription = {
    getLimits: jest.fn().mockResolvedValue({
      plan: 'business',
      messagesToday: 0,
      tokensTodayTenant: 0,
      limits: {
        maxMessagesPerUserPerDay: 100,
        maxTokensPerTenantPerDay: 100000,
        maxRequestsPerMinute: 20,
        attachmentsEnabled: true,
        externalProvidersEnabled: true,
        workspaces: 'all',
        customPromptsEnabled: true,
      },
    }),
  } as unknown as AiSubscriptionService;

  const smartActions = {
    listForContext: jest.fn().mockResolvedValue({
      actions: [
        {
          id: 'dashboard-insights',
          labelKey: 'ai.actions.dashboardInsights',
          prompt: 'Summarize today operational KPIs',
          workspaceId: 'management',
        },
      ],
    }),
  } as unknown as AiSmartActionsService;

  const makeSvc = () => new AiCommandResolverService(subscription, smartActions);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns default navigation commands when query is empty', async () => {
    const svc = makeSvc();
    const result = await svc.resolve('tenant', 'user', '', { path: '/dashboard' });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.some((item) => item.kind === 'navigate')).toBe(true);
    expect(result.items.some((item) => item.id === 'smart-dashboard-insights')).toBe(true);
  });

  it('resolves natural language to summarize patient action', async () => {
    const svc = makeSvc();
    const result = await svc.resolve('tenant', 'user', 'summarize this patient', {
      path: '/patients/p1',
      patientId: 'p1',
    });
    const match = result.items.find((item) => item.id === 'summarize-patient');
    expect(match).toBeDefined();
    expect(match?.kind).toBe('action');
    expect(match?.disabled).toBe(false);
    expect(match?.prompt).toContain('patient');
  });

  it('marks context-required commands disabled without context', async () => {
    const svc = makeSvc();
    const result = await svc.resolve('tenant', 'user', 'generate soap note', { path: '/emr' });
    const match = result.items.find((item) => item.id === 'draft-soap');
    expect(match).toBeDefined();
    expect(match?.disabled).toBe(true);
    expect(match?.disabledReasonKey).toBe('ai.command.needsContext');
  });

  it('resolves book appointment navigation', async () => {
    const svc = makeSvc();
    const result = await svc.resolve('tenant', 'user', 'book an appointment', { path: '/' });
    const match = result.items.find((item) => item.id === 'book-appointment');
    expect(match?.kind).toBe('navigate');
    expect(match?.path).toBe('/appointments');
  });

  it('filters workspace-locked commands on lite plan', async () => {
    (subscription.getLimits as jest.Mock).mockResolvedValueOnce({
      plan: 'lite',
      messagesToday: 0,
      tokensTodayTenant: 0,
      limits: {
        maxMessagesPerUserPerDay: 25,
        maxTokensPerTenantPerDay: 50000,
        maxRequestsPerMinute: 5,
        attachmentsEnabled: false,
        externalProvidersEnabled: false,
        workspaces: ['chat'],
        customPromptsEnabled: false,
      },
    });
    (smartActions.listForContext as jest.Mock).mockResolvedValueOnce({ actions: [] });
    const svc = makeSvc();
    const result = await svc.resolve('tenant', 'user', 'explain dashboard', { path: '/dashboard' });
    const match = result.items.find((item) => item.id === 'explain-dashboard');
    expect(match?.disabled).toBe(true);
    expect(match?.disabledReasonKey).toBe('ai.command.planLocked');
  });

  it('resolves generate revenue report as AI action with reports path', async () => {
    const svc = makeSvc();
    const result = await svc.resolve('tenant', 'user', 'generate revenue report', { path: '/' });
    const match = result.items.find((item) => item.id === 'generate-revenue-report');
    expect(match?.kind).toBe('action');
    expect(match?.path).toBe('/reports');
    expect(match?.prompt).toContain('report');
  });

  it('maps ask commands to built-in skills', async () => {
    const svc = makeSvc();
    const result = await svc.resolve('tenant', 'user', 'overdue invoices', { path: '/billing' });
    const match = result.items.find((item) => item.id === 'show-overdue-invoices');
    expect(match?.kind).toBe('ask');
    expect(match?.skillId).toBe('billing.outstanding');
    expect(match?.workspaceId).toBe('billing');
  });
});
