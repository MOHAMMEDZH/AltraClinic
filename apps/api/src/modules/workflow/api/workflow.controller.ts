import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { WorkflowPermissionGuard } from './workflow-permission.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { CreateWorkflowDto } from '../application/dto/create-workflow.dto';
import { CancelWorkflowDto } from '../application/dto/cancel-workflow.dto';
import { AdvanceWorkflowDto } from '../application/dto/advance-workflow.dto';
import { CreateWorkflowCommand } from '../application/commands/create-workflow.command';
import { ListWorkflowsQuery } from '../application/queries/list-workflows.query';
import { CreateWorkflowHandler } from '../application/handlers/create-workflow.handler';
import { CancelWorkflowHandler } from '../application/handlers/cancel-workflow.handler';
import { GetWorkflowHandler } from '../application/handlers/get-workflow.handler';
import { ListWorkflowsHandler } from '../application/handlers/list-workflows.handler';
import {
  ApproveWorkflowRequestHandler,
  CreateWorkflowAutomationRuleHandler,
  CreateWorkflowTemplateHandler,
  DeleteWorkflowSavedFilterHandler,
  DuplicateWorkflowTemplateHandler,
  ExportWorkflowLogsHandler,
  GetWorkflowOverviewHandler,
  GetWorkflowTaskHandler,
  ListWorkflowApprovalsHandler,
  ListWorkflowAuditHandler,
  ListWorkflowAutomationRulesHandler,
  ListWorkflowExecutionLogsHandler,
  ListWorkflowSavedFiltersHandler,
  ListWorkflowTasksHandler,
  ListWorkflowTemplatesHandler,
  ListWorkflowsPaginatedHandler,
  LogWorkflowAdvanceHandler,
  PublishWorkflowTemplateHandler,
  RejectWorkflowRequestHandler,
  RetryFailedWorkflowHandler,
  SaveWorkflowFilterHandler,
  StartWorkflowFromTemplateHandler,
  UpdateWorkflowTaskHandler,
  UpdateWorkflowTemplateHandler,
} from '../application/handlers/workflow-enterprise.handlers';

type AuthRequest = Request & { user?: { id?: string; userId?: string; roles?: string[] } };

@Controller('workflows')
@UseGuards(WorkflowPermissionGuard)
@RequireLicensedModule('workflow')
@RequireLicensedFeature('workflow')
export class WorkflowController {
  constructor(
    private readonly createWorkflowHandler: CreateWorkflowHandler,
    private readonly cancelWorkflowHandler: CancelWorkflowHandler,
    private readonly getWorkflowHandler: GetWorkflowHandler,
    private readonly listWorkflowsHandler: ListWorkflowsHandler,
    private readonly overviewHandler: GetWorkflowOverviewHandler,
    private readonly paginatedListHandler: ListWorkflowsPaginatedHandler,
    private readonly tasksHandler: ListWorkflowTasksHandler,
    private readonly getTaskHandler: GetWorkflowTaskHandler,
    private readonly updateTaskHandler: UpdateWorkflowTaskHandler,
    private readonly approvalsHandler: ListWorkflowApprovalsHandler,
    private readonly approveHandler: ApproveWorkflowRequestHandler,
    private readonly rejectHandler: RejectWorkflowRequestHandler,
    private readonly templatesHandler: ListWorkflowTemplatesHandler,
    private readonly createTemplateHandler: CreateWorkflowTemplateHandler,
    private readonly updateTemplateHandler: UpdateWorkflowTemplateHandler,
    private readonly publishTemplateHandler: PublishWorkflowTemplateHandler,
    private readonly duplicateTemplateHandler: DuplicateWorkflowTemplateHandler,
    private readonly startFromTemplateHandler: StartWorkflowFromTemplateHandler,
    private readonly automationListHandler: ListWorkflowAutomationRulesHandler,
    private readonly createAutomationHandler: CreateWorkflowAutomationRuleHandler,
    private readonly logsHandler: ListWorkflowExecutionLogsHandler,
    private readonly exportLogsHandler: ExportWorkflowLogsHandler,
    private readonly auditHandler: ListWorkflowAuditHandler,
    private readonly savedFiltersHandler: ListWorkflowSavedFiltersHandler,
    private readonly saveFilterHandler: SaveWorkflowFilterHandler,
    private readonly deleteFilterHandler: DeleteWorkflowSavedFilterHandler,
    private readonly retryHandler: RetryFailedWorkflowHandler,
    private readonly logAdvanceHandler: LogWorkflowAdvanceHandler,
  ) {}

  private actor(req: AuthRequest) {
    const id = req.user?.userId ?? req.user?.id ?? '';
    return { actorId: id, actorRoles: req.user?.roles ?? [] };
  }

  @Get('overview')
  @RequirePermission('api.workflow', 'view')
  async overview(@Query('assigneeId') assigneeId?: string) {
    return this.overviewHandler.execute(assigneeId?.trim() || undefined);
  }

  @Get('tasks')
  @RequirePermission('api.workflow', 'view')
  async tasks(
    @Query('assigneeId') assigneeId?: string,
    @Query('status') status?: string,
    @Query('overdueOnly') overdueOnly?: string,
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.tasksHandler.execute({
      assigneeId: assigneeId?.trim(),
      status: status?.trim(),
      overdueOnly: overdueOnly === 'true',
      branchId: branchId?.trim(),
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor: cursor?.trim(),
    });
  }

  @Patch('tasks/:taskId')
  @RequirePermission('api.workflow', 'update')
  async updateTask(
    @Param('taskId') taskId: string,
    @Body() body: { status?: string; assigneeId?: string; priority?: string; comment?: string },
    @Req() req: AuthRequest,
  ) {
    const { actorId, actorRoles } = this.actor(req);
    return this.updateTaskHandler.execute(taskId, body, actorId, actorRoles);
  }

  @Get('tasks/:taskId')
  @RequirePermission('api.workflow', 'view')
  async getTask(@Param('taskId') taskId: string) {
    return this.getTaskHandler.execute(taskId);
  }

  @Get('approvals')
  @RequirePermission('api.workflow', 'view')
  async approvals(
    @Query('status') status?: string,
    @Query('requestedBy') requestedBy?: string,
    @Query('limit') limit?: string,
  ) {
    return this.approvalsHandler.execute({
      status: status?.trim(),
      requestedBy: requestedBy?.trim(),
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('approvals/:approvalId/approve')
  @RequirePermission('api.workflow', 'approve')
  async approve(
    @Param('approvalId') approvalId: string,
    @Body() body: { comment?: string },
    @Req() req: AuthRequest,
  ) {
    const { actorId, actorRoles } = this.actor(req);
    return this.approveHandler.execute(approvalId, actorId, body.comment, actorRoles);
  }

  @Post('approvals/:approvalId/reject')
  @RequirePermission('api.workflow', 'approve')
  async reject(
    @Param('approvalId') approvalId: string,
    @Body() body: { reason: string },
    @Req() req: AuthRequest,
  ) {
    const { actorId, actorRoles } = this.actor(req);
    return this.rejectHandler.execute(approvalId, actorId, body.reason, actorRoles);
  }

  @Get('templates')
  @RequirePermission('api.workflow', 'view')
  async templates(@Query('search') search?: string, @Query('category') category?: string) {
    return this.templatesHandler.execute(search, category?.trim());
  }

  @Post('templates')
  @RequirePermission('api.workflow', 'manage')
  async createTemplate(@Body() body: Record<string, unknown>, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.createTemplateHandler.execute(body as never, actorId, actorRoles);
  }

  @Patch('templates/:templateId')
  @RequirePermission('api.workflow', 'manage')
  async updateTemplate(
    @Param('templateId') templateId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthRequest,
  ) {
    const { actorId, actorRoles } = this.actor(req);
    return this.updateTemplateHandler.execute(templateId, body as never, actorId, actorRoles);
  }

  @Post('templates/:templateId/publish')
  @RequirePermission('api.workflow', 'manage')
  async publishTemplate(@Param('templateId') templateId: string, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.publishTemplateHandler.execute(templateId, actorId, actorRoles);
  }

  @Post('templates/:templateId/duplicate')
  @RequirePermission('api.workflow', 'manage')
  async duplicateTemplate(@Param('templateId') templateId: string, @Req() req: AuthRequest) {
    const { actorId } = this.actor(req);
    return this.duplicateTemplateHandler.execute(templateId, actorId);
  }

  @Post('templates/:templateId/start')
  @RequirePermission('api.workflow', 'create')
  async startFromTemplate(
    @Param('templateId') templateId: string,
    @Body() body: { branchId?: string },
    @Req() req: AuthRequest,
  ) {
    const { actorId } = this.actor(req);
    return this.startFromTemplateHandler.execute(templateId, actorId, body.branchId ?? null);
  }

  @Get('automation')
  @RequirePermission('api.workflow', 'manage')
  async automationRules() {
    return this.automationListHandler.execute();
  }

  @Post('automation')
  @RequirePermission('api.workflow', 'manage')
  async createAutomation(@Body() body: Record<string, unknown>, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.createAutomationHandler.execute(body as never, actorId, actorRoles);
  }

  @Get('logs/export')
  @RequirePermission('api.workflow', 'export')
  async exportLogs(@Query('workflowId') workflowId: string | undefined, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.exportLogsHandler.execute(actorId, actorRoles, workflowId?.trim());
  }

  @Get('logs')
  @RequirePermission('api.workflow', 'view')
  async logs(@Query('workflowId') workflowId?: string, @Query('limit') limit?: string) {
    return this.logsHandler.execute({
      workflowId: workflowId?.trim(),
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('audit')
  @RequirePermission('api.workflow', 'view')
  async audit(@Query('limit') limit?: string, @Query('resourceId') resourceId?: string) {
    return this.auditHandler.execute({
      limit: limit ? parseInt(limit, 10) : undefined,
      resourceId: resourceId?.trim(),
    });
  }

  @Get('saved-filters')
  @RequirePermission('api.workflow', 'view')
  async savedFilters(@Query('scope') scope: string | undefined, @Req() req: AuthRequest) {
    const { actorId } = this.actor(req);
    return this.savedFiltersHandler.execute(actorId, scope?.trim());
  }

  @Post('saved-filters')
  @RequirePermission('api.workflow', 'view')
  async saveFilter(
    @Body() body: { name: string; filters: Record<string, unknown>; scope?: string },
    @Req() req: AuthRequest,
  ) {
    const { actorId } = this.actor(req);
    return this.saveFilterHandler.execute(actorId, body.name, body.filters, body.scope);
  }

  @Post('saved-filters/:filterId/delete')
  @RequirePermission('api.workflow', 'view')
  async deleteFilter(@Param('filterId') filterId: string, @Req() req: AuthRequest) {
    const { actorId } = this.actor(req);
    return this.deleteFilterHandler.execute(actorId, filterId);
  }

  @Post()
  @RequirePermission('api.workflow', 'create')
  async create(@Body() body: CreateWorkflowDto, @Req() request: AuthRequest) {
    return await this.createWorkflowHandler.execute(
      new CreateWorkflowCommand(
        body.nameEn,
        body.nameAr,
        body.descriptionEn,
        body.descriptionAr,
        body.steps,
        body.branchId ?? null,
        request.user?.id ?? '',
      ),
    );
  }

  @Get()
  @RequirePermission('api.workflow', 'view')
  async list(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('offset') offset?: string,
    @Query('paginated') paginated?: string,
  ) {
    if (paginated === 'true' || cursor || search || assigneeId) {
      return this.paginatedListHandler.execute({
        branchId: branchId?.trim(),
        status: status?.trim(),
        search: search?.trim(),
        assigneeId: assigneeId?.trim(),
        limit: limit ? parseInt(limit, 10) : undefined,
        cursor: cursor?.trim(),
      });
    }
    return await this.listWorkflowsHandler.execute(
      new ListWorkflowsQuery(
        branchId?.trim() || null,
        status?.trim() || null,
        Number.isNaN(Number(limit)) ? 50 : Math.max(Number(limit), 1),
        Number.isNaN(Number(offset)) ? 0 : Math.max(Number(offset), 0),
      ),
    );
  }

  @Get(':workflowId')
  @RequirePermission('api.workflow', 'view')
  async get(@Param('workflowId') workflowId: string) {
    return await this.getWorkflowHandler.execute({ workflowId });
  }

  @Post(':workflowId/retry')
  @RequirePermission('api.workflow', 'manage')
  async retry(@Param('workflowId') workflowId: string, @Req() req: AuthRequest) {
    const { actorId, actorRoles } = this.actor(req);
    return this.retryHandler.execute(workflowId, actorId, actorRoles);
  }

  @Post(':workflowId/advance')
  @RequirePermission('api.workflow', 'update')
  async advance(
    @Param('workflowId') workflowId: string,
    @Body() body: AdvanceWorkflowDto,
    @Req() request: AuthRequest,
  ) {
    return await this.logAdvanceHandler.execute(
      workflowId,
      request.user?.id ?? '',
      body.comment ?? null,
    );
  }

  @Post(':workflowId/cancel')
  @RequirePermission('api.workflow', 'delete')
  async cancel(
    @Param('workflowId') workflowId: string,
    @Body() body: CancelWorkflowDto,
    @Req() request: AuthRequest,
  ) {
    return await this.cancelWorkflowHandler.execute({
      workflowId,
      canceledBy: request.user?.id ?? '',
      reason: body.reason ?? null,
    });
  }
}
