import { Inject, Injectable } from '@nestjs/common';
import { AuditEntryRepository } from '../../domain/audit-entry.repository.interface';
import { AUDIT_ENTRY_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { GetAuditEntryQuery } from '../queries/get-audit-entry.query';
import { AuditEntryDTO } from '../dto/audit-entry.dto';

@Injectable()
export class GetAuditEntryHandler {
  constructor(
    @Inject(AUDIT_ENTRY_REPOSITORY) private readonly repository: AuditEntryRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: GetAuditEntryQuery): Promise<AuditEntryDTO | null> {
    const tenant = await this.tenantContext.resolve();
    const entry = await this.repository.findById(query.id, tenant.tenantId);
    if (!entry) return null;

    return {
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
    };
  }
}
