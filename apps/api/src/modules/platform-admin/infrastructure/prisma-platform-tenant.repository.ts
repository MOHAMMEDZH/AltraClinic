import { ConflictException, Injectable } from '@nestjs/common';
import {
  PlatformTenantStatus as PrismaStatus,
  PrivilegedAccessGrantStatus as PrismaGrantStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PlatformTenant } from '../domain/entities/platform-tenant.entity';
import { PrivilegedAccessGrant } from '../domain/entities/privileged-access-grant.entity';
import {
  PlatformTenantFilter,
  PlatformTenantPage,
  PlatformTenantRepository,
} from '../domain/repositories/platform-tenant.repository.interface';
import { PlatformTenantStatusVO } from '../domain/value-objects/platform-tenant-status.vo';
import { PlatformRegionVO } from '../domain/value-objects/platform-region.vo';
import { EntitlementPlanVO } from '../domain/value-objects/entitlement-plan.vo';
import { PrivilegedAccessGrantStatus } from '../domain/value-objects/privileged-access-grant-status';
import { PrivilegedAccessScope } from '../domain/value-objects/privileged-access-scope';
import {
  PLATFORM_AUDIT_SENTINEL_TENANT_ID,
  assertNotPlatformAuditSentinelTenantId,
  isPlatformAuditSentinelTenantId,
} from '../../platform-tenants/platform-tenants.tokens';
import { isTenantLifecycleEnabled } from '../../tenant-lifecycle/config/tenant-lifecycle-flags';

type PrismaPlatformTenantRow = Prisma.PlatformTenantGetPayload<{
  include: { privilegedGrants: true };
}>;

const DOMAIN_STATUS_TO_PRISMA: Record<string, PrismaStatus> = {
  provisioning: 'PROVISIONING',
  active: 'ACTIVE',
  suspended: 'SUSPENDED',
  archived: 'ARCHIVED',
};

const PRISMA_STATUS_TO_DOMAIN: Record<PrismaStatus, string> = {
  PROVISIONING: 'provisioning',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived',
};

const DOMAIN_GRANT_STATUS_TO_PRISMA: Record<PrivilegedAccessGrantStatus, PrismaGrantStatus> = {
  pending_approval: 'PENDING_APPROVAL',
  active: 'ACTIVE',
  rejected: 'REJECTED',
  revoked: 'REVOKED',
};

const PRISMA_GRANT_STATUS_TO_DOMAIN: Record<PrismaGrantStatus, PrivilegedAccessGrantStatus> = {
  PENDING_APPROVAL: 'pending_approval',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  REVOKED: 'revoked',
};

const DOMAIN_PLAN_TO_PRISMA: Record<string, Prisma.PlatformTenantCreateInput['plan']> = {
  starter: 'LITE',
  growth: 'PRO',
  enterprise: 'ENTERPRISE',
  lite: 'LITE',
  pro: 'PRO',
};

const PRISMA_PLAN_TO_DOMAIN: Record<string, string> = {
  LITE: 'starter',
  PRO: 'growth',
  ENTERPRISE: 'enterprise',
};

/** Prisma residency enum ↔ domain PlatformRegion VO (TENANCY data-residency). */
const DOMAIN_REGION_TO_PRISMA: Record<string, Prisma.PlatformTenantCreateInput['region']> = {
  'me-central': 'ME_SOUTH',
  'eu-west': 'EU_WEST',
  'us-east': 'US_EAST',
};

const PRISMA_REGION_TO_DOMAIN: Record<string, string> = {
  ME_SOUTH: 'me-central',
  ME_NORTH: 'me-central',
  EU_WEST: 'eu-west',
  US_EAST: 'us-east',
  GLOBAL: 'me-central',
};

/**
 * COMPETING ARCHITECT NOTE:
 *  Challenger: "Upsert-and-deleteMany for PrivilegedAccessGrants is dangerous —
 *  it discards audit history of old grants."
 *  Decision: Grants are append-only. We NEVER delete them. We upsert by grantId,
 *  which will UPDATE existing grants (status transitions) but never remove them.
 *  The DB trigger on audit_entries prevents removal of audit logs; grants themselves
 *  have no delete path in the domain entity.
 */
@Injectable()
export class PrismaPlatformTenantRepository implements PlatformTenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(platformTenant: PlatformTenant): Promise<void> {
    assertNotPlatformAuditSentinelTenantId(
      platformTenant.tenantId,
      'PrismaPlatformTenantRepository.save',
    );
    // Use toPrimitives() to access lifecycle timestamps not exposed as getters
    const p = platformTenant.toPrimitives();
    const prismaRegion =
      DOMAIN_REGION_TO_PRISMA[platformTenant.region.value] ??
      (platformTenant.region.value.toUpperCase().replace(/-/g, '_') as Prisma.PlatformTenantCreateInput['region']);
    const prismaPlan =
      DOMAIN_PLAN_TO_PRISMA[platformTenant.plan.value] ??
      (platformTenant.plan.value.toUpperCase() as unknown as Prisma.PlatformTenantCreateInput['plan']);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.platformTenant.findUnique({
        where: { id: platformTenant.id },
        select: { rowVersion: true },
      });

      const lifecycleOwnsStatus = isTenantLifecycleEnabled();
      const lifecycleFields = lifecycleOwnsStatus
        ? {}
        : {
            status: DOMAIN_STATUS_TO_PRISMA[platformTenant.status.value] as PrismaStatus,
            activatedAt: p.activatedAt ? new Date(p.activatedAt) : null,
            suspendedAt: p.suspendedAt ? new Date(p.suspendedAt) : null,
            suspensionReason: platformTenant.suspensionReason,
            archivedAt: p.archivedAt ? new Date(p.archivedAt) : null,
            archivedReason: p.archivedReason,
          };

      if (!existing) {
        await tx.platformTenant.create({
          data: {
            id: platformTenant.id,
            tenantId: platformTenant.tenantId,
            displayName: platformTenant.displayName,
            region: prismaRegion,
            plan: prismaPlan,
            status: DOMAIN_STATUS_TO_PRISMA[platformTenant.status.value] as PrismaStatus,
            provisionedBy: platformTenant.provisionedBy,
            activatedAt: p.activatedAt ? new Date(p.activatedAt) : null,
            suspendedAt: p.suspendedAt ? new Date(p.suspendedAt) : null,
            suspensionReason: platformTenant.suspensionReason,
            archivedAt: p.archivedAt ? new Date(p.archivedAt) : null,
            archivedReason: p.archivedReason,
            createdAt: platformTenant.createdAt,
            rowVersion: 1,
          },
        });
      } else {
        // Model A CAS + Model B ownership: metadata always; lifecycle fields only when Step 19 OFF.
        const cas = await tx.platformTenant.updateMany({
          where: { id: platformTenant.id, rowVersion: existing.rowVersion },
          data: {
            displayName: platformTenant.displayName,
            region: prismaRegion,
            plan: prismaPlan,
            ...lifecycleFields,
            updatedAt: platformTenant.updatedAt,
            rowVersion: { increment: 1 },
          },
        });
        if (cas.count !== 1) {
          throw new ConflictException({
            code: 'stale_row_version',
            message: 'PlatformTenant rowVersion conflict during legacy save.',
          });
        }
      }

      for (const grant of platformTenant.privilegedGrants) {
        const p = grant.toPrimitives();
        await tx.privilegedAccessGrant.upsert({
          where: { id: grant.grantId },
          create: {
            id: grant.grantId,
            platformTenantId: platformTenant.id,
            adminId: grant.adminId,
            adminName: grant.adminName,
            scopes: grant.scopes,
            justification: grant.justification,
            breakGlass: grant.breakGlass,
            status: DOMAIN_GRANT_STATUS_TO_PRISMA[grant.status],
            requestedAt: new Date(p.requestedAt),
            expiresAt: new Date(p.expiresAt),
            approvedBy: p.approvedBy,
            approvedAt: p.approvedAt ? new Date(p.approvedAt) : null,
            rejectedBy: p.rejectedBy,
            rejectedReason: p.rejectedReason,
            rejectedAt: p.rejectedAt ? new Date(p.rejectedAt) : null,
            revokedReason: p.revokedReason,
            revokedAt: p.revokedAt ? new Date(p.revokedAt) : null,
          },
          update: {
            status: DOMAIN_GRANT_STATUS_TO_PRISMA[grant.status],
            approvedBy: p.approvedBy,
            approvedAt: p.approvedAt ? new Date(p.approvedAt) : null,
            rejectedBy: p.rejectedBy,
            rejectedReason: p.rejectedReason,
            rejectedAt: p.rejectedAt ? new Date(p.rejectedAt) : null,
            revokedReason: p.revokedReason,
            revokedAt: p.revokedAt ? new Date(p.revokedAt) : null,
          },
        });
      }
    });
  }

  async findById(platformTenantId: string): Promise<PlatformTenant | null> {
    if (!platformTenantId?.trim() || isPlatformAuditSentinelTenantId(platformTenantId)) {
      return null;
    }
    const row = await this.prisma.platformTenant.findUnique({
      where: { id: platformTenantId },
      include: { privilegedGrants: true },
    });
    if (!row || isPlatformAuditSentinelTenantId(row.tenantId)) {
      return null;
    }
    return this.toDomain(row);
  }

  async findByTenantId(tenantId: string): Promise<PlatformTenant | null> {
    if (!tenantId?.trim() || isPlatformAuditSentinelTenantId(tenantId)) {
      return null;
    }
    const row = await this.prisma.platformTenant.findFirst({
      where: { tenantId },
      include: { privilegedGrants: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(filter: PlatformTenantFilter): Promise<PlatformTenantPage> {
    const search = filter.search?.trim().toLowerCase();

    const where: Prisma.PlatformTenantWhereInput = {
      tenantId: { not: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
      ...(filter.status ? { status: DOMAIN_STATUS_TO_PRISMA[filter.status as string] as PrismaStatus } : {}),
      ...(filter.region ? { region: (filter.region as string).toUpperCase().replace(/-/g, '_') as unknown as Prisma.PlatformTenantWhereInput['region'] } : {}),
      ...(filter.plan ? { plan: (filter.plan as string).toUpperCase() as unknown as Prisma.PlatformTenantWhereInput['plan'] } : {}),
      // UUID fields don't support `contains`; search only over displayName
      ...(search
        ? {
            OR: [{ displayName: { contains: search, mode: 'insensitive' as const } }],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.platformTenant.findMany({
        where,
        include: { privilegedGrants: true },
        orderBy: { createdAt: 'desc' },
        skip: filter.offset,
        take: filter.limit,
      }),
      this.prisma.platformTenant.count({ where }),
    ]);

    return {
      items: items.map((r) => this.toDomain(r)),
      total,
      limit: filter.limit,
      offset: filter.offset,
    };
  }

  private toDomain(row: PrismaPlatformTenantRow): PlatformTenant {
    const grants = row.privilegedGrants.map((g) =>
      PrivilegedAccessGrant.restore({
        grantId: g.id,
        adminId: g.adminId,
        adminName: g.adminName,
        scopes: g.scopes as PrivilegedAccessScope[],
        justification: g.justification,
        breakGlass: g.breakGlass,
        status: PRISMA_GRANT_STATUS_TO_DOMAIN[g.status],
        requestedAt: g.requestedAt,
        expiresAt: g.expiresAt,
        approvedBy: g.approvedBy,
        approvedAt: g.approvedAt,
        rejectedBy: g.rejectedBy,
        rejectedReason: g.rejectedReason,
        rejectedAt: g.rejectedAt,
        revokedReason: g.revokedReason,
        revokedAt: g.revokedAt,
      }),
    );

    const regionKey = String(row.region);
    const domainRegion = PRISMA_REGION_TO_DOMAIN[regionKey] ?? 'me-central';

    return PlatformTenant.restore({
      platformTenantId: row.id,
      tenantId: row.tenantId,
      displayName: row.displayName,
      region: new PlatformRegionVO(domainRegion),
      plan: new EntitlementPlanVO(PRISMA_PLAN_TO_DOMAIN[row.plan] ?? row.plan),
      status: new PlatformTenantStatusVO(PRISMA_STATUS_TO_DOMAIN[row.status]),
      privilegedGrants: grants,
      provisionedBy: row.provisionedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      activatedAt: row.activatedAt,
      suspendedAt: row.suspendedAt,
      suspensionReason: row.suspensionReason,
      archivedAt: row.archivedAt,
      archivedReason: row.archivedReason,
    });
  }
}
