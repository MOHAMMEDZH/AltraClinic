import { Inject, Injectable } from '@nestjs/common';
import { SearchAuditLogsQuery } from '../queries/search-audit-logs.query';
import { AuditEntryRepository } from '../../domain/audit-entry.repository.interface';
import { AUDIT_ENTRY_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { AuditEntryDTO } from '../dto/audit-entry.dto';

@Injectable()
export class SearchAuditLogsHandler {
  constructor(
    @Inject(AUDIT_ENTRY_REPOSITORY) private readonly repository: AuditEntryRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: SearchAuditLogsQuery): Promise<AuditEntryDTO[]> {
    const tenant = await this.tenantContext.resolve();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const results = await this.repository.search({
      tenantId: tenant.tenantId,
      action: query.action,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      actorId: query.actorId,
      limit,
      offset,
    });

    return results.map((entry) => ({
      id: entry.id,
      tenantId: entry.tenantId,
      branchId: entry.branchId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      actorId: entry.actorId,
      actorRoles: entry.actorRoles,
      category: entry.category,
      description: entry.getDescription(entry.locale),
      details: entry.details,
      changes: entry.changes,
      reason: entry.reason,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      correlationId: entry.correlationId,
      locale: entry.locale,
      createdAt: entry.createdAt,
    }));
  }
}
