import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { NotificationPermissionGuard } from '../api/notification-permission.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { CreateNotificationDto } from '../application/dto/create-notification.dto';
import { CreateNotificationHandler } from '../application/handlers/create-notification.handler';
import { GetNotificationHandler } from '../application/handlers/get-notification.handler';
import { ListNotificationsHandler } from '../application/handlers/list-notifications.handler';
import { MarkNotificationReadHandler } from '../application/handlers/mark-notification-read.handler';
import { ListNotificationsCommand } from '../application/commands/list-notifications.command';
import { GetNotificationCommand } from '../application/commands/get-notification.command';
import { MarkNotificationReadCommand } from '../application/commands/mark-notification-read.command';
import {
  ComposeNotificationHandler,
  CreateAutomationRuleHandler,
  CreateNotificationTemplateHandler,
  DeleteAutomationRuleHandler,
  DeleteNotificationHandler,
  DeleteNotificationSavedFilterHandler,
  DeleteNotificationTemplateHandler,
  ExportNotificationsHandler,
  GetNotificationPreferencesHandler,
  GetNotificationsOverviewHandler,
  GetTenantNotificationSettingsHandler,
  GetUnreadNotificationCountHandler,
  ListAutomationRulesHandler,
  ListNotificationDraftsHandler,
  ListNotificationSavedFiltersHandler,
  ListNotificationsPaginatedHandler,
  ListNotificationTemplatesHandler,
  MarkAllNotificationsReadHandler,
  RegisterDeviceTokenHandler,
  RetryNotificationHandler,
  SaveNotificationDraftHandler,
  SaveNotificationFilterHandler,
  SendNotificationDraftHandler,
  TestSendNotificationTemplateHandler,
  UpdateAutomationRuleHandler,
  UpdateNotificationFlagsHandler,
  UpdateNotificationPreferencesHandler,
  UpdateNotificationTemplateHandler,
  UpdateTenantChannelConfigHandler,
} from '../application/handlers/notification-enterprise.handlers';
import { CommunicationHistoryService } from '../delivery/communication-history.service';
import { DeliveryWorkerService } from '../delivery/delivery-worker.service';
import { ReceiptService } from '../delivery/receipt.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { NotificationChannelId } from '../delivery/delivery.types';

type AuthRequest = Request & { user?: { userId?: string; sub?: string; id?: string; roles?: string[] } };

@Controller('notifications')
@UseGuards(NotificationPermissionGuard)
@RequireLicensedModule('notifications')
export class NotificationController {
  constructor(
    private readonly createNotificationHandler: CreateNotificationHandler,
    private readonly getNotificationHandler: GetNotificationHandler,
    private readonly listNotificationsHandler: ListNotificationsHandler,
    private readonly markNotificationReadHandler: MarkNotificationReadHandler,
    private readonly overviewHandler: GetNotificationsOverviewHandler,
    private readonly paginatedListHandler: ListNotificationsPaginatedHandler,
    private readonly markAllReadHandler: MarkAllNotificationsReadHandler,
    private readonly flagsHandler: UpdateNotificationFlagsHandler,
    private readonly retryHandler: RetryNotificationHandler,
    private readonly deleteHandler: DeleteNotificationHandler,
    private readonly exportHandler: ExportNotificationsHandler,
    private readonly templatesHandler: ListNotificationTemplatesHandler,
    private readonly createTemplateHandler: CreateNotificationTemplateHandler,
    private readonly updateTemplateHandler: UpdateNotificationTemplateHandler,
    private readonly testTemplateHandler: TestSendNotificationTemplateHandler,
    private readonly preferencesHandler: GetNotificationPreferencesHandler,
    private readonly updatePreferencesHandler: UpdateNotificationPreferencesHandler,
    private readonly tenantSettingsHandler: GetTenantNotificationSettingsHandler,
    private readonly updateChannelHandler: UpdateTenantChannelConfigHandler,
    private readonly automationListHandler: ListAutomationRulesHandler,
    private readonly createAutomationHandler: CreateAutomationRuleHandler,
    private readonly updateAutomationHandler: UpdateAutomationRuleHandler,
    private readonly composeHandler: ComposeNotificationHandler,
    private readonly savedFiltersHandler: ListNotificationSavedFiltersHandler,
    private readonly saveFilterHandler: SaveNotificationFilterHandler,
    private readonly deleteFilterHandler: DeleteNotificationSavedFilterHandler,
    private readonly unreadCountHandler: GetUnreadNotificationCountHandler,
    private readonly saveDraftHandler: SaveNotificationDraftHandler,
    private readonly listDraftsHandler: ListNotificationDraftsHandler,
    private readonly sendDraftHandler: SendNotificationDraftHandler,
    private readonly deleteTemplateHandler: DeleteNotificationTemplateHandler,
    private readonly deleteAutomationHandler: DeleteAutomationRuleHandler,
    private readonly registerDeviceHandler: RegisterDeviceTokenHandler,
    private readonly communicationHistory: CommunicationHistoryService,
    private readonly deliveryWorker: DeliveryWorkerService,
    private readonly receiptService: ReceiptService,
    private readonly tenantContext: TenantContextService,
  ) {}

  private actor(req: AuthRequest) {
    return {
      actorId: req.user?.userId ?? req.user?.sub ?? req.user?.id ?? '',
      actorRoles: req.user?.roles ?? [],
    };
  }

  @Get('overview')
  @RequirePermission('api.notifications', 'view')
  async overview(@Query('recipientId') recipientId?: string) {
    return this.overviewHandler.execute(recipientId?.trim() || undefined);
  }

  @Get('unread-count')
  @RequirePermission('api.notifications', 'view')
  async unreadCount(@Req() req: AuthRequest) {
    const { actorId } = this.actor(req);
    return this.unreadCountHandler.execute(actorId);
  }

  @Get('export')
  @RequirePermission('api.notifications', 'export')
  @Header('Content-Type', 'text/csv')
  async export(
    @Req() req: AuthRequest,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('limit') limit?: string,
  ) {
    const { actorId, actorRoles } = this.actor(req);
    const result = await this.exportHandler.execute(
      {
        status,
        channel,
        limit: limit ? parseInt(limit, 10) : undefined,
      },
      actorId,
      actorRoles,
    );
    return result.csv;
  }

  @Get('templates')
  @RequirePermission('api.notifications', 'view')
  async listTemplates(@Query('search') search?: string) {
    return this.templatesHandler.execute(search);
  }

  @Post('templates')
  @RequirePermission('api.notifications', 'manage')
  async createTemplate(@Body() body: Record<string, unknown>, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.createTemplateHandler.execute(body as never, actorId, actorRoles);
  }

  @Patch('templates/:templateId')
  @RequirePermission('api.notifications', 'manage')
  async updateTemplate(
    @Param('templateId') templateId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthRequest,
  ) {
    const { actorId, actorRoles } = this.actor(req);
    return this.updateTemplateHandler.execute(templateId, body as never, actorId, actorRoles);
  }

  @Post('templates/:templateId/test')
  @RequirePermission('api.notifications', 'manage')
  async testTemplate(
    @Param('templateId') templateId: string,
    @Body() body: { recipientId: string; variables?: Record<string, string> },
    @Req() req: AuthRequest,
  ) {
    const { actorId, actorRoles } = this.actor(req);
    return this.testTemplateHandler.execute(templateId, body.recipientId, body.variables ?? {}, actorId, actorRoles);
  }

  @Get('preferences/me')
  @RequirePermission('api.notifications', 'view')
  async myPreferences(@Req() req: AuthRequest) {
    const { actorId } = this.actor(req);
    return this.preferencesHandler.execute(actorId);
  }

  @Patch('preferences/me')
  @RequirePermission('api.notifications', 'update')
  async updateMyPreferences(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    const { actorId } = this.actor(req);
    return this.updatePreferencesHandler.execute(actorId, body);
  }

  @Get('settings/channels')
  @RequirePermission('api.notifications', 'manage')
  async channelSettings() {
    return this.tenantSettingsHandler.execute();
  }

  @Patch('settings/channels/:channel')
  @RequirePermission('api.notifications', 'manage')
  async updateChannel(@Param('channel') channel: string, @Body() body: Record<string, unknown>, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.updateChannelHandler.execute(channel, body as never, actorId, actorRoles);
  }

  @Get('automation')
  @RequirePermission('api.notifications', 'manage')
  async listAutomation() {
    return this.automationListHandler.execute();
  }

  @Post('automation')
  @RequirePermission('api.notifications', 'manage')
  async createAutomation(@Body() body: Record<string, unknown>, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.createAutomationHandler.execute(body as never, actorId, actorRoles);
  }

  @Patch('automation/:ruleId')
  @RequirePermission('api.notifications', 'manage')
  async updateAutomation(@Param('ruleId') ruleId: string, @Body() body: Record<string, unknown>, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.updateAutomationHandler.execute(ruleId, body as never, actorId, actorRoles);
  }

  @Post('compose')
  @RequirePermission('api.notifications', 'create')
  async compose(@Body() body: Record<string, unknown>, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.composeHandler.execute({ ...(body as never), actorId, actorRoles });
  }

  @Get('drafts')
  @RequirePermission('api.notifications', 'create')
  async listDrafts(@Req() req: AuthRequest) {
    const { actorId } = this.actor(req);
    return this.listDraftsHandler.execute(actorId);
  }

  @Post('drafts')
  @RequirePermission('api.notifications', 'create')
  async saveDraft(@Body() body: Record<string, unknown>, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.saveDraftHandler.execute(body as never, actorId, actorRoles);
  }

  @Post('drafts/:draftId/send')
  @RequirePermission('api.notifications', 'create')
  async sendDraft(@Param('draftId') draftId: string, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.sendDraftHandler.execute(draftId, actorId, actorRoles);
  }

  @Delete('templates/:templateId')
  @RequirePermission('api.notifications', 'manage')
  async deleteTemplate(@Param('templateId') templateId: string, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.deleteTemplateHandler.execute(templateId, actorId, actorRoles);
  }

  @Delete('automation/:ruleId')
  @RequirePermission('api.notifications', 'manage')
  async deleteAutomation(@Param('ruleId') ruleId: string, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.deleteAutomationHandler.execute(ruleId, actorId, actorRoles);
  }

  @Post('device-tokens')
  @RequirePermission('api.notifications', 'update')
  async registerDevice(@Body() body: { platform: string; token: string }, @Req() req: AuthRequest) {
    const { actorId } = this.actor(req);
    return this.registerDeviceHandler.execute(actorId, body);
  }

  @Get('saved-filters')
  @RequirePermission('api.notifications', 'view')
  async savedFilters(@Req() req: AuthRequest) {
    const { actorId } = this.actor(req);
    return this.savedFiltersHandler.execute(actorId);
  }

  @Post('saved-filters')
  @RequirePermission('api.notifications', 'view')
  async saveFilter(
    @Req() req: AuthRequest,
    @Body() body: { name: string; filters: Record<string, unknown> },
  ) {
    const { actorId } = this.actor(req);
    return this.saveFilterHandler.execute(actorId, body.name, body.filters);
  }

  @Delete('saved-filters/:filterId')
  @RequirePermission('api.notifications', 'view')
  async deleteFilter(@Req() req: AuthRequest, @Param('filterId') filterId: string) {
    const { actorId } = this.actor(req);
    return this.deleteFilterHandler.execute(actorId, filterId);
  }

  @Post('read-all')
  @RequirePermission('api.notifications', 'update')
  async markAllRead(@Req() req: AuthRequest, @Body() body: { recipientId?: string }) {
    const { actorId, actorRoles } = this.actor(req);
    return this.markAllReadHandler.execute(body.recipientId?.trim() || actorId, actorId, actorRoles);
  }

  @Get('communication-history')
  @RequirePermission('api.notifications', 'view')
  async communicationHistoryList(
    @Query('recipientId') recipientId?: string,
    @Query('channel') channel?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('redact') redact?: string,
  ) {
    const tenant = await this.tenantContext.resolve();
    if (!tenant?.tenantId) {
      return { entries: [], nextCursor: null };
    }
    return this.communicationHistory.list({
      tenantId: tenant.tenantId,
      recipientId: recipientId?.trim(),
      channel: channel?.trim() as NotificationChannelId | undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor: cursor?.trim(),
      // Full content requires manage; default redacted.
      redact: redact === 'false' ? false : true,
    });
  }

  @Get('communication-history/:jobId')
  @RequirePermission('api.notifications', 'view')
  async communicationHistoryDetail(@Param('jobId') jobId: string, @Query('redact') redact?: string) {
    const tenant = await this.tenantContext.resolve();
    if (!tenant?.tenantId) {
      throw new Error('tenant context required');
    }
    return this.communicationHistory.get(jobId, tenant.tenantId, redact !== 'false');
  }

  @Post('delivery-jobs/:jobId/process')
  @RequirePermission('api.notifications', 'manage')
  async processDeliveryJob(@Param('jobId') jobId: string) {
    return this.deliveryWorker.processDeliveryJob(jobId);
  }

  @Post('delivery-jobs/:jobId/receipts')
  @RequirePermission('api.notifications', 'manage')
  async upsertDeliveryReceipt(
    @Param('jobId') jobId: string,
    @Body()
    body: {
      channel: string;
      status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
      externalId?: string;
    },
  ) {
    const tenant = await this.tenantContext.resolve();
    if (!tenant?.tenantId) {
      return { applied: false, reason: 'no tenant' };
    }
    return this.receiptService.upsert({
      tenantId: tenant.tenantId,
      jobId,
      channel: body.channel,
      status: body.status,
      externalId: body.externalId,
    });
  }

  @Post()
  @RequirePermission('api.notifications', 'create')
  async createNotification(@Body() body: CreateNotificationDto) {
    return await this.createNotificationHandler.execute({
      recipientId: body.recipientId,
      channel: body.channel,
      title: body.title,
      body: body.body,
      priority: body.priority,
      branchId: body.branchId ?? null,
    });
  }

  @Get()
  @RequirePermission('api.notifications', 'view')
  async listNotifications(
    @Query('recipientId') recipientId?: string,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('branchId') branchId?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('starredOnly') starredOnly?: string,
    @Query('archivedOnly') archivedOnly?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('paginated') paginated?: string,
  ) {
    if (paginated === 'true' || limit || cursor || unreadOnly || starredOnly || archivedOnly || search || category) {
      return this.paginatedListHandler.execute({
        recipientId: recipientId?.trim(),
        channel: channel?.trim(),
        status: status?.trim(),
        category: category?.trim(),
        branchId: branchId?.trim(),
        unreadOnly: unreadOnly === 'true',
        starredOnly: starredOnly === 'true',
        archivedOnly: archivedOnly === 'true' ? true : archivedOnly === 'false' ? false : undefined,
        search: search?.trim(),
        limit: limit ? parseInt(limit, 10) : undefined,
        cursor: cursor?.trim(),
      });
    }
    return await this.listNotificationsHandler.execute(
      new ListNotificationsCommand(
        recipientId?.trim() || null,
        channel?.trim() || null,
        status?.trim() || null,
        branchId?.trim() || null,
      ),
    );
  }

  @Get(':notificationId')
  @RequirePermission('api.notifications', 'view')
  async getNotification(@Param('notificationId') notificationId: string) {
    return await this.getNotificationHandler.execute(new GetNotificationCommand(notificationId));
  }

  @Post(':notificationId/read')
  @RequirePermission('api.notifications', 'update')
  async markRead(@Param('notificationId') notificationId: string) {
    return await this.markNotificationReadHandler.execute(new MarkNotificationReadCommand(notificationId));
  }

  @Patch(':notificationId')
  @RequirePermission('api.notifications', 'update')
  async updateFlags(
    @Param('notificationId') notificationId: string,
    @Body() body: { isStarred?: boolean; isArchived?: boolean },
    @Req() req: AuthRequest,
  ) {
    const { actorId, actorRoles } = this.actor(req);
    return this.flagsHandler.execute(notificationId, body, actorId, actorRoles);
  }

  @Post(':notificationId/retry')
  @RequirePermission('api.notifications', 'manage')
  async retry(@Param('notificationId') notificationId: string, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.retryHandler.execute(notificationId, actorId, actorRoles);
  }

  @Delete(':notificationId')
  @RequirePermission('api.notifications', 'delete')
  async deleteNotification(@Param('notificationId') notificationId: string, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.deleteHandler.execute(notificationId, actorId, actorRoles);
  }
}
