import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { AiAccessGuard } from './ai-access.guard';
import {
  CreateAiConversationHandler,
  DeleteAiConversationHandler,
  DeleteAiPromptHandler,
  DuplicateAiPromptHandler,
  GetAiConversationHandler,
  GetAiOverviewHandler,
  GetAiAdminUsageHandler,
  GetAiAdminOverviewHandler,
  GetAiAdminProvidersHandler,
  UpdateAiAdminProvidersHandler,
  GetAiPromptCategoriesHandler,
  GetAiProviderHealthHandler,
  GetAiSmartActionsHandler,
  GetAiCommandsResolveHandler,
  GetAiContextSummaryHandler,
  GetAiSubscriptionLimitsHandler,
  GetAiSettingsHandler,
  GetPatientCopilotHandler,
  ListAiConversationsHandler,
  ListAiPromptsHandler,
  ListAiPromptVersionsHandler,
  RestoreAiPromptVersionHandler,
  SaveAiSettingsHandler,
  SendAiMessageHandler,
  StreamAiMessageHandler,
  ToggleAiPromptFavoriteHandler,
  UpdateAiConversationHandler,
  UpsertAiPromptHandler,
} from '../application/handlers/ai-assistant.handlers';
import { AiInferenceService } from '../application/services/ai-inference.service';

type AuthRequest = { user?: { id?: string; userId?: string; roles?: string[] } };

type StreamBody = {
  content: string;
  attachments?: Array<{ name: string; mimeType: string; dataUrl?: string }>;
  context?: Record<string, unknown>;
};

@Controller('ai')
@UseGuards(AiAccessGuard)
@RequireLicensedModule('ai')
@RequireLicensedFeature('aiChat')
export class AiAssistantController {
  constructor(
    private readonly overviewHandler: GetAiOverviewHandler,
    private readonly adminUsageHandler: GetAiAdminUsageHandler,
    private readonly adminOverviewHandler: GetAiAdminOverviewHandler,
    private readonly adminProvidersHandler: GetAiAdminProvidersHandler,
    private readonly updateAdminProvidersHandler: UpdateAiAdminProvidersHandler,
    private readonly providerHealthHandler: GetAiProviderHealthHandler,
    private readonly subscriptionLimitsHandler: GetAiSubscriptionLimitsHandler,
    private readonly smartActionsHandler: GetAiSmartActionsHandler,
    private readonly commandsResolveHandler: GetAiCommandsResolveHandler,
    private readonly contextSummaryHandler: GetAiContextSummaryHandler,
    private readonly listConversationsHandler: ListAiConversationsHandler,
    private readonly getConversationHandler: GetAiConversationHandler,
    private readonly createConversationHandler: CreateAiConversationHandler,
    private readonly updateConversationHandler: UpdateAiConversationHandler,
    private readonly deleteConversationHandler: DeleteAiConversationHandler,
    private readonly sendMessageHandler: SendAiMessageHandler,
    private readonly streamHandler: StreamAiMessageHandler,
    private readonly patientCopilotHandler: GetPatientCopilotHandler,
    private readonly listPromptsHandler: ListAiPromptsHandler,
    private readonly promptCategoriesHandler: GetAiPromptCategoriesHandler,
    private readonly upsertPromptHandler: UpsertAiPromptHandler,
    private readonly togglePromptFavoriteHandler: ToggleAiPromptFavoriteHandler,
    private readonly deletePromptHandler: DeleteAiPromptHandler,
    private readonly duplicatePromptHandler: DuplicateAiPromptHandler,
    private readonly listPromptVersionsHandler: ListAiPromptVersionsHandler,
    private readonly restorePromptVersionHandler: RestoreAiPromptVersionHandler,
    private readonly getSettingsHandler: GetAiSettingsHandler,
    private readonly saveSettingsHandler: SaveAiSettingsHandler,
    private readonly inference: AiInferenceService,
  ) {}

  private uid(req: AuthRequest) {
    return req.user?.userId ?? req.user?.id ?? '';
  }

  private roles(req: AuthRequest) {
    return req.user?.roles ?? [];
  }

  @Get('overview')
  @RequirePermission('api.ai', 'view')
  overview(@Req() req: AuthRequest) {
    return this.overviewHandler.execute(this.uid(req));
  }

  @Get('providers/health')
  @RequirePermission('api.ai', 'view')
  providerHealth(@Req() req: AuthRequest) {
    return this.providerHealthHandler.execute(this.uid(req));
  }

  @Get('subscription/limits')
  @RequirePermission('api.ai', 'view')
  subscriptionLimits(@Req() req: AuthRequest) {
    return this.subscriptionLimitsHandler.execute(this.uid(req));
  }

  @Get('context/summary')
  @RequirePermission('api.ai', 'view')
  contextSummary(
    @Query('path') path?: string,
    @Query('module') module?: string,
    @Query('patientId') patientId?: string,
    @Query('encounterId') encounterId?: string,
    @Query('appointmentId') appointmentId?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('workflowId') workflowId?: string,
    @Query('inventoryItemId') inventoryItemId?: string,
    @Query('reportId') reportId?: string,
    @Query('analyticsDomain') analyticsDomain?: string,
    @Query('dentalPatientId') dentalPatientId?: string,
    @Query('beautyPatientId') beautyPatientId?: string,
    @Query('locale') locale?: string,
  ) {
    return this.contextSummaryHandler.execute({
      path,
      module,
      patientId,
      encounterId,
      appointmentId,
      invoiceId,
      workflowId,
      inventoryItemId,
      reportId,
      analyticsDomain,
      dentalPatientId,
      beautyPatientId,
      locale,
    });
  }

  @Get('commands/resolve')
  @RequirePermission('api.ai', 'view')
  resolveCommands(
    @Req() req: AuthRequest,
    @Query('q') q?: string,
    @Query('path') path?: string,
    @Query('patientId') patientId?: string,
    @Query('encounterId') encounterId?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('workflowId') workflowId?: string,
    @Query('appointmentId') appointmentId?: string,
    @Query('inventoryItemId') inventoryItemId?: string,
    @Query('reportId') reportId?: string,
    @Query('analyticsDomain') analyticsDomain?: string,
    @Query('module') module?: string,
    @Query('locale') locale?: string,
  ) {
    return this.commandsResolveHandler.execute(this.uid(req), {
      q,
      path,
      patientId,
      encounterId,
      invoiceId,
      workflowId,
      appointmentId,
      inventoryItemId,
      reportId,
      analyticsDomain,
      module,
      locale,
    });
  }

  @Get('smart-actions')
  @RequirePermission('api.ai', 'view')
  smartActions(
    @Req() req: AuthRequest,
    @Query('path') path?: string,
    @Query('patientId') patientId?: string,
    @Query('encounterId') encounterId?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('workflowId') workflowId?: string,
    @Query('appointmentId') appointmentId?: string,
    @Query('inventoryItemId') inventoryItemId?: string,
    @Query('reportId') reportId?: string,
    @Query('analyticsDomain') analyticsDomain?: string,
    @Query('module') module?: string,
    @Query('locale') locale?: string,
  ) {
    return this.smartActionsHandler.execute(this.uid(req), {
      path,
      patientId,
      encounterId,
      invoiceId,
      workflowId,
      appointmentId,
      inventoryItemId,
      reportId,
      analyticsDomain,
      module,
      locale,
    });
  }

  @Get('admin/usage')
  @RequirePermission('api.ai', 'approve')
  adminUsage(@Req() req: AuthRequest) {
    return this.adminUsageHandler.execute(this.uid(req));
  }

  @Get('admin/overview')
  @RequirePermission('api.ai', 'approve')
  adminOverview(@Req() req: AuthRequest) {
    return this.adminOverviewHandler.execute(this.uid(req));
  }

  @Get('admin/providers')
  @RequireLicensedFeature('multiProviderAi')
  @RequirePermission('api.ai', 'approve')
  adminProviders(@Req() req: AuthRequest) {
    return this.adminProvidersHandler.execute(this.uid(req));
  }

  @Patch('admin/providers')
  @RequireLicensedFeature('multiProviderAi')
  @RequirePermission('api.ai', 'approve')
  updateAdminProviders(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    return this.updateAdminProvidersHandler.execute(this.uid(req), body as never);
  }

  @Get('conversations')
  @RequirePermission('api.ai', 'view')
  listConversations(@Req() req: AuthRequest, @Query('search') search?: string) {
    return this.listConversationsHandler.execute(this.uid(req), search);
  }

  @Post('conversations')
  @RequirePermission('api.ai', 'create')
  createConversation(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    return this.createConversationHandler.execute(this.uid(req), body as never);
  }

  @Get('conversations/:conversationId')
  @RequirePermission('api.ai', 'view')
  getConversation(@Req() req: AuthRequest, @Param('conversationId') conversationId: string) {
    return this.getConversationHandler.execute(this.uid(req), conversationId);
  }

  @Get('conversations/:conversationId/export')
  @RequirePermission('api.ai', 'export')
  async exportConversation(@Req() req: AuthRequest, @Param('conversationId') conversationId: string) {
    const data = await this.getConversationHandler.execute(this.uid(req), conversationId);
    return { export: JSON.stringify(data, null, 2) };
  }

  @Patch('conversations/:conversationId')
  @RequirePermission('api.ai', 'update')
  updateConversation(
    @Req() req: AuthRequest,
    @Param('conversationId') conversationId: string,
    @Body() body: { title?: string; pinned?: boolean },
  ) {
    return this.updateConversationHandler.execute(this.uid(req), conversationId, body);
  }

  @Delete('conversations/:conversationId')
  @RequirePermission('api.ai', 'delete')
  deleteConversation(@Req() req: AuthRequest, @Param('conversationId') conversationId: string) {
    return this.deleteConversationHandler.execute(this.uid(req), conversationId);
  }

  @Post('conversations/:conversationId/messages')
  @RequirePermission('api.ai', 'create')
  sendMessage(
    @Req() req: AuthRequest,
    @Param('conversationId') conversationId: string,
    @Body() body: StreamBody,
  ) {
    return this.sendMessageHandler.execute(this.uid(req), conversationId, body);
  }

  @Post('conversations/:conversationId/messages/stream')
  @RequirePermission('api.ai', 'create')
  async streamMessagePost(
    @Req() req: AuthRequest,
    @Param('conversationId') conversationId: string,
    @Body() body: StreamBody,
    @Res() res: Response,
  ) {
    await this.runInferenceStream(res, this.uid(req), conversationId, body);
  }

  private async pipeInferenceStream(
    prepared: Awaited<ReturnType<StreamAiMessageHandler['prepare']>>,
    conversationId: string,
    userContent: string,
    onChunk: (chunk: string) => void,
  ) {
    let full = '';
    let result;
    try {
      const gen = this.inference.stream(prepared.input);
      let next = await gen.next();
      while (!next.done) {
        full += next.value;
        onChunk(next.value);
        next = await gen.next();
      }
      result = next.value;
    } catch (err) {
      await this.sendMessageHandler.recordUsage(prepared.tenantId, prepared.userId, 0, 0, false);
      throw err instanceof Error ? err : new Error('AI stream failed');
    }

    await this.streamHandler.finalize(
      prepared.tenantId,
      prepared.userId,
      conversationId,
      prepared.conv.title,
      userContent.trim(),
      {
        content: result.content || full,
        citations: result.citations,
        tokenCount: result.tokenCount,
        latencyMs: result.latencyMs,
        provider: result.provider,
        model: result.model,
        skillId: result.skillId,
      },
    );
  }

  private streamErrorMessage(err: unknown): string {
    if (err instanceof HttpException) {
      const body = err.getResponse();
      if (typeof body === 'object' && body !== null && 'message' in body) {
        const message = (body as { message: unknown }).message;
        return Array.isArray(message) ? message.join(', ') : String(message);
      }
    }
    return err instanceof Error ? err.message : 'AI stream failed';
  }

  private streamErrorStatus(err: unknown): number {
    if (err instanceof HttpException) return err.getStatus();
    if (err && typeof err === 'object' && 'status' in err && typeof (err as { status: number }).status === 'number') {
      return (err as { status: number }).status;
    }
    return 500;
  }

  private respondStreamPrepareError(res: Response, err: unknown) {
    if (res.headersSent) return;
    const status = this.streamErrorStatus(err);
    res.status(status).json({
      statusCode: status,
      message: this.streamErrorMessage(err),
    });
  }

  private async runInferenceStream(res: Response, userId: string, conversationId: string, body: StreamBody) {
    let prepared: Awaited<ReturnType<StreamAiMessageHandler['prepare']>>;
    try {
      prepared = await this.streamHandler.prepare(userId, conversationId, body);
    } catch (err) {
      this.respondStreamPrepareError(res, err);
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    try {
      await this.pipeInferenceStream(prepared, conversationId, body.content, (chunk) => {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      });
      res.write(`event: done\ndata: {}\n\n`);
    } catch (err) {
      const message = this.streamErrorMessage(err);
      const statusCode = this.streamErrorStatus(err);
      if (!res.headersSent) {
        res.status(statusCode >= 400 ? statusCode : 500);
      }
      res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    } finally {
      res.end();
    }
  }

  @Get('copilot/patient/:patientId')
  @RequireLicensedFeature('medicalCopilot')
  @RequirePermission('api.ai', 'view')
  patientCopilot(@Param('patientId') patientId: string) {
    return this.patientCopilotHandler.execute(patientId);
  }

  @Get('prompts/categories')
  @RequireLicensedFeature('organizationKnowledge')
  @RequirePermission('api.ai', 'view')
  promptCategories() {
    return this.promptCategoriesHandler.execute();
  }

  @Get('prompts')
  @RequireLicensedFeature('organizationKnowledge')
  @RequirePermission('api.ai', 'view')
  listPrompts(
    @Req() req: AuthRequest,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('favoritesOnly') favoritesOnly?: string,
  ) {
    return this.listPromptsHandler.execute(
      this.uid(req),
      this.roles(req),
      category,
      search,
      favoritesOnly === 'true' || favoritesOnly === '1',
    );
  }

  @Post('prompts')
  @RequireLicensedFeature('organizationKnowledge')
  @RequirePermission('api.ai', 'create')
  createPrompt(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    return this.upsertPromptHandler.execute(this.uid(req), this.roles(req), body as never);
  }

  @Patch('prompts/:promptId')
  @RequireLicensedFeature('organizationKnowledge')
  @RequirePermission('api.ai', 'update')
  updatePrompt(
    @Req() req: AuthRequest,
    @Param('promptId') promptId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.upsertPromptHandler.execute(this.uid(req), this.roles(req), { ...body, promptId } as never);
  }

  @Patch('prompts/:promptId/favorite')
  @RequireLicensedFeature('organizationKnowledge')
  @RequirePermission('api.ai', 'update')
  togglePromptFavorite(
    @Req() req: AuthRequest,
    @Param('promptId') promptId: string,
    @Body() body: { favorite: boolean },
  ) {
    return this.togglePromptFavoriteHandler.execute(
      this.uid(req),
      this.roles(req),
      promptId,
      Boolean(body.favorite),
    );
  }

  @Delete('prompts/:promptId')
  @RequireLicensedFeature('organizationKnowledge')
  @RequirePermission('api.ai', 'delete')
  deletePrompt(@Req() req: AuthRequest, @Param('promptId') promptId: string) {
    return this.deletePromptHandler.execute(this.uid(req), this.roles(req), promptId);
  }

  @Post('prompts/:promptId/duplicate')
  @RequireLicensedFeature('organizationKnowledge')
  @RequirePermission('api.ai', 'create')
  duplicatePrompt(@Req() req: AuthRequest, @Param('promptId') promptId: string) {
    return this.duplicatePromptHandler.execute(this.uid(req), this.roles(req), promptId);
  }

  @Get('prompts/:promptId/versions')
  @RequireLicensedFeature('organizationKnowledge')
  @RequirePermission('api.ai', 'view')
  listPromptVersions(@Req() req: AuthRequest, @Param('promptId') promptId: string) {
    return this.listPromptVersionsHandler.execute(this.uid(req), this.roles(req), promptId);
  }

  @Post('prompts/:promptId/versions/:versionId/restore')
  @RequireLicensedFeature('organizationKnowledge')
  @RequirePermission('api.ai', 'update')
  restorePromptVersion(
    @Req() req: AuthRequest,
    @Param('promptId') promptId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.restorePromptVersionHandler.execute(this.uid(req), this.roles(req), promptId, versionId);
  }

  @Get('settings')
  @RequirePermission('api.ai', 'view')
  getSettings(@Req() req: AuthRequest) {
    return this.getSettingsHandler.execute(this.uid(req));
  }

  @Patch('settings')
  @RequirePermission('api.ai', 'update')
  saveSettings(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    return this.saveSettingsHandler.execute(this.uid(req), body);
  }
}
