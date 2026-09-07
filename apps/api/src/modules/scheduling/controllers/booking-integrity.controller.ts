import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClinicalPricingUnit } from '@prisma/client';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { ProviderEligibilityService } from '../application/services/provider-eligibility.service';
import { ServiceResourceRequirementService } from '../application/services/service-resource-requirement.service';
import { AppointmentSnapshotService } from '../application/services/appointment-snapshot.service';
import { BookingCommercialResolver } from '../application/services/booking-commercial-resolver.service';
import { BookingConcurrencyService } from '../application/services/booking-concurrency.service';
import { BOOKING_ELIGIBILITY_ENFORCEMENT_FLAG } from '../domain/booking-feature-flags';
import {
  CommercialCorrectionDTO,
  CreateProviderEligibilityDTO,
  UpsertResourceRequirementDTO,
} from '../application/dto/appointment.dto';
import {
  SCHEDULING_AUDIT_LOG,
  SchedulingAuditLog,
} from '../application/ports/scheduling-audit-log.port';

@Controller('scheduling/booking-integrity')
@UseGuards(TenantScopedAccessGuard)
@RequireLicensedModule('scheduling')
@RequireLicensedFeature('scheduling')
export class BookingIntegrityController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
    private readonly eligibility: ProviderEligibilityService,
    private readonly resources: ServiceResourceRequirementService,
    private readonly snapshots: AppointmentSnapshotService,
    private readonly commercial: BookingCommercialResolver,
    private readonly concurrency: BookingConcurrencyService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly auditLog: SchedulingAuditLog,
  ) {}

  @Get('eligibilities')
  @RequirePermission('api.scheduling', 'view')
  async listEligibilities(@Query('clinicalServiceId') clinicalServiceId?: string) {
    const tenant = await this.tenantContext.resolve();
    const items = await this.eligibility.listEligibilities({
      tenantId: tenant.tenantId,
      clinicalServiceId,
    });
    return { items };
  }

  @Post('eligibilities')
  @RequirePermission('api.scheduling', 'manage')
  async createEligibility(
    @Body() body: CreateProviderEligibilityDTO,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    const tenant = await this.tenantContext.resolve();
    const row = await this.eligibility.createEligibilityRow({
      tenantId: tenant.tenantId,
      providerUserId: body.providerUserId,
      clinicalServiceId: body.clinicalServiceId,
      branchId: body.branchId ?? null,
      active: body.active ?? true,
      effectiveFrom: new Date(body.effectiveFrom),
      effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
      specialtyRequirementRef: body.specialtyRequirementRef ?? null,
      actorId: user.sub,
      actorRoles: [...user.roles],
    });
    return row;
  }

  @Post('eligibilities/:id/deactivate')
  @RequirePermission('api.scheduling', 'manage')
  async deactivateEligibility(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    const tenant = await this.tenantContext.resolve();
    return this.eligibility.deactivateEligibilityRow({
      tenantId: tenant.tenantId,
      eligibilityId: id,
      actorId: user.sub,
      actorRoles: [...user.roles],
    });
  }

  @Get('eligibilities/readiness')
  @RequirePermission('api.scheduling', 'view')
  async readiness(
    @Query('clinicalServiceIds') clinicalServiceIds?: string,
    @Query('providerUserIds') providerUserIds?: string,
    @Query('branchId') branchId?: string,
  ) {
    const tenant = await this.tenantContext.resolve();
    const services = (clinicalServiceIds ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const providers = (providerUserIds ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!services.length || !providers.length) {
      throw new BadRequestException('clinicalServiceIds and providerUserIds are required for preview');
    }
    const report = await this.eligibility.buildCoverageReport({
      tenantId: tenant.tenantId,
      clinicalServiceIds: services,
      providerUserIds: providers,
      branchId: branchId ?? tenant.branchId ?? null,
    });
    return {
      covered: report.filter((r) => r.status === 'covered').length,
      uncovered: report.filter((r) => r.status !== 'covered').length,
      rows: report,
    };
  }

  @Post('eligibilities/enforcement/activate')
  @RequirePermission('api.scheduling', 'manage')
  async activateEnforcement(
    @Body()
    body: {
      clinicalServiceIds?: string[];
      providerUserIds?: string[];
      branchId?: string | null;
    },
    @CurrentUser() user: JwtClaimsVO,
  ) {
    const tenant = await this.tenantContext.resolve();
    if (body?.clinicalServiceIds?.length || body?.providerUserIds?.length) {
      throw new BadRequestException(
        'Activation ignores caller subset lists; omit clinicalServiceIds/providerUserIds and rely on authoritative coverage',
      );
    }
    const report = await this.eligibility.buildAuthoritativeCoverageReport(tenant.tenantId);
    this.eligibility.assertReadinessForEnforcementOn(report);
    const updated = await this.eligibility.activateEnforcement(
      tenant.tenantId,
      { [BOOKING_ELIGIBILITY_ENFORCEMENT_FLAG]: true },
      { actorId: user.sub, actorRoles: [...user.roles] },
    );
    return {
      activated: true,
      flag: BOOKING_ELIGIBILITY_ENFORCEMENT_FLAG,
      features: updated.features,
      coverageCells: report.length,
    };
  }

  @Get('resource-requirements')
  @RequirePermission('api.scheduling', 'view')
  async listResourceRequirements(@Query('clinicalServiceId') clinicalServiceId: string) {
    if (!clinicalServiceId?.trim()) {
      throw new BadRequestException('clinicalServiceId is required');
    }
    const tenant = await this.tenantContext.resolve();
    const items = await this.resources.listRequirements(tenant.tenantId, clinicalServiceId.trim());
    return { items };
  }

  @Put('resource-requirements')
  @RequirePermission('api.scheduling', 'manage')
  async upsertResourceRequirement(
    @Body() body: UpsertResourceRequirementDTO,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    const tenant = await this.tenantContext.resolve();
    const row = await this.resources.upsertRequirement({
      tenantId: tenant.tenantId,
      clinicalServiceId: body.clinicalServiceId,
      resourceType: body.resourceType,
      quantity: body.quantity,
      actorId: user.sub,
      actorRoles: [...user.roles],
    });
    return row;
  }

  @Get('appointments/:id/snapshots')
  @RequirePermission('api.scheduling', 'view')
  async listSnapshots(@Param('id') id: string) {
    const tenant = await this.tenantContext.resolve();
    const appt = await this.prisma.withPlatformBypass((c) =>
      c.appointment.findFirst({
        where: { id, tenantId: tenant.tenantId, deletedAt: null },
        select: { id: true, effectiveSnapshotRevisionId: true },
      }),
    );
    if (!appt) throw new NotFoundException('Appointment not found');
    const items = await this.prisma.withPlatformBypass((c) =>
      c.appointmentServiceSnapshotRevision.findMany({
        where: { tenantId: tenant.tenantId, appointmentId: id },
        orderBy: { revisionNumber: 'asc' },
      }),
    );
    return {
      appointmentId: id,
      effectiveSnapshotRevisionId: appt.effectiveSnapshotRevisionId,
      items,
    };
  }

  @Post('appointments/:id/commercial-correction')
  @RequirePermission('api.scheduling', 'manage')
  async commercialCorrection(
    @Param('id') id: string,
    @Body() body: CommercialCorrectionDTO,
    @CurrentUser() user: JwtClaimsVO,
  ) {
    const tenant = await this.tenantContext.resolve();
    if (!body.changeReason?.trim()) {
      throw new BadRequestException('changeReason is required');
    }
    const actorId = user.sub;
    const row = await this.prisma.withPlatformBypass((c) =>
      c.appointment.findFirst({
        where: { id, tenantId: tenant.tenantId, deletedAt: null },
      }),
    );
    if (!row) throw new NotFoundException('Appointment not found');

    // POST-LOCK only: never-locked appointments must use ordinary pre-confirm update.
    if (
      !this.snapshots.isCommercialLocked({
        status: row.status,
        commercialLockedAt: row.commercialLockedAt,
        effectiveSnapshotRevisionId: row.effectiveSnapshotRevisionId,
      })
    ) {
      throw new ConflictException(
        'Commercial correction requires an already commercially locked appointment',
      );
    }

    const resolved = await this.commercial.resolveCanonical({
      tenantId: tenant.tenantId,
      actorId,
      clinicalServiceId: body.clinicalServiceId,
      branchId: row.branchId,
      pricingUnit: (body.pricingUnit as ClinicalPricingUnit) ?? ClinicalPricingUnit.PER_VISIT,
      currency: body.currency ?? 'SYP',
      quantity: body.quantity ?? 1,
      commercialReason: body.commercialReason ?? null,
    });

    await this.eligibility.assertClinicalServiceAccessible(
      tenant.tenantId,
      body.clinicalServiceId,
    );

    const revision = await this.concurrency.withBookingTransaction(async (client) => {
      await this.eligibility.assertEligible({
        tenantId: tenant.tenantId,
        providerUserId: row.providerId,
        clinicalServiceId: body.clinicalServiceId,
        branchId: row.branchId,
        at: row.scheduledStart,
        client,
      });
      const allocIds = await this.concurrency.listAllocatedResourceIds(client, id);
      const resourceIds = [
        ...new Set([...allocIds, ...(row.resourceId ? [row.resourceId] : [])]),
      ];
      await this.resources.assertRequirementsSatisfied({
        tenantId: tenant.tenantId,
        clinicalServiceId: body.clinicalServiceId,
        branchId: row.branchId,
        allocatedResourceIds: resourceIds,
        client,
      });

      const rev = await this.snapshots.appendResolvedCommercialRevision(client, {
        tenantId: tenant.tenantId,
        appointmentId: id,
        changeReason: body.changeReason.trim(),
        actorId,
        commercial: resolved,
        allowPostConfirmCorrection: true,
        appointmentStatus: row.status,
      });

      // Preserve lock evidence if confirmed-or-beyond but timestamp was missing; never establish lock from PENDING.
      if (!row.commercialLockedAt && this.snapshots.isConfirmedOrBeyond(row.status)) {
        await client.appointment.update({
          where: { id },
          data: { commercialLockedAt: new Date() },
        });
      }

      await this.auditLog.recordInTransaction(client, {
        tenantId: tenant.tenantId,
        action: 'scheduling.commercial_correction',
        resourceId: rev.id,
        actorId,
        actorRoles: [...user.roles],
        descriptionEn: 'Post-confirm commercial correction applied',
        descriptionAr: 'تم تطبيق تصحيح تجاري بعد التأكيد',
        details: {
          appointmentId: id,
          clinicalServiceId: body.clinicalServiceId,
        },
      });

      return rev;
    });

    return {
      appointmentId: id,
      revisionId: revision.id,
      revisionNumber: revision.revisionNumber,
    };
  }
}
