import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';
import { SalesAuditLog } from './sales-audit.log';
import {
  SalesRepConflictError,
  SalesRepForbiddenError,
  SalesRepNotFoundError,
  SalesRepValidationError,
} from '../domain/sales-representative.errors';
import type { SalesCustomerOwnershipDto } from '../domain/sales-representative.types';
import {
  SALES_AUDIT_ACTIONS,
  SALES_OWNERSHIP_AUDIT_RESOURCE_TYPE,
  SALES_REP_PERMISSIONS,
  isSalesFailureInjectionActive,
} from '../platform-sales-representatives.constants';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toDto(row: {
  id: string;
  representativeId: string;
  platformTenantId: string;
  rowVersion: number;
  assignedAt: Date;
  assignedById: string;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SalesCustomerOwnershipDto {
  return {
    id: row.id,
    representativeId: row.representativeId,
    platformTenantId: row.platformTenantId,
    rowVersion: row.rowVersion,
    assignedAt: row.assignedAt.toISOString(),
    assignedById: row.assignedById,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Flexible Step 23 — commercial customer ownership (contract §8).
 * Ownership is commercial-relationship metadata only: it never grants Clinic
 * auth, tenant membership, PHI, entitlement/subscription mutation, or
 * provisioning/lifecycle authority. At most one current owner per tenant.
 */
@Injectable()
export class SalesCustomerOwnershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: SalesAuditLog,
  ) {}

  assertPermission(perms: ReadonlySet<string>, key: string): void {
    if (!perms.has(key)) throw new SalesRepForbiddenError(`Missing ${key}`);
  }

  async getByTenant(platformTenantId: string): Promise<SalesCustomerOwnershipDto | null> {
    if (!UUID_RE.test(platformTenantId)) {
      throw new SalesRepValidationError('platformTenantId must be a valid UUID.');
    }
    const row = await this.prisma.platformSalesCustomerOwnership.findUnique({ where: { platformTenantId } });
    return row ? toDto(row) : null;
  }

  private async assertRepresentativeExists(representativeId: string): Promise<void> {
    const rep = await this.prisma.platformSalesRepresentative.findUnique({ where: { id: representativeId } });
    if (!rep) throw new SalesRepNotFoundError('Representative not found.');
  }

  private async assertTenantExists(platformTenantId: string): Promise<void> {
    if (isSalesFailureInjectionActive('ownership_tenant_lookup')) {
      throw new SalesRepNotFoundError('Customer not found.');
    }
    const tenant = await this.prisma.platformTenant.findUnique({ where: { id: platformTenantId } });
    if (!tenant) throw new SalesRepNotFoundError('Customer not found.');
  }

  // ── Assign (A14) ─────────────────────────────────────────────────────────
  async assign(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    input: { representativeId: string; platformTenantId: string; reason?: string },
  ): Promise<SalesCustomerOwnershipDto> {
    this.assertPermission(perms, SALES_REP_PERMISSIONS.manage);
    await this.assertRepresentativeExists(input.representativeId);
    await this.assertTenantExists(input.platformTenantId);

    if (isSalesFailureInjectionActive('ownership_assignment')) {
      throw new SalesRepConflictError('Injected ownership assignment failure');
    }

    const id = randomUUID();
    try {
      await this.prisma.withPlatformBypass(async (client) => {
        const created = await client.platformSalesCustomerOwnership.create({
          data: {
            id,
            representativeId: input.representativeId,
            platformTenantId: input.platformTenantId,
            assignedById: claims.sub,
            reason: input.reason ?? null,
          },
        });
        await client.platformSalesCustomerOwnershipHistory.create({
          data: {
            ownershipId: created.id,
            representativeId: input.representativeId,
            platformTenantId: input.platformTenantId,
            action: 'assigned',
            actorPlatformUserId: claims.sub,
            reason: input.reason ?? null,
          },
        });
        const correlationId = resolveOperationCorrelationId();
        await this.audit.recordInTransaction(client, {
          action: SALES_AUDIT_ACTIONS.A14_OWNERSHIP_ASSIGNED,
          resourceType: SALES_OWNERSHIP_AUDIT_RESOURCE_TYPE,
          resourceId: created.id,
          actorId: claims.sub,
          actorRoles: ['platform'],
          reason: input.reason,
          correlationId,
          result: 'success',
          descriptionEn: 'Sales customer ownership assigned',
          descriptionAr: 'تم تعيين ملكية عميل المبيعات',
          details: { representativeId: input.representativeId, platformTenantId: input.platformTenantId },
        });
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new SalesRepConflictError('Customer already has an active ownership assignment.');
      }
      throw err;
    }
    return this.getByTenant(input.platformTenantId) as Promise<SalesCustomerOwnershipDto>;
  }

  // ── Reassign (A15) ───────────────────────────────────────────────────────
  async reassign(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    platformTenantId: string,
    input: { representativeId: string; expectedRowVersion: number; reason?: string },
  ): Promise<SalesCustomerOwnershipDto> {
    this.assertPermission(perms, SALES_REP_PERMISSIONS.manage);
    await this.assertRepresentativeExists(input.representativeId);
    const current = await this.prisma.platformSalesCustomerOwnership.findUnique({ where: { platformTenantId } });
    if (!current) throw new SalesRepNotFoundError('No existing ownership for this customer.');
    if (current.rowVersion !== input.expectedRowVersion) {
      throw new SalesRepConflictError('Ownership was modified by another request.');
    }

    await this.prisma.withPlatformBypass(async (client) => {
      const updated = await client.platformSalesCustomerOwnership.updateMany({
        where: { platformTenantId, rowVersion: input.expectedRowVersion },
        data: {
          representativeId: input.representativeId,
          assignedById: claims.sub,
          assignedAt: new Date(),
          reason: input.reason ?? null,
          rowVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new SalesRepConflictError('Ownership was modified by another request.');
      await client.platformSalesCustomerOwnershipHistory.create({
        data: {
          ownershipId: current.id,
          representativeId: input.representativeId,
          platformTenantId,
          action: 'reassigned',
          actorPlatformUserId: claims.sub,
          reason: input.reason ?? null,
        },
      });
      const correlationId = resolveOperationCorrelationId();
      await this.audit.recordInTransaction(client, {
        action: SALES_AUDIT_ACTIONS.A15_OWNERSHIP_REASSIGNED,
        resourceType: SALES_OWNERSHIP_AUDIT_RESOURCE_TYPE,
        resourceId: current.id,
        actorId: claims.sub,
        actorRoles: ['platform'],
        reason: input.reason,
        correlationId,
        result: 'success',
        descriptionEn: 'Sales customer ownership reassigned',
        descriptionAr: 'أعيد تعيين ملكية عميل المبيعات',
        details: { fromRepresentativeId: current.representativeId, toRepresentativeId: input.representativeId },
      });
    });
    return this.getByTenant(platformTenantId) as Promise<SalesCustomerOwnershipDto>;
  }

  // ── Remove (A16) ─────────────────────────────────────────────────────────
  async remove(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    platformTenantId: string,
    input: { expectedRowVersion: number; reason?: string },
  ): Promise<{ ok: true }> {
    this.assertPermission(perms, SALES_REP_PERMISSIONS.manage);
    const current = await this.prisma.platformSalesCustomerOwnership.findUnique({ where: { platformTenantId } });
    if (!current) throw new SalesRepNotFoundError('No existing ownership for this customer.');
    if (current.rowVersion !== input.expectedRowVersion) {
      throw new SalesRepConflictError('Ownership was modified by another request.');
    }

    await this.prisma.withPlatformBypass(async (client) => {
      const deleted = await client.platformSalesCustomerOwnership.deleteMany({
        where: { platformTenantId, rowVersion: input.expectedRowVersion },
      });
      if (deleted.count !== 1) throw new SalesRepConflictError('Ownership was modified by another request.');
      await client.platformSalesCustomerOwnershipHistory.create({
        data: {
          ownershipId: null,
          representativeId: current.representativeId,
          platformTenantId,
          action: 'removed',
          actorPlatformUserId: claims.sub,
          reason: input.reason ?? null,
        },
      });
      const correlationId = resolveOperationCorrelationId();
      await this.audit.recordInTransaction(client, {
        action: SALES_AUDIT_ACTIONS.A16_OWNERSHIP_REMOVED,
        resourceType: SALES_OWNERSHIP_AUDIT_RESOURCE_TYPE,
        resourceId: current.id,
        actorId: claims.sub,
        actorRoles: ['platform'],
        reason: input.reason,
        correlationId,
        result: 'success',
        descriptionEn: 'Sales customer ownership removed',
        descriptionAr: 'تمت إزالة ملكية عميل المبيعات',
        details: { representativeId: current.representativeId },
      });
    });
    return { ok: true };
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}
