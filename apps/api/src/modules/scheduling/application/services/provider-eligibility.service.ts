import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { isBookingEligibilityEnforcementEnabled } from '../../domain/booking-feature-flags';
import {
  SCHEDULING_AUDIT_LOG,
  SchedulingAuditLog,
} from '../ports/scheduling-audit-log.port';
import { Inject } from '@nestjs/common';

/** Same provider roles as ListProvidersHandler. */
export const SCHEDULING_PROVIDER_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.DOCTOR,
  UserRole.DENTIST,
  UserRole.SPECIALIST,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
];

export type EligibilityCoverageRow = {
  clinicalServiceId: string;
  providerUserId: string;
  branchId: string | null;
  status: 'covered' | 'uncovered' | 'expired' | 'inactive' | 'future' | 'branch_mismatch';
};

@Injectable()
export class ProviderEligibilityService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly auditLog: SchedulingAuditLog,
  ) {}

  async isEnforcementEnabled(tenantId: string): Promise<boolean> {
    const tenant = await this.prisma.withPlatformBypass((c) =>
      c.tenant.findUnique({ where: { id: tenantId }, select: { features: true } }),
    );
    return isBookingEligibilityEnforcementEnabled(
      (tenant?.features as Record<string, unknown> | null) ?? null,
    );
  }

  /**
   * Fail-closed when enforcement ON.
   * Tenant-level row (branchId null) covers all branches.
   * Branch-specific row requires exact branch match.
   */
  async assertEligible(params: {
    tenantId: string;
    providerUserId: string;
    clinicalServiceId: string;
    branchId: string | null;
    at?: Date;
    client?: Prisma.TransactionClient;
  }): Promise<void> {
    const enabled = params.client
      ? await this.isEnforcementEnabledWithClient(params.client, params.tenantId)
      : await this.isEnforcementEnabled(params.tenantId);
    if (!enabled) return;
    const ok = await this.hasActiveEligibility(params);
    if (!ok) {
      throw new ForbiddenException('Provider is not eligible for this clinical service');
    }
  }

  private async isEnforcementEnabledWithClient(
    client: Prisma.TransactionClient,
    tenantId: string,
  ): Promise<boolean> {
    const tenant = await client.tenant.findUnique({
      where: { id: tenantId },
      select: { features: true },
    });
    return isBookingEligibilityEnforcementEnabled(
      (tenant?.features as Record<string, unknown> | null) ?? null,
    );
  }

  async hasActiveEligibility(params: {
    tenantId: string;
    providerUserId: string;
    clinicalServiceId: string;
    branchId: string | null;
    at?: Date;
    client?: Prisma.TransactionClient;
  }): Promise<boolean> {
    const at = params.at ?? new Date();
    const run = async (c: Prisma.TransactionClient) => {
      const rows = await c.providerServiceEligibility.findMany({
        where: {
          tenantId: params.tenantId,
          providerUserId: params.providerUserId,
          clinicalServiceId: params.clinicalServiceId,
          active: true,
          OR: [{ branchId: null }, ...(params.branchId ? [{ branchId: params.branchId }] : [])],
        },
      });
      return rows.some((row) => {
        if (row.effectiveFrom.getTime() > at.getTime()) return false;
        if (row.effectiveTo && row.effectiveTo.getTime() <= at.getTime()) return false;
        if (row.branchId != null && row.branchId !== params.branchId) return false;
        return true;
      });
    };
    if (params.client) return run(params.client);
    return this.prisma.withPlatformBypass((c) => run(c));
  }

  /** SYSTEM_CANONICAL shared OK; TENANT_CUSTOM must belong to requesting tenant. */
  async assertClinicalServiceAccessible(
    tenantId: string,
    clinicalServiceId: string,
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    const run = async (c: Prisma.TransactionClient) => {
      const service = await c.canonicalClinicalServiceDefinition.findFirst({
        where: { id: clinicalServiceId },
        select: { id: true, provenance: true, tenantId: true },
      });
      if (!service) {
        throw new NotFoundException('Clinical service not found');
      }
      if (service.provenance === 'TENANT_CUSTOM' && service.tenantId !== tenantId) {
        throw new ForbiddenException('TENANT_CUSTOM clinical service does not belong to this tenant');
      }
    };
    if (client) return run(client);
    return this.prisma.withPlatformBypass((c) => run(c));
  }

  /**
   * Provider/user must belong to the same tenant.
   * Independent of booking.eligibility.enforcement.
   */
  async assertProviderBelongsToTenant(
    tenantId: string,
    providerUserId: string,
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    const run = async (c: Prisma.TransactionClient) => {
      const user = await c.user.findFirst({
        where: { id: providerUserId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!user) {
        throw new NotFoundException('Provider user not found in tenant');
      }
    };
    if (client) return run(client);
    return this.prisma.withPlatformBypass((c) => run(c));
  }

  async filterEligibleProviderIds(params: {
    tenantId: string;
    clinicalServiceId: string;
    branchId: string | null;
    providerIds: string[];
    at?: Date;
  }): Promise<string[]> {
    if (!(await this.isEnforcementEnabled(params.tenantId))) return params.providerIds;
    const out: string[] = [];
    for (const providerUserId of params.providerIds) {
      if (
        await this.hasActiveEligibility({
          tenantId: params.tenantId,
          providerUserId,
          clinicalServiceId: params.clinicalServiceId,
          branchId: params.branchId,
          at: params.at,
        })
      ) {
        out.push(providerUserId);
      }
    }
    return out;
  }

  async buildCoverageReport(params: {
    tenantId: string;
    clinicalServiceIds: string[];
    providerUserIds: string[];
    branchId: string | null;
    at?: Date;
  }): Promise<EligibilityCoverageRow[]> {
    const at = params.at ?? new Date();
    const rows: EligibilityCoverageRow[] = [];
    for (const clinicalServiceId of params.clinicalServiceIds) {
      for (const providerUserId of params.providerUserIds) {
        const matches = await this.prisma.withPlatformBypass((c) =>
          c.providerServiceEligibility.findMany({
            where: {
              tenantId: params.tenantId,
              clinicalServiceId,
              providerUserId,
            },
          }),
        );
        if (matches.length === 0) {
          rows.push({
            clinicalServiceId,
            providerUserId,
            branchId: params.branchId,
            status: 'uncovered',
          });
          continue;
        }
        const activeNow = matches.find((m) => {
          if (!m.active) return false;
          if (m.effectiveFrom.getTime() > at.getTime()) return false;
          if (m.effectiveTo && m.effectiveTo.getTime() <= at.getTime()) return false;
          if (m.branchId != null && params.branchId != null && m.branchId !== params.branchId) {
            return false;
          }
          return true;
        });
        if (activeNow) {
          rows.push({
            clinicalServiceId,
            providerUserId,
            branchId: params.branchId,
            status: 'covered',
          });
          continue;
        }
        if (matches.every((m) => !m.active)) {
          rows.push({
            clinicalServiceId,
            providerUserId,
            branchId: params.branchId,
            status: 'inactive',
          });
        } else if (matches.every((m) => m.effectiveFrom.getTime() > at.getTime())) {
          rows.push({
            clinicalServiceId,
            providerUserId,
            branchId: params.branchId,
            status: 'future',
          });
        } else if (
          matches.every((m) => m.effectiveTo && m.effectiveTo.getTime() <= at.getTime())
        ) {
          rows.push({
            clinicalServiceId,
            providerUserId,
            branchId: params.branchId,
            status: 'expired',
          });
        } else {
          rows.push({
            clinicalServiceId,
            providerUserId,
            branchId: params.branchId,
            status: 'branch_mismatch',
          });
        }
      }
    }
    return rows;
  }

  /**
   * Authoritative activation population from DB (enabled TenantServiceConfiguration × provider-role users).
   * Caller-supplied subset lists must NOT be used for activation.
   */
  async buildAuthoritativeCoverageReport(tenantId: string): Promise<EligibilityCoverageRow[]> {
    const [configs, providers, branches] = await this.prisma.withPlatformBypass(async (c) => {
      const enabledConfigs = await c.tenantServiceConfiguration.findMany({
        where: { tenantId, enabled: true },
        select: { clinicalServiceId: true },
      });
      const providerUsers = await c.user.findMany({
        where: {
          tenantId,
          deletedAt: null,
          isActive: true,
          roles: { some: { role: { in: SCHEDULING_PROVIDER_ROLES } } },
        },
        select: { id: true },
      });
      const branchRows = await c.branch.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true },
      });
      return [enabledConfigs, providerUsers, branchRows] as const;
    });

    const clinicalServiceIds = [...new Set(configs.map((c) => c.clinicalServiceId))];
    const providerUserIds = providers.map((p) => p.id);
    if (clinicalServiceIds.length === 0 || providerUserIds.length === 0) {
      return [];
    }

    // Tenant-level cell (branchId null) plus each branch scope.
    const reports: EligibilityCoverageRow[] = [];
    reports.push(
      ...(await this.buildCoverageReport({
        tenantId,
        clinicalServiceIds,
        providerUserIds,
        branchId: null,
      })),
    );
    for (const branch of branches) {
      reports.push(
        ...(await this.buildCoverageReport({
          tenantId,
          clinicalServiceIds,
          providerUserIds,
          branchId: branch.id,
        })),
      );
    }
    return reports;
  }

  /** Activation ON blocked if any required coverage cell is uncovered or population is empty. */
  assertReadinessForEnforcementOn(report: EligibilityCoverageRow[]): void {
    if (report.length === 0) {
      throw new ForbiddenException(
        'booking.eligibility.enforcement cannot be activated: authoritative provider/service population is empty',
      );
    }
    const uncovered = report.filter((r) => r.status !== 'covered');
    if (uncovered.length > 0) {
      throw new ForbiddenException(
        `booking.eligibility.enforcement cannot be activated: ${uncovered.length} uncovered provider×service scopes`,
      );
    }
  }

  async createEligibility(
    data: Prisma.ProviderServiceEligibilityCreateInput,
  ) {
    return this.prisma.withPlatformBypass((c) => c.providerServiceEligibility.create({ data }));
  }

  async listEligibilities(params: {
    tenantId: string;
    clinicalServiceId?: string;
    providerUserId?: string;
  }) {
    return this.prisma.withPlatformBypass((c) =>
      c.providerServiceEligibility.findMany({
        where: {
          tenantId: params.tenantId,
          ...(params.clinicalServiceId ? { clinicalServiceId: params.clinicalServiceId } : {}),
          ...(params.providerUserId ? { providerUserId: params.providerUserId } : {}),
        },
        orderBy: [{ clinicalServiceId: 'asc' }, { providerUserId: 'asc' }],
      }),
    );
  }

  async createEligibilityRow(params: {
    tenantId: string;
    providerUserId: string;
    clinicalServiceId: string;
    branchId?: string | null;
    active?: boolean;
    effectiveFrom: Date;
    effectiveTo?: Date | null;
    specialtyRequirementRef?: string | null;
    actorId: string;
    actorRoles?: string[];
  }) {
    return this.prisma.withPlatformBypass(async (c) => {
      const user = await c.user.findFirst({
        where: { id: params.providerUserId, tenantId: params.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!user) {
        throw new NotFoundException('Provider user not found in tenant');
      }
      if (params.branchId) {
        const branch = await c.branch.findFirst({
          where: { id: params.branchId, tenantId: params.tenantId, deletedAt: null },
          select: { id: true },
        });
        if (!branch) {
          throw new BadRequestException('Branch does not belong to tenant');
        }
      }
      await this.assertClinicalServiceAccessible(params.tenantId, params.clinicalServiceId, c);

      const row = await c.providerServiceEligibility.create({
        data: {
          id: randomUUID(),
          tenantId: params.tenantId,
          providerUserId: params.providerUserId,
          clinicalServiceId: params.clinicalServiceId,
          branchId: params.branchId ?? null,
          active: params.active ?? true,
          effectiveFrom: params.effectiveFrom,
          effectiveTo: params.effectiveTo ?? null,
          specialtyRequirementRef: params.specialtyRequirementRef ?? null,
        },
      });

      await this.auditLog.recordInTransaction(c, {
        tenantId: params.tenantId,
        action: 'scheduling.eligibility.create',
        resourceId: row.id,
        actorId: params.actorId,
        actorRoles: params.actorRoles ?? [],
        descriptionEn: 'Provider service eligibility created',
        descriptionAr: 'تم إنشاء أهلية مقدم الخدمة',
        details: {
          providerUserId: params.providerUserId,
          clinicalServiceId: params.clinicalServiceId,
          branchId: params.branchId ?? null,
        },
      });

      return row;
    });
  }

  async deactivateEligibilityRow(params: {
    tenantId: string;
    eligibilityId: string;
    actorId: string;
    actorRoles?: string[];
  }) {
    return this.prisma.withPlatformBypass(async (c) => {
      const existing = await c.providerServiceEligibility.findFirst({
        where: { id: params.eligibilityId, tenantId: params.tenantId },
      });
      if (!existing) {
        throw new NotFoundException('Eligibility not found');
      }
      const row = await c.providerServiceEligibility.update({
        where: { id: existing.id },
        data: {
          active: false,
          inactivatedAt: new Date(),
        },
      });
      await this.auditLog.recordInTransaction(c, {
        tenantId: params.tenantId,
        action: 'scheduling.eligibility.deactivate',
        resourceId: row.id,
        actorId: params.actorId,
        actorRoles: params.actorRoles ?? [],
        descriptionEn: 'Provider service eligibility deactivated',
        descriptionAr: 'تم إلغاء أهلية مقدم الخدمة',
        details: {
          providerUserId: row.providerUserId,
          clinicalServiceId: row.clinicalServiceId,
        },
      });
      return row;
    });
  }

  async activateEnforcement(
    tenantId: string,
    featuresPatch: Record<string, unknown>,
    actor: { actorId: string; actorRoles?: string[] },
  ) {
    return this.prisma.withPlatformBypass(async (c) => {
      const tenant = await c.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { features: true },
      });
      const prev =
        tenant.features && typeof tenant.features === 'object' && !Array.isArray(tenant.features)
          ? (tenant.features as Record<string, unknown>)
          : {};
      const features = { ...prev, ...featuresPatch } as Prisma.InputJsonValue;
      const updated = await c.tenant.update({
        where: { id: tenantId },
        data: { features },
        select: { id: true, features: true },
      });
      await this.auditLog.recordInTransaction(c, {
        tenantId,
        action: 'scheduling.eligibility.enforcement.activate',
        resourceId: tenantId,
        actorId: actor.actorId,
        actorRoles: actor.actorRoles ?? [],
        descriptionEn: 'Booking eligibility enforcement activated',
        descriptionAr: 'تم تفعيل إنفاذ أهلية الحجز',
        details: { flag: Object.keys(featuresPatch).join(',') },
      });
      return updated;
    });
  }
}
