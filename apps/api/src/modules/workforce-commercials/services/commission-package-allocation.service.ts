import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClinicalPricingUnit,
  ClinicalPriceVersionStatus,
  CourseSessionStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { assertUuid } from '../../dental/services/wave-d-reference.validation';
import { WAVE_F_AUDIT_LOG, WaveFAuditLog } from '../ports/wave-f-audit-log.port';
import { WaveFActor } from './staff-commission-plan.service';
import { roundMoney } from './money-rounding';

const PACKAGE_PRICING_UNITS = new Set<ClinicalPricingUnit>([
  ClinicalPricingUnit.PER_COURSE,
  ClinicalPricingUnit.PER_PACKAGE,
]);

/**
 * Wave F Round 4/5 — explicit package/course session revenue allocation.
 * Round 5: package basis + currency are server-derived from TreatmentCourse.packagePriceVersionId;
 * cumulative cap is serialized with pg_advisory_xact_lock.
 */
@Injectable()
export class CommissionPackageAllocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(WAVE_F_AUDIT_LOG) private readonly audit: WaveFAuditLog,
  ) {}

  async registerSessionAllocation(input: {
    treatmentCourseId: string;
    courseSessionId: string;
    servicePerformanceId: string;
    allocatedRevenueAmount: string | number;
    /** Optional client hint — must match server-derived basis if provided. */
    packageCommercialBasisAmount?: string | number | null;
    /** Optional client hint — must match server-derived currency if provided. */
    currency?: string | null;
    invoiceLineId?: string | null;
    reason?: string | null;
    actor: WaveFActor;
    idempotencyKey: string;
  }) {
    const tenantId = await this.requireTenant();
    if (!input.actor?.actorId?.trim()) {
      throw new BadRequestException('Authenticated actor is required');
    }
    const treatmentCourseId = assertUuid(input.treatmentCourseId, 'treatmentCourseId');
    const courseSessionId = assertUuid(input.courseSessionId, 'courseSessionId');
    const servicePerformanceId = assertUuid(input.servicePerformanceId, 'servicePerformanceId');
    const allocated = roundMoney(new Prisma.Decimal(input.allocatedRevenueAmount));
    if (allocated.lte(0)) {
      throw new BadRequestException('allocatedRevenueAmount must be > 0');
    }
    const idempotencyKey = String(input.idempotencyKey ?? '').trim();
    if (!idempotencyKey) {
      throw new BadRequestException('idempotencyKey is required');
    }

    return this.prisma.withPlatformBypass(async (tx) => {
      const existing = await tx.commissionPackageSessionAllocation.findFirst({
        where: { tenantId, idempotencyKey },
      });
      if (existing) return { allocation: existing, idempotent: true as const };

      // R5-PKG-2 — serialize by course scope BEFORE cumulative sum.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:pkg-alloc:${treatmentCourseId}`}))`;

      const course = await tx.treatmentCourse.findFirst({
        where: { id: treatmentCourseId, tenantId, deletedAt: null },
      });
      if (!course) throw new NotFoundException('Treatment course not found');
      if (!course.packagePriceVersionId) {
        throw new BadRequestException(
          'TreatmentCourse.packagePriceVersionId is required for package commission allocation',
        );
      }

      const priceVersion = await tx.clinicalServicePriceVersion.findFirst({
        where: { id: course.packagePriceVersionId, tenantId },
      });
      if (!priceVersion) {
        throw new BadRequestException(
          'TreatmentCourse.packagePriceVersionId does not resolve to a tenant price version',
        );
      }
      if (priceVersion.clinicalServiceId !== course.clinicalServiceId) {
        throw new BadRequestException(
          'packagePriceVersionId clinicalServiceId must match TreatmentCourse.clinicalServiceId',
        );
      }
      // R6-PKG-HISTORICAL-PRICE — exact bound published version remains usable after SUPERSEDED.
      // DRAFT / SCHEDULED / INACTIVE fail closed. Do not reprice to current ACTIVE.
      const allowedStatuses = new Set<ClinicalPriceVersionStatus>([
        ClinicalPriceVersionStatus.ACTIVE,
        ClinicalPriceVersionStatus.SUPERSEDED,
      ]);
      if (!allowedStatuses.has(priceVersion.status)) {
        throw new BadRequestException(
          `package price version status ${priceVersion.status} is not usable for bound course allocation (ACTIVE|SUPERSEDED required; DRAFT rejected)`,
        );
      }
      if (!PACKAGE_PRICING_UNITS.has(priceVersion.pricingUnit)) {
        throw new BadRequestException(
          `pricingUnit must be PER_COURSE or PER_PACKAGE for package allocation (was ${priceVersion.pricingUnit})`,
        );
      }

      const packageBasis = roundMoney(new Prisma.Decimal(priceVersion.unitPrice));
      const currency = String(priceVersion.currency ?? '').trim().toUpperCase();
      if (packageBasis.lte(0)) {
        throw new BadRequestException('Authoritative package unitPrice must be > 0');
      }
      if (currency.length !== 3) {
        throw new BadRequestException('Authoritative package currency must be ISO 4217');
      }

      // Optional client hints — anti-tamper equality only (not authority).
      if (
        input.packageCommercialBasisAmount != null &&
        String(input.packageCommercialBasisAmount).trim() !== ''
      ) {
        const hinted = roundMoney(new Prisma.Decimal(input.packageCommercialBasisAmount));
        if (!hinted.eq(packageBasis)) {
          throw new BadRequestException(
            'packageCommercialBasisAmount does not match authoritative packagePriceVersion unitPrice',
          );
        }
      }
      if (input.currency != null && String(input.currency).trim() !== '') {
        if (String(input.currency).trim().toUpperCase() !== currency) {
          throw new BadRequestException(
            'currency does not match authoritative packagePriceVersion currency',
          );
        }
      }

      if (allocated.gt(packageBasis)) {
        throw new BadRequestException(
          'allocatedRevenueAmount cannot exceed authoritative package commercial basis',
        );
      }

      const session = await tx.courseSession.findFirst({
        where: { id: courseSessionId, courseId: treatmentCourseId, tenantId },
      });
      if (!session) throw new NotFoundException('Course session not found for course');
      if (session.status !== CourseSessionStatus.COMPLETED) {
        throw new BadRequestException(
          `Course session must be COMPLETED to allocate package revenue (was ${session.status})`,
        );
      }

      const performance = await tx.servicePerformance.findFirst({
        where: { id: servicePerformanceId, tenantId, deletedAt: null },
      });
      if (!performance) throw new NotFoundException('Service performance not found');

      // R6-PKG-PROVENANCE — patient / session appointment fail-closed chain.
      if (!performance.patientId || performance.patientId !== course.patientId) {
        throw new BadRequestException(
          'ServicePerformance patientId must match TreatmentCourse.patientId for package allocation',
        );
      }
      if (session.appointmentId) {
        if (!performance.appointmentId) {
          throw new BadRequestException(
            'ServicePerformance appointmentId is required when CourseSession has appointmentId',
          );
        }
        if (session.appointmentId !== performance.appointmentId) {
          throw new BadRequestException(
            'ServicePerformance appointmentId must match course session appointmentId',
          );
        }
        const appt = await tx.appointment.findFirst({
          where: { id: session.appointmentId, tenantId },
          select: { patientId: true, clinicalServiceId: true },
        });
        if (!appt) {
          throw new BadRequestException('Course session appointment not found for tenant');
        }
        if (appt.patientId !== course.patientId) {
          throw new BadRequestException(
            'Course session appointment patient must match TreatmentCourse.patientId',
          );
        }
      }
      if (performance.clinicalServiceId !== course.clinicalServiceId) {
        throw new BadRequestException(
          'ServicePerformance clinicalServiceId must match TreatmentCourse.clinicalServiceId',
        );
      }

      if (input.invoiceLineId) {
        const invoiceLineId = assertUuid(input.invoiceLineId, 'invoiceLineId');
        const line = await tx.invoiceLineItem.findFirst({
          where: { id: invoiceLineId, tenantId },
          include: {
            invoice: { select: { tenantId: true, patientId: true, currency: true, branchId: true } },
          },
        });
        if (!line || line.invoice.tenantId !== tenantId) {
          throw new BadRequestException('invoiceLineId not found for tenant');
        }
        if (line.invoice.patientId !== course.patientId) {
          throw new BadRequestException(
            'invoiceLineId invoice patient must match TreatmentCourse.patientId',
          );
        }
        // R6-PKG-PROVENANCE — invoiceLineId is not a UUID hint; must prove same performance.
        if (!line.servicePerformanceId || line.servicePerformanceId !== servicePerformanceId) {
          throw new BadRequestException(
            'invoiceLineId servicePerformanceId must match allocation servicePerformanceId',
          );
        }
        if (!line.courseSessionId || line.courseSessionId !== courseSessionId) {
          throw new BadRequestException(
            'invoiceLineId courseSessionId must match allocation courseSessionId',
          );
        }
        if (line.appointmentId && session.appointmentId && line.appointmentId !== session.appointmentId) {
          throw new BadRequestException(
            'invoiceLineId appointmentId must match course session appointmentId',
          );
        }
        if (line.clinicalServiceId && line.clinicalServiceId !== course.clinicalServiceId) {
          throw new BadRequestException(
            'invoiceLineId clinicalServiceId must match TreatmentCourse.clinicalServiceId',
          );
        }
        const invCurrency = String(line.invoice.currency ?? '').trim().toUpperCase();
        if (invCurrency !== currency) {
          throw new BadRequestException(
            'invoiceLineId invoice currency must match authoritative package allocation currency',
          );
        }
      }

      // Post-lock reread of cumulative allocations.
      const prior = await tx.commissionPackageSessionAllocation.findMany({
        where: { tenantId, treatmentCourseId },
        select: { allocatedRevenueAmount: true, packageCommercialBasisAmount: true },
      });
      const priorSum = prior.reduce(
        (acc, row) => acc.add(row.allocatedRevenueAmount),
        new Prisma.Decimal(0),
      );
      if (prior.length > 0) {
        const priorBasis = new Prisma.Decimal(prior[0]!.packageCommercialBasisAmount);
        if (!priorBasis.eq(packageBasis)) {
          throw new BadRequestException(
            'Authoritative package basis changed relative to prior course allocations',
          );
        }
      }
      if (priorSum.add(allocated).gt(packageBasis)) {
        throw new BadRequestException(
          'Cumulative session allocations would exceed package commercial basis',
        );
      }

      const allocation = await tx.commissionPackageSessionAllocation.create({
        data: {
          id: randomUUID(),
          tenantId,
          treatmentCourseId,
          courseSessionId,
          servicePerformanceId,
          invoiceLineId: input.invoiceLineId ? assertUuid(input.invoiceLineId, 'invoiceLineId') : null,
          allocatedRevenueAmount: allocated,
          packageCommercialBasisAmount: packageBasis,
          currency,
          idempotencyKey,
          reason: input.reason?.trim() || null,
          createdBy: input.actor.actorId,
        },
      });

      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId: input.actor.actorId,
        actorRoles: input.actor.actorRoles,
        action: 'staff_commission.package_allocation.registered',
        resourceId: allocation.id,
        descriptionEn: 'Explicit package/course session revenue allocation registered',
        details: {
          treatmentCourseId,
          courseSessionId,
          servicePerformanceId,
          packagePriceVersionId: course.packagePriceVersionId,
          pricingUnit: priceVersion.pricingUnit,
          allocatedRevenueAmount: allocated.toString(),
          packageCommercialBasisAmount: packageBasis.toString(),
          currency,
        },
      });

      return { allocation, idempotent: false as const };
    });
  }

  private async requireTenant(): Promise<string> {
    const tenant = await this.tenantContext.resolve();
    if (!tenant.tenantId) throw new BadRequestException('tenant context could not be resolved');
    return tenant.tenantId;
  }
}
