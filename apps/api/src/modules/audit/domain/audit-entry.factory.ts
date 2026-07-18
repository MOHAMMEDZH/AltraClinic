import { AuditEntry } from './audit-entry.entity';
import { ActionVO } from './value-objects/action.vo';
import { ResourceTypeVO } from './value-objects/resource-type.vo';
import { LocalizedTextVO } from './value-objects/localized-text.vo';
import { AuditEntryValidationException } from './exceptions/audit-entry-validation.exception';

export class AuditEntryFactory {
  create(
    id: string,
    tenantId: string,
    branchId: string | null,
    locale: string | null,
    action: string,
    resourceType: string,
    resourceId: string,
    actorId: string,
    actorRoles: string[],
    details: Record<string, string> | null,
    changes: Record<string, { before?: string | null; after?: string | null }> | null,
    category: string | null,
    descriptionEn: string | null,
    descriptionAr: string | null,
    reason: string | null,
    ipAddress: string | null,
    userAgent: string | null,
    correlationId: string | null,
  ): AuditEntry {
    if (!id || !id.trim()) throw new AuditEntryValidationException('Audit entry identifier is required');
    if (!tenantId || !tenantId.trim()) throw new AuditEntryValidationException('Tenant identifier is required');
    if (!action || !action.trim()) throw new AuditEntryValidationException('Audit action is required');
    if (!resourceType || !resourceType.trim()) throw new AuditEntryValidationException('Resource type is required');
    if (!resourceId || !resourceId.trim()) throw new AuditEntryValidationException('Resource identifier is required');
    if (!actorId || !actorId.trim()) throw new AuditEntryValidationException('Actor identifier is required');
    if (!actorRoles || actorRoles.length === 0) throw new AuditEntryValidationException('Actor roles are required');

    const actionVO = new ActionVO(action);
    const resourceTypeVO = new ResourceTypeVO(resourceType);
    const normalizeText = (text: string | null): string | null => text?.trim() ?? null;
    const normalizedDescriptionEn = normalizeText(descriptionEn);
    const normalizedDescriptionAr = normalizeText(descriptionAr);
    const description = normalizedDescriptionEn || normalizedDescriptionAr
      ? new LocalizedTextVO(normalizedDescriptionEn, normalizedDescriptionAr)
      : null;

    return new AuditEntry(
      id,
      tenantId,
      branchId,
      actionVO.value,
      resourceTypeVO.value,
      resourceId,
      actorId,
      actorRoles,
      details,
      changes,
      category,
      description,
      reason,
      ipAddress,
      userAgent,
      correlationId,
      locale,
    );
  }
}
