import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CommissionCalculationBasis,
  CommissionEarningTrigger,
  Prisma,
  StaffCommissionPlanStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import {
  assertReadableClinicalService,
  assertTenantBranch,
  assertTenantUser,
  assertUuid,
} from '../../dental/services/wave-d-reference.validation';
import { WAVE_F_AUDIT_LOG, WaveFAuditLog } from '../ports/wave-f-audit-log.port';

export type WaveFActor = {
  actorId: string;
  actorRoles: string[];
};

function canSelfEdit(roles: string[]): boolean {
  const normalized = (roles ?? []).map((r) => String(r).trim().toLowerCase());
  return normalized.includes('owner') || normalized.includes('super_admin');
}

function assertNotSelfEdit(actor: WaveFActor, targetUserId: string) {
  if (actor.actorId === targetUserId && !canSelfEdit(actor.actorRoles)) {
    throw new ForbiddenException(
      'Self-edit of staff commission is denied unless actor has owner or super_admin role',
    );
  }
}

function assertPercentage(value: Prisma.Decimal.Value, field: string): Prisma.Decimal {
  const d = new Prisma.Decimal(value);
  if (d.lt(0) || d.gt(100)) {
    throw new BadRequestException(`${field} must be between 0 and 100`);
  }
  return d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function parseDateOnly(value: string | Date, field: string): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const s = String(value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) {
    throw new BadRequestException(`${field} must be an ISO date (YYYY-MM-DD)`);
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new BadRequestException(`${field} must be a valid calendar date`);
  }
  return dt;
}

function dateOnlyUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function todayUtc(): Date {
  return dateOnlyUtc(new Date());
}

/** Round 1 allowed basis↔trigger pairs (fail-closed). */
export function assertBasisTriggerCombo(
  basis: CommissionCalculationBasis,
  trigger: CommissionEarningTrigger,
): void {
  const invoiceBases: CommissionCalculationBasis[] = [
    CommissionCalculationBasis.SERVICE_NET_AFTER_DISCOUNT,
    CommissionCalculationBasis.SERVICE_GROSS,
    CommissionCalculationBasis.SERVICE_NET_EXCLUDING_TAX,
  ];
  if (
    invoiceBases.includes(basis) &&
    trigger === CommissionEarningTrigger.INVOICE_OR_CHARGE_FINALIZED
  ) {
    return;
  }
  if (
    basis === CommissionCalculationBasis.COLLECTED_REVENUE &&
    trigger === CommissionEarningTrigger.PAYMENT_COLLECTED
  ) {
    return;
  }
  throw new BadRequestException(
    `Invalid calculationBasis/earningTrigger combo: ${basis} + ${trigger}`,
  );
}

function assertUserDefaultScopeOnly(branchId: string | null, clinicalServiceId: string | null) {
  if (branchId != null || clinicalServiceId != null) {
    throw new BadRequestException(
      'Round 1 staff commission plans are user-default only; branchId and clinicalServiceId must be null',
    );
  }
}

@Injectable()
export class StaffCommissionPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(WAVE_F_AUDIT_LOG) private readonly audit: WaveFAuditLog,
  ) {}

  async setUserCommissionEligibility(
    userId: string,
    enabled: boolean,
    defaultPercent: number | null | undefined,
    effectiveFrom: string | Date | null | undefined,
    actor: WaveFActor,
  ) {
    const tenantId = await this.requireTenant();
    if (!actor.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');
    const targetUserId = assertUuid(userId, 'userId');
    assertNotSelfEdit(actor, targetUserId);

    let percent: Prisma.Decimal | null = null;
    if (defaultPercent != null) {
      percent = assertPercentage(defaultPercent, 'defaultCommissionPercent');
    }
    const effective =
      effectiveFrom != null && effectiveFrom !== ''
        ? parseDateOnly(effectiveFrom, 'commissionEffectiveFrom')
        : null;

    return this.prisma.withPlatformBypass(async (tx) => {
      await assertTenantUser(tx, tenantId, targetUserId);
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: {
          commissionEnabled: Boolean(enabled),
          defaultCommissionPercent: percent,
          commissionEffectiveFrom: effective,
        },
        select: {
          id: true,
          commissionEnabled: true,
          defaultCommissionPercent: true,
          commissionEffectiveFrom: true,
        },
      });

      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId: actor.actorId,
        actorRoles: actor.actorRoles,
        action: enabled
          ? 'staff_commission.eligibility.enabled'
          : 'staff_commission.eligibility.disabled',
        resourceId: targetUserId,
        descriptionEn: enabled
          ? 'Staff commission eligibility enabled'
          : 'Staff commission eligibility disabled',
        details: {
          defaultCommissionPercent: percent?.toString() ?? null,
          commissionEffectiveFrom: effective?.toISOString().slice(0, 10) ?? null,
        },
      });

      return updated;
    });
  }

  async createDraftPlan(input: {
    userId: string;
    percentage: number | string;
    calculationBasis?: CommissionCalculationBasis | string;
    earningTrigger?: CommissionEarningTrigger | string;
    effectiveFrom: string | Date;
    branchId?: string | null;
    clinicalServiceId?: string | null;
    actor: WaveFActor;
  }) {
    const tenantId = await this.requireTenant();
    if (!input.actor.actorId?.trim()) {
      throw new BadRequestException('Authenticated actor is required');
    }
    const userId = assertUuid(input.userId, 'userId');
    assertNotSelfEdit(input.actor, userId);
    const percentage = assertPercentage(input.percentage, 'percentage');
    const effectiveFrom = parseDateOnly(input.effectiveFrom, 'effectiveFrom');
    const calculationBasis = this.parseBasis(
      input.calculationBasis ?? CommissionCalculationBasis.SERVICE_NET_AFTER_DISCOUNT,
    );
    const earningTrigger = this.parseTrigger(
      input.earningTrigger ?? CommissionEarningTrigger.INVOICE_OR_CHARGE_FINALIZED,
    );
    assertBasisTriggerCombo(calculationBasis, earningTrigger);

    const branchId = input.branchId ? assertUuid(input.branchId, 'branchId') : null;
    const clinicalServiceId = input.clinicalServiceId
      ? assertUuid(input.clinicalServiceId, 'clinicalServiceId')
      : null;
    assertUserDefaultScopeOnly(branchId, clinicalServiceId);

    return this.prisma.withPlatformBypass(async (tx) => {
      await assertTenantUser(tx, tenantId, userId);
      if (branchId) await assertTenantBranch(tx, tenantId, branchId);
      if (clinicalServiceId) {
        await assertReadableClinicalService(tx, tenantId, clinicalServiceId);
      }

      const id = randomUUID();
      const plan = await tx.staffCommissionPlanVersion.create({
        data: {
          id,
          tenantId,
          userId,
          branchId,
          clinicalServiceId,
          enabled: true,
          percentage,
          calculationBasis,
          earningTrigger,
          effectiveFrom,
          status: StaffCommissionPlanStatus.DRAFT,
          createdBy: input.actor.actorId,
        },
      });

      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId: input.actor.actorId,
        actorRoles: input.actor.actorRoles,
        action: 'staff_commission.plan.draft_created',
        resourceId: id,
        descriptionEn: 'Staff commission plan draft created',
        details: {
          userId,
          percentage: percentage.toString(),
          calculationBasis,
          earningTrigger,
          effectiveFrom: effectiveFrom.toISOString().slice(0, 10),
        },
      });

      return plan;
    });
  }

  async publishPlan(planId: string, actor: WaveFActor) {
    const tenantId = await this.requireTenant();
    if (!actor.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');
    const id = assertUuid(planId, 'planId');

    return this.prisma.withPlatformBypass(async (tx) => {
      const plan = await tx.staffCommissionPlanVersion.findFirst({
        where: { id, tenantId },
      });
      if (!plan) throw new NotFoundException('Commission plan not found');
      assertNotSelfEdit(actor, plan.userId);
      if (plan.status !== StaffCommissionPlanStatus.DRAFT) {
        throw new BadRequestException(`Only DRAFT plans can be published (was ${plan.status})`);
      }

      assertBasisTriggerCombo(plan.calculationBasis, plan.earningTrigger);
      assertUserDefaultScopeOnly(plan.branchId, plan.clinicalServiceId);

      // Serialize publish per tenant+user scope (Round 1/2).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:${plan.userId}`}))`;

      // Post-lock re-read (F5).
      const lockedPlan = await tx.staffCommissionPlanVersion.findFirst({
        where: { id, tenantId },
      });
      if (!lockedPlan) throw new NotFoundException('Commission plan not found');
      if (lockedPlan.status !== StaffCommissionPlanStatus.DRAFT) {
        throw new BadRequestException(
          `Only DRAFT plans can be published after lock (was ${lockedPlan.status})`,
        );
      }
      assertBasisTriggerCombo(lockedPlan.calculationBasis, lockedPlan.earningTrigger);
      assertUserDefaultScopeOnly(lockedPlan.branchId, lockedPlan.clinicalServiceId);

      const now = new Date();
      const planFrom = dateOnlyUtc(lockedPlan.effectiveFrom);

      // Round 3 — always close overlapping ACTIVE timelines (including future-dated).
      // Fail-closed on ambiguous same/overlapping starts. Never rely on publishedAt tie-break.
      const priorActive = await tx.staffCommissionPlanVersion.findMany({
        where: {
          tenantId,
          userId: lockedPlan.userId,
          status: StaffCommissionPlanStatus.ACTIVE,
          branchId: lockedPlan.branchId,
          clinicalServiceId: lockedPlan.clinicalServiceId,
          NOT: { id: lockedPlan.id },
        },
        orderBy: [{ effectiveFrom: 'asc' }, { publishedAt: 'asc' }],
      });

      let supersededCount = 0;
      for (const prior of priorActive) {
        const priorFrom = dateOnlyUtc(prior.effectiveFrom);
        const priorTo =
          prior.effectiveTo == null ? null : dateOnlyUtc(prior.effectiveTo);

        // Ambiguous: prior starts on/after new plan start (same day or later overlapping).
        if (priorFrom.getTime() >= planFrom.getTime()) {
          throw new BadRequestException(
            'Overlapping future/active commission plan publish rejected (fail-closed); supersede or choose non-overlapping effectiveFrom',
          );
        }

        // Intervals overlap if prior open-ended or priorTo >= planFrom.
        const overlaps =
          priorTo == null || priorTo.getTime() >= planFrom.getTime();
        if (!overlaps) {
          continue;
        }

        const closeTo = new Date(planFrom.getTime() - 24 * 60 * 60 * 1000);
        const nextEffectiveTo =
          closeTo.getTime() >= priorFrom.getTime() ? closeTo : priorFrom;

        await tx.staffCommissionPlanVersion.update({
          where: { id: prior.id },
          data: {
            status: StaffCommissionPlanStatus.SUPERSEDED,
            supersededAt: now,
            effectiveTo: nextEffectiveTo,
          },
        });
        supersededCount += 1;
      }

      // Post-lock reread of ACTIVE peers after closes (serialized timeline proof).
      const remainingActive = await tx.staffCommissionPlanVersion.findMany({
        where: {
          tenantId,
          userId: lockedPlan.userId,
          status: StaffCommissionPlanStatus.ACTIVE,
          branchId: lockedPlan.branchId,
          clinicalServiceId: lockedPlan.clinicalServiceId,
          NOT: { id: lockedPlan.id },
        },
      });
      for (const peer of remainingActive) {
        const peerFrom = dateOnlyUtc(peer.effectiveFrom);
        const peerTo = peer.effectiveTo == null ? null : dateOnlyUtc(peer.effectiveTo);
        const overlaps =
          peerFrom.getTime() <= planFrom.getTime() &&
          (peerTo == null || peerTo.getTime() >= planFrom.getTime());
        if (overlaps || peerFrom.getTime() === planFrom.getTime()) {
          throw new BadRequestException(
            'Post-lock reread detected overlapping ACTIVE commission plan timeline',
          );
        }
      }

      const published = await tx.staffCommissionPlanVersion.update({
        where: { id: lockedPlan.id },
        data: {
          status: StaffCommissionPlanStatus.ACTIVE,
          publishedAt: now,
          publishedBy: actor.actorId,
        },
      });

      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId: actor.actorId,
        actorRoles: actor.actorRoles,
        action: 'staff_commission.plan.published',
        resourceId: lockedPlan.id,
        descriptionEn: 'Staff commission plan published',
        details: {
          userId: lockedPlan.userId,
          percentage: lockedPlan.percentage.toString(),
          supersededCount,
          futureDated: planFrom.getTime() > todayUtc().getTime(),
          postLockReread: true,
          nonOverlappingTimeline: true,
        },
      });

      return published;
    });
  }

  async getPlan(planId: string) {
    const tenantId = await this.requireTenant();
    const id = assertUuid(planId, 'planId');
    const plan = await this.prisma.withPlatformBypass((tx) =>
      tx.staffCommissionPlanVersion.findFirst({ where: { id, tenantId } }),
    );
    if (!plan) throw new NotFoundException('Commission plan not found');
    return plan;
  }

  async listPlans(filters?: { userId?: string; status?: StaffCommissionPlanStatus | string }) {
    const tenantId = await this.requireTenant();
    const where: Prisma.StaffCommissionPlanVersionWhereInput = { tenantId };
    if (filters?.userId) {
      where.userId = assertUuid(filters.userId, 'userId');
    }
    if (filters?.status) {
      const status = String(filters.status).trim().toUpperCase();
      if (!Object.values(StaffCommissionPlanStatus).includes(status as StaffCommissionPlanStatus)) {
        throw new BadRequestException(`Invalid plan status: ${filters.status}`);
      }
      where.status = status as StaffCommissionPlanStatus;
    }
    return this.prisma.withPlatformBypass((tx) =>
      tx.staffCommissionPlanVersion.findMany({
        where,
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      }),
    );
  }

  /**
   * Round 2 F5 — resolve plan version effective at eventDate.
   * ACTIVE and SUPERSEDED versions may resolve historically via effective interval.
   * DRAFT never resolves. Status alone is never sufficient.
   */
  async resolveActivePlan(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    atDate: Date,
  ) {
    return this.resolvePlanAt(tx, tenantId, userId, atDate);
  }

  async resolvePlanAt(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    atDate: Date,
  ) {
    const day = dateOnlyUtc(atDate);
    const plan = await tx.staffCommissionPlanVersion.findFirst({
      where: {
        tenantId,
        userId,
        enabled: true,
        branchId: null,
        clinicalServiceId: null,
        status: {
          in: [StaffCommissionPlanStatus.ACTIVE, StaffCommissionPlanStatus.SUPERSEDED],
        },
        effectiveFrom: { lte: day },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { publishedAt: 'desc' }],
    });
    if (!plan) {
      throw new BadRequestException(
        `No commission plan covering ${day.toISOString().slice(0, 10)} for user (historical ACTIVE/SUPERSEDED interval)`,
      );
    }
    return plan;
  }

  private parseBasis(value: string): CommissionCalculationBasis {
    const v = String(value).trim().toUpperCase();
    if (!Object.values(CommissionCalculationBasis).includes(v as CommissionCalculationBasis)) {
      throw new BadRequestException(`Invalid calculationBasis: ${value}`);
    }
    return v as CommissionCalculationBasis;
  }

  private parseTrigger(value: string): CommissionEarningTrigger {
    const v = String(value).trim().toUpperCase();
    if (!Object.values(CommissionEarningTrigger).includes(v as CommissionEarningTrigger)) {
      throw new BadRequestException(`Invalid earningTrigger: ${value}`);
    }
    return v as CommissionEarningTrigger;
  }

  private async requireTenant(): Promise<string> {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    return tenantId;
  }
}
