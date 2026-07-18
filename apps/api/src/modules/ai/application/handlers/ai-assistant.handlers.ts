import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { AiInferenceService } from '../services/ai-inference.service';
import { AiSubscriptionService } from '../services/ai-subscription.service';
import { AiInferenceAuditService } from '../services/ai-inference-audit.service';
import { AiAdminService } from '../services/ai-admin.service';
import { AiTenantSettingsService } from '../services/ai-tenant-settings.service';
import type { AiTenantProviderSettings } from '../../domain/config/ai-tenant-provider.config';
import {
  AI_ADMIN_PROVIDER_AUDIT_ACTION,
  AI_ADMIN_PROVIDER_AUDIT_RESOURCE,
} from '../../domain/config/ai-admin.config';
import { AiSmartActionsService } from '../services/ai-smart-actions.service';
import { AiCommandResolverService } from '../services/ai-command-resolver.service';
import { AiContextSummaryService } from '../services/ai-context-summary.service';
import type { AiRouteContextInput } from '../../domain/config/ai-route-context.config';
import { AI_PROMPT_CATEGORIES } from '../../domain/config/ai-prompt-categories.config';
import { ensureTenantDefaultPrompts } from '../../domain/utils/ai-prompt-seed.util';
import {
  canDeletePrompt,
  canEditPrompt,
  matchesPromptRoles,
} from '../../domain/utils/ai-prompt-access.util';
import { mergeAiContext } from '../../domain/utils/merge-ai-context';
import type { AiUserPreferences } from '../services/ai-inference.types';

type AiMessageBody = {
  content: string;
  attachments?: Array<{ name: string; mimeType: string; dataUrl?: string }>;
  context?: Record<string, unknown>;
};

function resolveInferenceContext(
  conv: { contextJson: unknown },
  body: AiMessageBody,
): Record<string, unknown> {
  return mergeAiContext(conv.contextJson as Record<string, unknown>, body.context);
}

function resolveInferenceLocale(
  preferences: AiUserPreferences,
  context: Record<string, unknown>,
): string | undefined {
  if (preferences.preferredLanguage) return preferences.preferredLanguage;
  const fromContext = context.locale;
  return typeof fromContext === 'string' && fromContext.trim() ? fromContext : undefined;
}

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function conversationDto(row: {
  id: string;
  title: string;
  workspaceId: string | null;
  pinned: boolean;
  contextJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  messages?: Array<{
    id: string;
    role: string;
    content: string;
    citationsJson: unknown;
    attachmentsJson: unknown;
    tokenCount: number;
    createdAt: Date;
  }>;
}) {
  return {
    conversationId: row.id,
    title: row.title,
    workspaceId: row.workspaceId,
    pinned: row.pinned,
    context: (row.contextJson as Record<string, unknown>) ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messages: (row.messages ?? []).map((m) => ({
      messageId: m.id,
      role: m.role,
      content: m.content,
      citations: m.citationsJson,
      attachments: m.attachmentsJson,
      tokenCount: m.tokenCount,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

@Injectable()
export class GetAiOverviewHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly inference: AiInferenceService,
    private readonly aiSubscription: AiSubscriptionService,
    private readonly tenantSettings: AiTenantSettingsService,
  ) {}

  async execute(userId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    const today = startOfUtcDay();
    const [conversations, usage, deployedModels, recentMessages, providers, subscription] = await Promise.all([
      this.prisma.aiConversation.count({ where: { tenantId, userId } }),
      this.prisma.aiUsageDaily.findUnique({
        where: { tenantId_userId_usageDate: { tenantId, userId, usageDate: today } },
      }),
      this.prisma.aiModel.count({ where: { tenantId, status: 'DEPLOYED' } }),
      this.prisma.aiMessage.count({
        where: { tenantId, createdAt: { gte: today }, conversation: { userId } },
      }),
      this.inference.getProviderHealth(),
      this.aiSubscription.getLimits(tenantId, userId),
    ]);
    const tokenRow = await this.prisma.aiUsageDaily.aggregate({
      where: { tenantId },
      _sum: { tokenCount: true, messageCount: true, successCount: true, failureCount: true },
    });
    const totalMsgs = tokenRow._sum.messageCount ?? 0;
    const successes = tokenRow._sum.successCount ?? 0;
    const tenantProviderSettings = await this.tenantSettings.getProviderSettings(tenantId);
    const activeProvider = this.tenantSettings.resolveActiveProvider(
      tenantProviderSettings,
      providers,
      subscription,
    );
    const gemini = providers.find((p) => p.provider === 'gemini');
    const openai = providers.find((p) => p.provider === 'openai');
    return {
      activeConversations: conversations,
      tokensConsumed: tokenRow._sum.tokenCount ?? usage?.tokenCount ?? 0,
      messagesToday: recentMessages,
      deployedModels,
      successRate: totalMsgs > 0 ? Math.round((successes / totalMsgs) * 100) : 98,
      avgResponseMs: usage?.avgLatencyMs ?? 840,
      lastActivityAt: usage ? new Date().toISOString() : null,
      providerHealth: {
        activeProvider,
        providers,
        checkedAt: new Date().toISOString(),
      },
      providerStatus: {
        geminiConfigured: gemini?.configured ?? false,
        openaiConfigured: openai?.configured ?? false,
        geminiModel: (gemini?.model ?? process.env.GEMINI_MODEL?.trim()) || 'gemini-2.5-flash',
        openaiModel: (openai?.model ?? process.env.OPENAI_MODEL?.trim()) || 'gpt-4o-mini',
        templateFallback: true,
      },
      subscription,
    };
  }
}

@Injectable()
export class ListAiConversationsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, search?: string | null) {
    const { tenantId } = await this.tenantContext.resolve();
    const rows = await this.prisma.aiConversation.findMany({
      where: {
        tenantId,
        userId,
        ...(search?.trim()
          ? { title: { contains: search.trim(), mode: 'insensitive' as const } }
          : {}),
      },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });
    return rows.map((r) => conversationDto({ ...r, messages: r.messages }));
  }
}

@Injectable()
export class GetAiConversationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, conversationId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    const row = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, tenantId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Conversation not found');
    return conversationDto(row);
  }
}

@Injectable()
export class CreateAiConversationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly aiSubscription: AiSubscriptionService,
  ) {}

  async execute(
    userId: string,
    body: {
      title?: string;
      workspaceId?: string;
      context?: Record<string, unknown>;
      initialMessage?: string;
    },
  ) {
    const { tenantId, branchId } = await this.tenantContext.resolve();
    await this.aiSubscription.enforceWorkspaceAccess(tenantId, body.workspaceId);

    const conv = await this.prisma.aiConversation.create({
      data: {
        tenantId,
        userId,
        branchId: branchId ?? null,
        title: body.title?.trim() || 'New conversation',
        workspaceId: body.workspaceId ?? null,
        contextJson: (body.context ?? {}) as Prisma.InputJsonValue,
      },
    });
    if (body.initialMessage?.trim()) {
      await this.prisma.aiMessage.create({
        data: {
          tenantId,
          conversationId: conv.id,
          role: 'user',
          content: body.initialMessage.trim(),
        },
      });
    }
    const full = await this.prisma.aiConversation.findFirst({
      where: { id: conv.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return conversationDto(full!);
  }
}

@Injectable()
export class UpdateAiConversationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, conversationId: string, patch: { title?: string; pinned?: boolean }) {
    const { tenantId } = await this.tenantContext.resolve();
    const existing = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, tenantId, userId },
    });
    if (!existing) throw new NotFoundException('Conversation not found');
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        title: patch.title?.trim() || existing.title,
        pinned: patch.pinned ?? existing.pinned,
      },
    });
    const handler = new GetAiConversationHandler(this.prisma, this.tenantContext);
    return handler.execute(userId, conversationId);
  }
}

@Injectable()
export class DeleteAiConversationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, conversationId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    const existing = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, tenantId, userId },
    });
    if (!existing) throw new NotFoundException('Conversation not found');
    await this.prisma.aiConversation.delete({ where: { id: conversationId } });
    return { ok: true };
  }
}

@Injectable()
export class SendAiMessageHandler {
  private readonly logger = new Logger(SendAiMessageHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly inference: AiInferenceService,
    private readonly aiSubscription: AiSubscriptionService,
    private readonly inferenceAudit: AiInferenceAuditService,
    private readonly tenantSettings: AiTenantSettingsService,
  ) {}

  async execute(
    userId: string,
    conversationId: string,
    body: AiMessageBody,
  ) {
    const { tenantId } = await this.tenantContext.resolve();
    if (!body.content?.trim()) throw new BadRequestException('Message content is required');

    const conv = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, tenantId, userId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    const mergedContext = resolveInferenceContext(conv, body);
    if (body.context && Object.keys(body.context).length > 0) {
      await this.prisma.aiConversation.update({
        where: { id: conversationId },
        data: { contextJson: mergedContext as Prisma.InputJsonValue },
      });
    }

    const preferences = await this.loadUserPreferences(tenantId, userId);
    const tenantProviderSettings = await this.tenantSettings.getProviderSettings(tenantId);

    const subscription = await this.aiSubscription.enforceInference(tenantId, userId, {
      attachments: body.attachments,
      workspaceId: conv.workspaceId,
    });

    const userMsg = await this.prisma.aiMessage.create({
      data: {
        tenantId,
        conversationId,
        role: 'user',
        content: body.content.trim(),
        attachmentsJson: (body.attachments ?? []) as Prisma.InputJsonValue,
      },
    });

    const started = Date.now();
    let inferenceResult;
    try {
      inferenceResult = await this.inference.generate({
        tenantId,
        userId,
        userMessage: body.content.trim(),
        workspaceId: conv.workspaceId,
        context: mergedContext,
        conversationId,
        attachments: body.attachments,
        preferences,
        tenantProviderSettings,
        locale: resolveInferenceLocale(preferences, mergedContext),
        forceTemplateOnly: !subscription.externalProvidersEnabled,
      });
    } catch (err) {
      await this.recordUsage(tenantId, userId, 0, Date.now() - started, false);
      this.logger.warn(`Inference failed: ${String(err)}`);
      throw new BadRequestException('AI inference failed. Please try again.');
    }

    const assistantMsg = await this.prisma.aiMessage.create({
      data: {
        tenantId,
        conversationId,
        role: 'assistant',
        content: inferenceResult.content,
        citationsJson: inferenceResult.citations as unknown as Prisma.InputJsonValue,
        tokenCount: inferenceResult.tokenCount,
      },
    });

    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        title: conv.title === 'New conversation' ? body.content.trim().slice(0, 48) : conv.title,
      },
    });

    await this.recordUsage(tenantId, userId, inferenceResult.tokenCount, inferenceResult.latencyMs, true);

    await this.inferenceAudit.logSuccess(tenantId, userId, conversationId, inferenceResult);

    return {
      userMessage: { messageId: userMsg.id, role: 'user', content: userMsg.content },
      assistantMessage: {
        messageId: assistantMsg.id,
        role: 'assistant',
        content: assistantMsg.content,
        citations: inferenceResult.citations,
        tokenCount: inferenceResult.tokenCount,
        provider: inferenceResult.provider,
        model: inferenceResult.model,
      },
    };
  }

  async loadUserPreferences(tenantId: string, userId: string): Promise<AiUserPreferences> {
    const row = await this.prisma.aiUserSettings.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    return (row?.preferencesJson as AiUserPreferences) ?? {};
  }

  loadTenantProviderSettings(tenantId: string) {
    return this.tenantSettings.getProviderSettings(tenantId);
  }

  async logInferenceAudit(
    tenantId: string,
    userId: string,
    conversationId: string,
    result: Pick<
      import('../services/ai-inference.types').AiInferenceResult,
      'provider' | 'model' | 'skillId' | 'tokenCount' | 'latencyMs'
    >,
  ) {
    await this.inferenceAudit.logSuccess(tenantId, userId, conversationId, result);
  }

  async recordUsage(tenantId: string, userId: string, tokens: number, latencyMs: number, success: boolean) {
    const usageDate = startOfUtcDay();
    await this.prisma.aiUsageDaily.upsert({
      where: { tenantId_userId_usageDate: { tenantId, userId, usageDate } },
      create: {
        tenantId,
        userId,
        usageDate,
        messageCount: 1,
        tokenCount: tokens,
        successCount: success ? 1 : 0,
        failureCount: success ? 0 : 1,
        avgLatencyMs: latencyMs,
      },
      update: {
        messageCount: { increment: 1 },
        tokenCount: { increment: tokens },
        successCount: success ? { increment: 1 } : undefined,
        failureCount: success ? undefined : { increment: 1 },
        avgLatencyMs: latencyMs,
      },
    });
  }
}

@Injectable()
export class StreamAiMessageHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly inference: AiInferenceService,
    private readonly sendHandler: SendAiMessageHandler,
    private readonly aiSubscription: AiSubscriptionService,
  ) {}

  async prepare(
    userId: string,
    conversationId: string,
    body: AiMessageBody,
  ) {
    const { tenantId } = await this.tenantContext.resolve();
    if (!body.content?.trim()) throw new BadRequestException('Message content is required');

    const conv = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, tenantId, userId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    const mergedContext = resolveInferenceContext(conv, body);
    if (body.context && Object.keys(body.context).length > 0) {
      await this.prisma.aiConversation.update({
        where: { id: conversationId },
        data: { contextJson: mergedContext as Prisma.InputJsonValue },
      });
    }

    const preferences = await this.sendHandler.loadUserPreferences(tenantId, userId);
    const tenantProviderSettings = await this.sendHandler.loadTenantProviderSettings(tenantId);
    const subscription = await this.aiSubscription.enforceInference(tenantId, userId, {
      attachments: body.attachments,
      workspaceId: conv.workspaceId,
    });

    const userMsg = await this.reuseOrCreateUserMessage(
      tenantId,
      conversationId,
      body.content.trim(),
      body.attachments,
    );

    const input = {
      tenantId,
      userId,
      userMessage: body.content.trim(),
      workspaceId: conv.workspaceId,
      context: mergedContext,
      conversationId,
      attachments: body.attachments,
      preferences,
      tenantProviderSettings,
      locale: resolveInferenceLocale(preferences, mergedContext),
      forceTemplateOnly: !subscription.externalProvidersEnabled,
    };

    return { tenantId, userId, conv, userMsg, input, preferences };
  }

  async finalize(
    tenantId: string,
    userId: string,
    conversationId: string,
    convTitle: string,
    userContent: string,
    result: {
      content: string;
      citations: unknown;
      tokenCount: number;
      latencyMs: number;
      provider?: string;
      model?: string;
      skillId?: string;
    },
  ) {
    const assistantMsg = await this.prisma.aiMessage.create({
      data: {
        tenantId,
        conversationId,
        role: 'assistant',
        content: result.content,
        citationsJson: result.citations as unknown as Prisma.InputJsonValue,
        tokenCount: result.tokenCount,
      },
    });

    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        title: convTitle === 'New conversation' ? userContent.slice(0, 48) : convTitle,
      },
    });

    await this.sendHandler.recordUsage(tenantId, userId, result.tokenCount, result.latencyMs, true);

    if (result.provider && result.model) {
      await this.sendHandler.logInferenceAudit(tenantId, userId, conversationId, {
        provider: result.provider as never,
        model: result.model,
        skillId: result.skillId,
        tokenCount: result.tokenCount,
        latencyMs: result.latencyMs,
      });
    }

    return assistantMsg;
  }

  private async reuseOrCreateUserMessage(
    tenantId: string,
    conversationId: string,
    content: string,
    attachments?: AiMessageBody['attachments'],
  ) {
    const latest = await this.prisma.aiMessage.findFirst({
      where: { tenantId, conversationId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, role: true, content: true },
    });

    if (latest?.role === 'user' && latest.content === content) {
      return latest;
    }

    return this.prisma.aiMessage.create({
      data: {
        tenantId,
        conversationId,
        role: 'user',
        content,
        attachmentsJson: (attachments ?? []) as Prisma.InputJsonValue,
      },
    });
  }
}

@Injectable()
export class GetAiSubscriptionLimitsHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly aiSubscription: AiSubscriptionService,
  ) {}

  async execute(userId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    return this.aiSubscription.getLimits(tenantId, userId);
  }
}

@Injectable()
export class GetAiSmartActionsHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly smartActions: AiSmartActionsService,
  ) {}

  async execute(
    userId: string,
    query: {
      path?: string;
      patientId?: string;
      encounterId?: string;
      invoiceId?: string;
      workflowId?: string;
      appointmentId?: string;
      inventoryItemId?: string;
      reportId?: string;
      analyticsDomain?: string;
      module?: string;
      locale?: string;
    },
  ) {
    const { tenantId } = await this.tenantContext.resolve();
    return this.smartActions.listForContext(
      tenantId,
      userId,
      {
        path: query.path,
        patientId: query.patientId,
        encounterId: query.encounterId,
        invoiceId: query.invoiceId,
        workflowId: query.workflowId,
        appointmentId: query.appointmentId,
        inventoryItemId: query.inventoryItemId,
        reportId: query.reportId,
        analyticsDomain: query.analyticsDomain,
        module: query.module,
      },
      query.locale,
    );
  }
}

@Injectable()
export class GetAiCommandsResolveHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly commandResolver: AiCommandResolverService,
  ) {}

  async execute(
    userId: string,
    query: {
      q?: string;
      path?: string;
      patientId?: string;
      encounterId?: string;
      invoiceId?: string;
      workflowId?: string;
      appointmentId?: string;
      inventoryItemId?: string;
      reportId?: string;
      analyticsDomain?: string;
      module?: string;
      locale?: string;
    },
  ) {
    const { tenantId } = await this.tenantContext.resolve();
    return this.commandResolver.resolve(
      tenantId,
      userId,
      query.q ?? '',
      {
        path: query.path,
        patientId: query.patientId,
        encounterId: query.encounterId,
        invoiceId: query.invoiceId,
        workflowId: query.workflowId,
        appointmentId: query.appointmentId,
        inventoryItemId: query.inventoryItemId,
        reportId: query.reportId,
        analyticsDomain: query.analyticsDomain,
        module: query.module,
      },
      query.locale,
    );
  }
}

@Injectable()
export class GetAiContextSummaryHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly contextSummary: AiContextSummaryService,
  ) {}

  async execute(query: AiRouteContextInput & { locale?: string }) {
    const { tenantId } = await this.tenantContext.resolve();
    return this.contextSummary.summarize(tenantId, query, query.locale);
  }
}

@Injectable()
export class GetAiProviderHealthHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly inference: AiInferenceService,
    private readonly subscription: AiSubscriptionService,
    private readonly tenantSettings: AiTenantSettingsService,
  ) {}

  async execute(userId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    const [providers, limits] = await Promise.all([
      this.inference.getProviderHealth(),
      this.subscription.getLimits(tenantId, userId),
    ]);
    const settings = await this.tenantSettings.getProviderSettings(tenantId);
    const active = this.tenantSettings.resolveActiveProvider(settings, providers, limits);
    return { activeProvider: active, providers, checkedAt: new Date().toISOString() };
  }
}

@Injectable()
export class GetPatientCopilotHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly aiSubscription: AiSubscriptionService,
  ) {}

  async execute(patientId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    await this.aiSubscription.enforceWorkspaceAccess(tenantId, 'medical');
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const encounters = await this.prisma.encounter.findMany({
      where: { tenantId, patientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const appointments = await this.prisma.appointment.findMany({
      where: { tenantId, patientId },
      orderBy: { scheduledStart: 'desc' },
      take: 5,
    });

    const profile = (patient.profileData as Record<string, unknown>) ?? {};
    const allergies = Array.isArray(profile.allergies) ? profile.allergies : [];

    return {
      patientId: patient.id,
      summary: {
        name: `${patient.firstName} ${patient.lastName}`,
        dateOfBirth: patient.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
      },
      visitCount: encounters.length,
      recentEncounters: encounters.map((e) => ({
        encounterId: e.id,
        date: e.createdAt.toISOString(),
        chiefComplaint: e.chiefComplaint,
        status: e.status,
        medicationCount: Array.isArray(e.medications) ? e.medications.length : 0,
        diagnosisCount: Array.isArray(e.diagnoses) ? e.diagnoses.length : 0,
      })),
      upcomingAppointments: appointments.map((a) => ({
        appointmentId: a.id,
        startAt: a.scheduledStart.toISOString(),
        status: a.status,
      })),
      allergies,
      riskIndicators: allergies.length > 0 ? ['documented_allergies'] : [],
      suggestedActions: [
        'Summarize patient chart',
        'Review medication list',
        'Suggest follow-up interval',
      ],
    };
  }
}

@Injectable()
export class GetAiPromptCategoriesHandler {
  execute() {
    return AI_PROMPT_CATEGORIES.map((c) => ({
      id: c.id,
      labelKey: c.labelKey,
      roles: c.roles,
    }));
  }
}

function mapAiPromptRow(p: {
  id: string;
  category: string;
  titleEn: string;
  titleAr: string | null;
  bodyEn: string;
  bodyAr: string | null;
  favorite: boolean;
  userId: string | null;
  roles: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    promptId: p.id,
    category: p.category,
    titleEn: p.titleEn,
    titleAr: p.titleAr,
    bodyEn: p.bodyEn,
    bodyAr: p.bodyAr,
    favorite: p.favorite,
    userId: p.userId,
    roles: p.roles,
    version: p.version,
    isTenantDefault: p.userId === null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@Injectable()
export class ListAiPromptsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(
    userId: string,
    userRoles: string[],
    category?: string | null,
    search?: string | null,
    favoritesOnly?: boolean,
  ) {
    const { tenantId } = await this.tenantContext.resolve();
    await ensureTenantDefaultPrompts(this.prisma, tenantId);
    const rows = await this.prisma.aiPrompt.findMany({
      where: {
        tenantId,
        OR: [{ userId: null }, { userId }],
        ...(category ? { category } : {}),
        ...(favoritesOnly ? { favorite: true } : {}),
        ...(search?.trim()
          ? {
              OR: [
                { titleEn: { contains: search.trim(), mode: 'insensitive' } },
                { titleAr: { contains: search.trim(), mode: 'insensitive' } },
                { bodyEn: { contains: search.trim(), mode: 'insensitive' } },
                { bodyAr: { contains: search.trim(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ favorite: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    });
    return rows
      .filter((p) => matchesPromptRoles(p.roles, userRoles))
      .map((p) => mapAiPromptRow(p));
  }
}

type UpsertAiPromptBody = {
  promptId?: string;
  category: string;
  titleEn: string;
  titleAr?: string;
  bodyEn: string;
  bodyAr?: string;
  favorite?: boolean;
  roles?: string[];
  isTenantDefault?: boolean;
};

@Injectable()
export class UpsertAiPromptHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly aiSubscription: AiSubscriptionService,
  ) {}

  async execute(userId: string, userRoles: string[], body: UpsertAiPromptBody) {
    const { tenantId } = await this.tenantContext.resolve();
    const roles = body.roles ?? [];
    const favorite = body.favorite ?? false;

    if (body.promptId) {
      const existing = await this.prisma.aiPrompt.findFirst({
        where: { id: body.promptId, tenantId },
      });
      if (!existing) throw new NotFoundException('Prompt not found');
      if (!canEditPrompt(userId, userRoles, existing)) {
        throw new ForbiddenException('You cannot edit this prompt');
      }

      await this.prisma.aiPromptVersion.create({
        data: {
          promptId: existing.id,
          version: existing.version,
          category: existing.category,
          titleEn: existing.titleEn,
          titleAr: existing.titleAr,
          bodyEn: existing.bodyEn,
          bodyAr: existing.bodyAr,
          favorite: existing.favorite,
          roles: existing.roles,
          createdBy: userId,
        },
      });

      const targetUserId = body.isTenantDefault
        ? null
        : existing.userId ?? userId;

      const row = await this.prisma.aiPrompt.update({
        where: { id: existing.id },
        data: {
          userId: canManageTenantDefault(userRoles) ? targetUserId : existing.userId,
          category: body.category,
          titleEn: body.titleEn,
          titleAr: body.titleAr ?? null,
          bodyEn: body.bodyEn,
          bodyAr: body.bodyAr ?? null,
          favorite,
          roles,
          version: existing.version + 1,
        },
      });
      return { promptId: row.id, version: row.version };
    }

    await this.aiSubscription.enforceCustomPrompts(tenantId);
    const row = await this.prisma.aiPrompt.create({
      data: {
        tenantId,
        userId: body.isTenantDefault && canManageTenantDefault(userRoles) ? null : userId,
        category: body.category,
        titleEn: body.titleEn,
        titleAr: body.titleAr ?? null,
        bodyEn: body.bodyEn,
        bodyAr: body.bodyAr ?? null,
        favorite,
        roles,
      },
    });
    return { promptId: row.id, version: row.version };
  }
}

function canManageTenantDefault(userRoles: string[]): boolean {
  return userRoles.some((r) => ['owner', 'general_manager', 'super_admin'].includes(r));
}

@Injectable()
export class ToggleAiPromptFavoriteHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, userRoles: string[], promptId: string, favorite: boolean) {
    const { tenantId } = await this.tenantContext.resolve();
    const existing = await this.prisma.aiPrompt.findFirst({
      where: { id: promptId, tenantId, OR: [{ userId: null }, { userId }] },
    });
    if (!existing) throw new NotFoundException('Prompt not found');
    if (!matchesPromptRoles(existing.roles, userRoles)) {
      throw new ForbiddenException('You cannot favorite this prompt');
    }
    const row = await this.prisma.aiPrompt.update({
      where: { id: promptId },
      data: { favorite },
    });
    return { promptId: row.id, favorite: row.favorite };
  }
}

@Injectable()
export class DeleteAiPromptHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, userRoles: string[], promptId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    const existing = await this.prisma.aiPrompt.findFirst({
      where: { id: promptId, tenantId },
    });
    if (!existing) throw new NotFoundException('Prompt not found');
    if (!canDeletePrompt(userId, userRoles, existing)) {
      throw new ForbiddenException('You cannot delete this prompt');
    }
    await this.prisma.aiPrompt.delete({ where: { id: promptId } });
    return { ok: true };
  }
}

@Injectable()
export class DuplicateAiPromptHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly upsertHandler: UpsertAiPromptHandler,
  ) {}

  async execute(userId: string, userRoles: string[], promptId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    const row = await this.prisma.aiPrompt.findFirst({
      where: { id: promptId, tenantId, OR: [{ userId: null }, { userId }] },
    });
    if (!row) throw new NotFoundException('Prompt not found');
    if (!matchesPromptRoles(row.roles, userRoles)) {
      throw new ForbiddenException('You cannot duplicate this prompt');
    }
    return this.upsertHandler.execute(userId, userRoles, {
      category: row.category,
      titleEn: `${row.titleEn} (copy)`,
      titleAr: row.titleAr ? `${row.titleAr} (نسخة)` : undefined,
      bodyEn: row.bodyEn,
      bodyAr: row.bodyAr ?? undefined,
      favorite: false,
      roles: row.roles,
    });
  }
}

@Injectable()
export class ListAiPromptVersionsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, userRoles: string[], promptId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    const prompt = await this.prisma.aiPrompt.findFirst({
      where: { id: promptId, tenantId, OR: [{ userId: null }, { userId }] },
    });
    if (!prompt) throw new NotFoundException('Prompt not found');
    if (!canEditPrompt(userId, userRoles, prompt)) {
      throw new ForbiddenException('You cannot view versions for this prompt');
    }
    const versions = await this.prisma.aiPromptVersion.findMany({
      where: { promptId },
      orderBy: { version: 'desc' },
      take: 25,
    });
    return versions.map((v) => ({
      versionId: v.id,
      version: v.version,
      category: v.category,
      titleEn: v.titleEn,
      titleAr: v.titleAr,
      bodyEn: v.bodyEn,
      bodyAr: v.bodyAr,
      favorite: v.favorite,
      roles: v.roles,
      createdAt: v.createdAt.toISOString(),
      createdBy: v.createdBy,
    }));
  }
}

@Injectable()
export class RestoreAiPromptVersionHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, userRoles: string[], promptId: string, versionId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    const prompt = await this.prisma.aiPrompt.findFirst({
      where: { id: promptId, tenantId },
    });
    if (!prompt) throw new NotFoundException('Prompt not found');
    if (!canEditPrompt(userId, userRoles, prompt)) {
      throw new ForbiddenException('You cannot restore versions for this prompt');
    }
    const snapshot = await this.prisma.aiPromptVersion.findFirst({
      where: { id: versionId, promptId },
    });
    if (!snapshot) throw new NotFoundException('Prompt version not found');

    await this.prisma.aiPromptVersion.create({
      data: {
        promptId: prompt.id,
        version: prompt.version,
        category: prompt.category,
        titleEn: prompt.titleEn,
        titleAr: prompt.titleAr,
        bodyEn: prompt.bodyEn,
        bodyAr: prompt.bodyAr,
        favorite: prompt.favorite,
        roles: prompt.roles,
        createdBy: userId,
      },
    });

    const row = await this.prisma.aiPrompt.update({
      where: { id: promptId },
      data: {
        category: snapshot.category,
        titleEn: snapshot.titleEn,
        titleAr: snapshot.titleAr,
        bodyEn: snapshot.bodyEn,
        bodyAr: snapshot.bodyAr,
        favorite: snapshot.favorite,
        roles: snapshot.roles,
        version: prompt.version + 1,
      },
    });
    return { promptId: row.id, version: row.version };
  }
}

@Injectable()
export class GetAiAdminProvidersHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantSettings: AiTenantSettingsService,
    private readonly inference: AiInferenceService,
    private readonly subscription: AiSubscriptionService,
  ) {}

  async execute(userId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    const [providers, limits] = await Promise.all([
      this.inference.getProviderHealth(),
      this.subscription.getLimits(tenantId, userId),
    ]);
    return this.tenantSettings.getProviderManagement(tenantId, providers, limits);
  }
}

@Injectable()
export class UpdateAiAdminProvidersHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantSettings: AiTenantSettingsService,
    private readonly subscription: AiSubscriptionService,
  ) {}

  async execute(userId: string, body: Partial<AiTenantProviderSettings>) {
    const { tenantId } = await this.tenantContext.resolve();
    const limits = await this.subscription.getLimits(tenantId, userId);
    const settings = await this.tenantSettings.updateProviderSettings(tenantId, limits, body);

    const roles = await this.prisma.userRoleAssignment.findMany({
      where: { userId },
      select: { role: true },
    });

    await this.prisma.auditEntry.create({
      data: {
        tenantId,
        action: AI_ADMIN_PROVIDER_AUDIT_ACTION,
        resourceType: AI_ADMIN_PROVIDER_AUDIT_RESOURCE,
        resourceId: tenantId,
        actorId: userId,
        actorRoles: roles.map((r) => r.role),
        category: 'ai',
        descriptionEn: `AI provider settings updated (preferred=${settings.preferredExternalProvider})`,
        descriptionAr: `تحديث إعدادات مزود الذكاء الاصطناعي (المفضل=${settings.preferredExternalProvider})`,
        details: {
          preferredExternalProvider: settings.preferredExternalProvider,
          geminiEnabled: String(settings.geminiEnabled),
          openaiEnabled: String(settings.openaiEnabled),
        },
      },
    });

    return settings;
  }
}

@Injectable()
export class GetAiAdminOverviewHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly adminService: AiAdminService,
  ) {}

  async execute(userId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    return this.adminService.getOverview(tenantId, userId);
  }
}

@Injectable()
export class GetAiAdminUsageHandler {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly adminService: AiAdminService,
  ) {}

  async execute(userId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    const overview = await this.adminService.getOverview(tenantId, userId);
    return {
      ...overview.usage,
      monthly: overview.usage.monthly,
    };
  }
}

@Injectable()
export class GetAiSettingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string) {
    const { tenantId } = await this.tenantContext.resolve();
    const row = await this.prisma.aiUserSettings.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    return (row?.preferencesJson as Record<string, unknown>) ?? {};
  }
}

@Injectable()
export class SaveAiSettingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, preferences: Record<string, unknown>) {
    const { tenantId } = await this.tenantContext.resolve();
    await this.prisma.aiUserSettings.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      create: { tenantId, userId, preferencesJson: preferences as Prisma.InputJsonValue },
      update: { preferencesJson: preferences as Prisma.InputJsonValue },
    });
    return preferences;
  }
}
