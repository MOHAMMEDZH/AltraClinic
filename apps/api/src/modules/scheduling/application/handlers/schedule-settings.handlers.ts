import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus as PrismaAppointmentStatus, ClinicalPricingUnit } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { BookingConcurrencyService } from '../services/booking-concurrency.service';
import { BookingCommercialResolver } from '../services/booking-commercial-resolver.service';
import { ProviderEligibilityService } from '../services/provider-eligibility.service';
import { ServiceResourceRequirementService } from '../services/service-resource-requirement.service';
import { AppointmentSnapshotService } from '../services/appointment-snapshot.service';
import { isTenantCanonicalWriteEnabled } from '../../../clinical-catalog/domain/feature-flag.helpers';
import {
  SCHEDULING_AUDIT_LOG,
  SchedulingAuditLog,
} from '../ports/scheduling-audit-log.port';

export interface BranchHoursDayInput {
  dayOfWeek: number;
  openHour: number;
  openMin?: number;
  closeHour: number;
  closeMin?: number;
  isClosed?: boolean;
}

@Injectable()
export class GetBranchHoursHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) { }

  async execute(branchId: string) {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.branchOperatingHours.findMany({
      where: { tenantId: tenant.tenantId, branchId },
      orderBy: { dayOfWeek: 'asc' },
    });

    return {
      branchId,
      items: rows.map((row) => ({
        dayOfWeek: row.dayOfWeek,
        openHour: row.openHour,
        openMin: row.openMin,
        closeHour: row.closeHour,
        closeMin: row.closeMin,
        isClosed: row.isClosed,
      })),
    };
  }
}

@Injectable()
export class UpsertBranchHoursHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) { }

  async execute(branchId: string, days: BranchHoursDayInput[]) {
    if (!branchId?.trim()) throw new BadRequestException('branchId is required');
    if (!Array.isArray(days) || days.length === 0) {
      throw new BadRequestException('days array is required');
    }

    const tenant = await this.tenantContext.resolve();

    for (const day of days) {
      if (day.dayOfWeek < 0 || day.dayOfWeek > 6) {
        throw new BadRequestException('dayOfWeek must be 0–6');
      }
      await this.prisma.branchOperatingHours.upsert({
        where: { branchId_dayOfWeek: { branchId, dayOfWeek: day.dayOfWeek } },
        create: {
          tenantId: tenant.tenantId,
          branchId,
          dayOfWeek: day.dayOfWeek,
          openHour: day.openHour,
          openMin: day.openMin ?? 0,
          closeHour: day.closeHour,
          closeMin: day.closeMin ?? 0,
          isClosed: day.isClosed ?? false,
        },
        update: {
          openHour: day.openHour,
          openMin: day.openMin ?? 0,
          closeHour: day.closeHour,
          closeMin: day.closeMin ?? 0,
          isClosed: day.isClosed ?? false,
          updatedAt: new Date(),
        },
      });
    }

    return { branchId, updated: days.length };
  }
}

export interface ProviderScheduleDayInput {
  dayOfWeek: number;
  startHour: number;
  startMin?: number;
  endHour: number;
  endMin?: number;
  isOff?: boolean;
}

@Injectable()
export class GetProviderScheduleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) { }

  async execute(providerId: string) {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.providerWeeklySchedule.findMany({
      where: { tenantId: tenant.tenantId, providerId },
      orderBy: { dayOfWeek: 'asc' },
    });

    return {
      providerId,
      items: rows.map((row) => ({
        dayOfWeek: row.dayOfWeek,
        startHour: row.startHour,
        startMin: row.startMin,
        endHour: row.endHour,
        endMin: row.endMin,
        isOff: row.isOff,
      })),
    };
  }
}

@Injectable()
export class UpsertProviderScheduleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) { }

  async execute(providerId: string, days: ProviderScheduleDayInput[]) {
    if (!providerId?.trim()) throw new BadRequestException('providerId is required');
    if (!Array.isArray(days) || days.length === 0) {
      throw new BadRequestException('days array is required');
    }

    const tenant = await this.tenantContext.resolve();

    for (const day of days) {
      if (day.dayOfWeek < 0 || day.dayOfWeek > 6) {
        throw new BadRequestException('dayOfWeek must be 0–6');
      }
      await this.prisma.providerWeeklySchedule.upsert({
        where: {
          tenantId_providerId_dayOfWeek: {
            tenantId: tenant.tenantId,
            providerId,
            dayOfWeek: day.dayOfWeek,
          },
        },
        create: {
          tenantId: tenant.tenantId,
          branchId: tenant.branchId,
          providerId,
          dayOfWeek: day.dayOfWeek,
          startHour: day.startHour,
          startMin: day.startMin ?? 0,
          endHour: day.endHour,
          endMin: day.endMin ?? 0,
          isOff: day.isOff ?? false,
        },
        update: {
          startHour: day.startHour,
          startMin: day.startMin ?? 0,
          endHour: day.endHour,
          endMin: day.endMin ?? 0,
          isOff: day.isOff ?? false,
          updatedAt: new Date(),
        },
      });
    }

    return { providerId, updated: days.length };
  }
}

@Injectable()
export class BookWaitlistEntryHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly concurrency: BookingConcurrencyService,
    private readonly commercial: BookingCommercialResolver,
    private readonly eligibility: ProviderEligibilityService,
    private readonly resources: ServiceResourceRequirementService,
    private readonly snapshots: AppointmentSnapshotService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly auditLog: SchedulingAuditLog,
  ) { }

  async execute(
    waitlistId: string,
    input: {
      start: string;
      end: string;
      providerId?: string;
      clinicalServiceId?: string;
      resourceId?: string;
      resourceIds?: string[];
      pricingUnit?: string;
      currency?: string;
      quantity?: number;
      commercialReason?: string;
    },
    authenticatedActorId: string,
  ) {
    if (!authenticatedActorId?.trim()) {
      throw new BadRequestException('authenticatedActorId is required');
    }
    const actorId = authenticatedActorId.trim();
    const tenant = await this.tenantContext.resolve();
    const entry = await this.prisma.appointmentWaitlist.findFirst({
      where: {
        id: waitlistId,
        tenantId: tenant.tenantId,
        status: 'OPEN',
        deletedAt: null,
      },
    });
    if (!entry) throw new NotFoundException('Waitlist entry not found');

    if (!input.start?.trim() || !input.end?.trim()) {
      throw new BadRequestException('start and end are required');
    }

    const providerId = input.providerId ?? entry.providerId;
    if (!providerId) throw new BadRequestException('providerId is required');

    const features = await this.prisma.withPlatformBypass((c) =>
      c.tenant.findUnique({ where: { id: tenant.tenantId }, select: { features: true } }),
    );
    const canonicalWriteOn = isTenantCanonicalWriteEnabled(
      (features?.features as Record<string, unknown> | null) ?? null,
    );
    if (canonicalWriteOn && !input.clinicalServiceId?.trim()) {
      throw new BadRequestException(
        'clinicalServiceId is required when catalog.canonical.write is ON',
      );
    }

    const start = new Date(input.start);
    const end = new Date(input.end);
    const appointmentId = randomUUID();
    const branchId = entry.branchId ?? tenant.branchId ?? null;
    const resourceIds = [
      ...new Set(
        [...(input.resourceIds ?? []), ...(input.resourceId ? [input.resourceId] : [])].filter(
          Boolean,
        ),
      ),
    ] as string[];

    let resolvedCommercial = null as Awaited<
      ReturnType<BookingCommercialResolver['resolveCanonical']>
    > | null;
    if (input.clinicalServiceId?.trim()) {
      await this.eligibility.assertClinicalServiceAccessible(
        tenant.tenantId,
        input.clinicalServiceId.trim(),
      );
      resolvedCommercial = await this.commercial.resolveCanonical({
        tenantId: tenant.tenantId,
        actorId,
        clinicalServiceId: input.clinicalServiceId.trim(),
        branchId,
        pricingUnit: (input.pricingUnit as ClinicalPricingUnit) ?? ClinicalPricingUnit.PER_VISIT,
        currency: input.currency ?? 'SYP',
        quantity: input.quantity ?? 1,
        commercialReason: input.commercialReason ?? null,
      });
    }

    await this.concurrency.withBookingTransaction(async (client) => {
      await this.concurrency.assertSlotAvailableUnderLock(client, {
        tenantId: tenant.tenantId,
        providerId,
        resourceIds,
        start,
        end,
      });

      if (input.clinicalServiceId?.trim()) {
        await this.eligibility.assertEligible({
          tenantId: tenant.tenantId,
          providerUserId: providerId,
          clinicalServiceId: input.clinicalServiceId.trim(),
          branchId,
          at: start,
          client,
        });
        await this.resources.assertRequirementsSatisfied({
          tenantId: tenant.tenantId,
          clinicalServiceId: input.clinicalServiceId.trim(),
          branchId,
          allocatedResourceIds: resourceIds,
          client,
        });
      } else if (resourceIds.length > 0) {
        await this.resources.assertAllocatedResourcesOwned({
          tenantId: tenant.tenantId,
          branchId,
          allocatedResourceIds: resourceIds,
          client,
        });
      }

      await client.appointment.create({
        data: {
          id: appointmentId,
          tenantId: tenant.tenantId,
          branchId,
          patientId: entry.patientId,
          providerId,
          scheduledStart: start,
          scheduledEnd: end,
          status: PrismaAppointmentStatus.PENDING,
          notes: entry.notes,
          clinicalServiceId: input.clinicalServiceId?.trim() || null,
          resourceId: resourceIds[0] ?? null,
          snapshotWriteMode:
            canonicalWriteOn && resolvedCommercial ? 'CANONICAL_REQUIRED' : 'LEGACY',
        },
      });

      await this.concurrency.replaceResourceAllocations(client, {
        tenantId: tenant.tenantId,
        appointmentId,
        resourceIds,
      });

      if (canonicalWriteOn && resolvedCommercial) {
        const revision = await this.snapshots.captureCanonicalRevision1(client, {
          tenantId: tenant.tenantId,
          appointmentId,
          actorId,
          commercial: resolvedCommercial,
        });
        await this.auditLog.recordInTransaction(client, {
          tenantId: tenant.tenantId,
          action: 'scheduling.waitlist.canonical_snapshot',
          resourceId: revision.id,
          actorId,
          actorRoles: [],
          descriptionEn: 'Canonical waitlist booking snapshot revision 1',
          descriptionAr: 'لقطة حجز قائمة الانتظار الكنسي مراجعة 1',
          details: { appointmentId, waitlistId: entry.id },
        });
      }

      await client.appointmentWaitlist.update({
        where: { id: entry.id },
        data: { status: 'SCHEDULED', updatedAt: new Date() },
      });
    });

    return { appointmentId, waitlistId: entry.id };
  }
}
