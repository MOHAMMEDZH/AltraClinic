import { Body, Controller, Get, Param, Post, Query, NotFoundException, UseGuards } from '@nestjs/common';
import { AuditPermissionGuard } from '../api/audit-permission.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { CreateAuditEntryDTO } from '../application/dto/create-audit-entry.dto';
import { SearchAuditLogsDTO } from '../application/dto/search-audit-logs.dto';
import { CreateAuditEntryHandler } from '../application/handlers/create-audit-entry.handler';
import { GetAuditEntryHandler } from '../application/handlers/get-audit-entry.handler';
import { SearchAuditLogsHandler } from '../application/handlers/search-audit-logs.handler';

@Controller('audit/entries')
@UseGuards(AuditPermissionGuard)
export class AuditController {
  constructor(
    private readonly createHandler: CreateAuditEntryHandler,
    private readonly getHandler: GetAuditEntryHandler,
    private readonly searchHandler: SearchAuditLogsHandler,
  ) {}

  @Post()
  @RequirePermission('api.audit', 'create')
  async create(@Body() body: CreateAuditEntryDTO) {
    const result = await this.createHandler.execute({
      action: body.action,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      actorId: body.actorId,
      actorRoles: body.actorRoles,
      details: body.details ?? null,
      changes: body.changes ?? null,
      category: body.category ?? null,
      descriptionEn: body.descriptionEn ?? body.description ?? null,
      descriptionAr: body.descriptionAr ?? null,
      reason: body.reason ?? null,
      ipAddress: body.ipAddress ?? null,
      userAgent: body.userAgent ?? null,
      correlationId: body.correlationId ?? null,
    });
    return { id: result.auditEntryId };
  }

  @Get(':id')
  @RequireLicensedFeature('auditLogs')
  @RequirePermission('api.audit', 'view')
  async get(@Param('id') id: string) {
    const result = await this.getHandler.execute({ id });
    if (!result) throw new NotFoundException('Audit entry not found');
    return result;
  }

  @Get()
  @RequireLicensedFeature('auditLogs')
  @RequirePermission('api.audit', 'view')
  async search(@Query() query: SearchAuditLogsDTO) {
    return await this.searchHandler.execute(query);
  }
}
