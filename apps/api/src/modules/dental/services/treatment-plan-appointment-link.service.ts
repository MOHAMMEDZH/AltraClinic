import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { isTenantCanonicalWriteEnabled } from '../../clinical-catalog/domain/feature-flag.helpers';
import { WAVE_D_AUDIT_LOG, WaveDAuditLog } from '../ports/wave-d-audit-log.port';
import {
  PLAN_LINK_ROLES,
  assertReadableClinicalService,
  assertTenantAppointment,
  assertTenantPlanItem,
  assertUuid,
} from './wave-d-reference.validation';

const APPOINTMENT_COMPLETED_STATUS = 'COMPLETED';

@Injectable()
export class TreatmentPlanAppointmentLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(WAVE_D_AUDIT_LOG) private readonly audit: WaveDAuditLog,
  ) {}

  async link(input: {
    planId: string;
    planItemId: string;
    appointmentId: string;
    linkRole?: string;
    sortOrder?: number;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!input.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');
    const planItemId = assertUuid(input.planItemId, 'planItemId');
    const appointmentId = assertUuid(input.appointmentId, 'appointmentId');
    const planId = assertUuid(input.planId, 'planId');
    const linkRole = (input.linkRole ?? 'PRIMARY').toUpperCase();
    if (!PLAN_LINK_ROLES.includes(linkRole as (typeof PLAN_LINK_ROLES)[number])) {
      throw new BadRequestException('linkRole must be PRIMARY or SUPPORTING');
    }

    return this.prisma.withPlatformBypass(async (tx) => {
        const item = await assertTenantPlanItem(tx, tenantId, planItemId);
        if (item.phase.planId !== planId) {
          throw new NotFoundException('Treatment plan item not found');
        }
        const appt = await assertTenantAppointment(tx, tenantId, appointmentId);
        if (appt.patientId !== item.phase.plan.patientId) {
          throw new BadRequestException('Appointment patient does not match plan patient');
        }

        const tenantRow = await tx.tenant.findFirst({
          where: { id: tenantId },
          select: { features: true },
        });
        const canonicalWriteOn = isTenantCanonicalWriteEnabled(
          (tenantRow?.features as Record<string, unknown>) ?? {},
        );
        if (canonicalWriteOn) {
          const serviceId = item.clinicalServiceId ?? appt.clinicalServiceId;
          if (!serviceId) {
            throw new BadRequestException(
              'canonical write ON requires clinicalServiceId on the plan item or appointment',
            );
          }
          await assertReadableClinicalService(tx, tenantId, serviceId);
        }

        try {
          const row = await tx.treatmentPlanItemAppointment.create({
            data: {
              id: randomUUID(),
              tenantId,
              planItemId,
              appointmentId,
              linkRole: linkRole as 'PRIMARY' | 'SUPPORTING',
              sortOrder: input.sortOrder ?? 0,
              createdBy: input.actorId,
            },
          });
          await this.audit.recordInTransaction(tx, {
            tenantId,
            action: 'dental.plan_item_appointment.link',
            resourceId: row.id,
            actorId: input.actorId,
            actorRoles: input.actorRoles,
            descriptionEn: 'Linked treatment plan item to appointment',
            descriptionAr: 'تم ربط بند خطة العلاج بالموعد',
            details: { planItemId, appointmentId, linkRole },
          });
          return row;
        } catch (err) {
          if ((err as { code?: string }).code === 'P2002') {
            throw new ConflictException('Plan item is already linked to this appointment');
          }
          throw err;
        }
    });
  }

  async unlink(input: {
    planId: string;
    planItemId: string;
    appointmentId: string;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    const planItemId = assertUuid(input.planItemId, 'planItemId');
    const appointmentId = assertUuid(input.appointmentId, 'appointmentId');
    const planId = assertUuid(input.planId, 'planId');

    return this.prisma.withPlatformBypass(async (tx) => {
        const item = await assertTenantPlanItem(tx, tenantId, planItemId);
        if (item.phase.planId !== planId) throw new NotFoundException('Treatment plan item not found');
        const existing = await tx.treatmentPlanItemAppointment.findFirst({
          where: { tenantId, planItemId, appointmentId },
        });
        if (!existing) throw new NotFoundException('Plan item appointment link not found');
        await tx.treatmentPlanItemAppointment.delete({ where: { id: existing.id } });
        await this.audit.recordInTransaction(tx, {
          tenantId,
          action: 'dental.plan_item_appointment.unlink',
          resourceId: existing.id,
          actorId: input.actorId,
          actorRoles: input.actorRoles,
          descriptionEn: 'Unlinked treatment plan item from appointment',
          descriptionAr: 'تم إلغاء ربط بند خطة العلاج بالموعد',
          details: { planItemId, appointmentId },
        });
        return { ok: true };
    });
  }

  async listForItem(planId: string, planItemId: string) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    const item = await this.prisma.withPlatformBypass((c) =>
      assertTenantPlanItem(c, tenantId, assertUuid(planItemId, 'planItemId')),
    );
    if (item.phase.planId !== assertUuid(planId, 'planId')) {
      throw new NotFoundException('Treatment plan item not found');
    }
    return this.prisma.withPlatformBypass((c) =>
      c.treatmentPlanItemAppointment.findMany({
        where: { tenantId, planItemId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    );
  }

  async completeFromAppointment(input: {
    planId: string;
    planItemId: string;
    appointmentId: string;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!input.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');
    const planItemId = assertUuid(input.planItemId, 'planItemId');
    const appointmentId = assertUuid(input.appointmentId, 'appointmentId');
    const planId = assertUuid(input.planId, 'planId');

    return this.prisma.withPlatformBypass(async (tx) => {
        const item = await assertTenantPlanItem(tx, tenantId, planItemId);
        if (item.phase.planId !== planId) throw new NotFoundException('Treatment plan item not found');
        const link = await tx.treatmentPlanItemAppointment.findFirst({
          where: { tenantId, planItemId, appointmentId },
        });
        if (!link) {
          throw new BadRequestException('Appointment is not linked to this plan item');
        }
        if (item.status === 'COMPLETED') {
          throw new BadRequestException('Treatment plan item is already completed');
        }
        if (item.dependsOnItemId) {
          const dep = await tx.treatmentPlanItem.findFirst({
            where: { id: item.dependsOnItemId, tenantId },
            select: { status: true },
          });
          if (dep && dep.status !== 'COMPLETED') {
            throw new BadRequestException('Complete prerequisite procedures first');
          }
        }
        const appointment = await assertTenantAppointment(tx, tenantId, appointmentId);
        if (String(appointment.status).toUpperCase() !== APPOINTMENT_COMPLETED_STATUS) {
          throw new BadRequestException(
            'Linked appointment must be COMPLETED before plan item completion',
          );
        }
        const updated = await tx.treatmentPlanItem.update({
          where: { id: planItemId },
          data: { status: 'COMPLETED', completedAt: new Date(), completedBy: input.actorId },
        });
        await this.audit.recordInTransaction(tx, {
          tenantId,
          action: 'dental.plan_item.complete_from_appointment',
          resourceId: planItemId,
          actorId: input.actorId,
          actorRoles: input.actorRoles,
          descriptionEn: 'Completed plan item from linked appointment',
          descriptionAr: 'تم إكمال بند الخطة من الموعد المرتبط',
          details: { appointmentId },
        });
        return updated;
    });
  }
}
