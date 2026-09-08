import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus as PrismaAppointmentStatus,
  PatientRecallStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { SCHEDULING_AUDIT_LOG, SchedulingAuditLog } from '../ports/scheduling-audit-log.port';
import { NotificationIntentProducerService } from '../../../notifications/delivery/notification-intent-producer.service';
import {
  canBook,
  canComplete,
  canOptOut,
  canSnooze,
  computeDueAt,
  isDueAsOf,
  parseBoundedEligibilityExpr,
  patientPassesBoundedEligibility,
} from '../../domain/recall.lifecycle';
import { BookingConcurrencyService } from '../services/booking-concurrency.service';

function ruleDto(row: {
  id: string;
  tenantId: string;
  clinicalServiceId: string | null;
  intervalDays: number;
  eligibilityExpr: Prisma.JsonValue;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    clinicalServiceId: row.clinicalServiceId,
    intervalDays: row.intervalDays,
    eligibilityExpr: row.eligibilityExpr,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

function instanceDto(row: {
  id: string;
  tenantId: string;
  patientId: string;
  ruleId: string;
  dueAt: Date;
  status: PatientRecallStatus;
  lastQualifyingServiceAt: Date | null;
  snoozedUntil: Date | null;
  appointmentId: string | null;
  completedAt: Date | null;
  optedOutAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    patientId: row.patientId,
    ruleId: row.ruleId,
    dueAt: row.dueAt.toISOString(),
    status: row.status,
    lastQualifyingServiceAt: row.lastQualifyingServiceAt?.toISOString() ?? null,
    snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
    appointmentId: row.appointmentId,
    completedAt: row.completedAt?.toISOString() ?? null,
    optedOutAt: row.optedOutAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class CreateRecallRuleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly audit: SchedulingAuditLog,
  ) {}

  async execute(input: {
    intervalDays: number;
    clinicalServiceId?: string | null;
    eligibilityExpr?: unknown;
    active?: boolean;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const intervalDays = Math.floor(Number(input.intervalDays));
    if (!Number.isFinite(intervalDays) || intervalDays < 1) {
      throw new BadRequestException('intervalDays must be >= 1');
    }
    const eligibilityExpr = parseBoundedEligibilityExpr(input.eligibilityExpr ?? {});

    return this.prisma.withTenantContext(tenant.tenantId, async (c) => {
      if (input.clinicalServiceId?.trim()) {
        const svc = await c.canonicalClinicalServiceDefinition.findFirst({
          where: {
            id: input.clinicalServiceId.trim(),
            OR: [{ tenantId: null }, { tenantId: tenant.tenantId }],
          },
        });
        if (!svc) throw new NotFoundException('Clinical service not found');
      }

      const id = randomUUID();
      const row = await c.recallRule.create({
        data: {
          id,
          tenantId: tenant.tenantId,
          clinicalServiceId: input.clinicalServiceId?.trim() || null,
          intervalDays,
          eligibilityExpr: eligibilityExpr as Prisma.InputJsonValue,
          active: input.active ?? true,
          createdBy: input.actorId,
        },
      });

      await this.audit.record({
        tenantId: tenant.tenantId,
        action: 'recall_rule.created',
        resourceId: row.id,
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        descriptionEn: 'Created RecallRule SoR',
        descriptionAr: 'إنشاء قاعدة استدعاء',
        details: { intervalDays, clinicalServiceId: row.clinicalServiceId },
      });

      return ruleDto(row);
    });
  }
}

@Injectable()
export class ListRecallRulesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(activeOnly?: boolean) {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.withTenantContext(tenant.tenantId, (c) =>
      c.recallRule.findMany({
        where: {
          tenantId: tenant.tenantId,
          deletedAt: null,
          ...(activeOnly ? { active: true } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    );
    return { items: rows.map(ruleDto) };
  }
}

@Injectable()
export class UpdateRecallRuleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly audit: SchedulingAuditLog,
  ) {}

  async execute(
    id: string,
    input: {
      intervalDays?: number;
      clinicalServiceId?: string | null;
      eligibilityExpr?: unknown;
      active?: boolean;
      actorId: string;
      actorRoles: string[];
    },
  ) {
    const tenant = await this.tenantContext.resolve();
    return this.prisma.withTenantContext(tenant.tenantId, async (c) => {
      const existing = await c.recallRule.findFirst({
        where: { id, tenantId: tenant.tenantId, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('RecallRule not found');

      const data: Prisma.RecallRuleUncheckedUpdateInput = {};
      if (input.intervalDays != null) {
        const intervalDays = Math.floor(Number(input.intervalDays));
        if (!Number.isFinite(intervalDays) || intervalDays < 1) {
          throw new BadRequestException('intervalDays must be >= 1');
        }
        data.intervalDays = intervalDays;
      }
      if (input.active != null) data.active = input.active;
      if (input.eligibilityExpr !== undefined) {
        data.eligibilityExpr = parseBoundedEligibilityExpr(
          input.eligibilityExpr,
        ) as Prisma.InputJsonValue;
      }
      if (input.clinicalServiceId !== undefined) {
        data.clinicalServiceId = input.clinicalServiceId?.trim() || null;
      }

      const row = await c.recallRule.update({ where: { id }, data });
      await this.audit.record({
        tenantId: tenant.tenantId,
        action: 'recall_rule.updated',
        resourceId: id,
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        descriptionEn: 'Updated RecallRule SoR',
        descriptionAr: 'تحديث قاعدة استدعاء',
        details: { active: row.active, intervalDays: row.intervalDays },
      });
      return ruleDto(row);
    });
  }
}

@Injectable()
export class SoftDeleteRecallRuleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly audit: SchedulingAuditLog,
  ) {}

  async execute(id: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    return this.prisma.withTenantContext(tenant.tenantId, async (c) => {
      const existing = await c.recallRule.findFirst({
        where: { id, tenantId: tenant.tenantId, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('RecallRule not found');
      await c.recallRule.update({
        where: { id },
        data: { deletedAt: new Date(), active: false },
      });
      await this.audit.record({
        tenantId: tenant.tenantId,
        action: 'recall_rule.soft_deleted',
        resourceId: id,
        actorId,
        actorRoles,
        descriptionEn: 'Soft-deleted RecallRule',
        descriptionAr: 'حذف ناعم لقاعدة الاستدعاء',
        details: {},
      });
      return { ok: true, id };
    });
  }
}

@Injectable()
export class ListPatientRecallInstancesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(input: { status?: string; patientId?: string; ruleId?: string }) {
    const tenant = await this.tenantContext.resolve();
    const status =
      input.status &&
      Object.values(PatientRecallStatus).includes(input.status as PatientRecallStatus)
        ? (input.status as PatientRecallStatus)
        : undefined;

    const rows = await this.prisma.withTenantContext(tenant.tenantId, (c) =>
      c.patientRecallInstance.findMany({
        where: {
          tenantId: tenant.tenantId,
          deletedAt: null,
          ...(status ? { status } : {}),
          ...(input.patientId ? { patientId: input.patientId } : {}),
          ...(input.ruleId ? { ruleId: input.ruleId } : {}),
        },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
        take: 500,
      }),
    );
    return { items: rows.map(instanceDto) };
  }
}

@Injectable()
export class TransitionPatientRecallHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly concurrency: BookingConcurrencyService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly audit: SchedulingAuditLog,
  ) {}

  async snooze(id: string, snoozeUntilIso: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    const snoozedUntil = new Date(snoozeUntilIso);
    if (Number.isNaN(snoozedUntil.getTime())) {
      throw new BadRequestException('snoozeUntil must be ISO datetime');
    }
    const now = new Date();
    if (snoozedUntil.getTime() <= now.getTime()) {
      throw new BadRequestException('snoozeUntil must be in the future');
    }

    return this.prisma.withTenantContext(tenant.tenantId, async (c) => {
      const row = await c.patientRecallInstance.findFirst({
        where: { id, tenantId: tenant.tenantId, deletedAt: null },
      });
      if (!row) throw new NotFoundException('Recall instance not found');
      if (!canSnooze(row.status)) {
        throw new ConflictException(`Cannot snooze from status ${row.status}`);
      }
      const updated = await c.patientRecallInstance.update({
        where: { id },
        data: {
          status: PatientRecallStatus.SNOOZED,
          snoozedUntil,
          dueAt: snoozedUntil,
          updatedAt: now,
        },
      });
      await this.audit.record({
        tenantId: tenant.tenantId,
        action: 'recall_instance.snoozed',
        resourceId: id,
        actorId,
        actorRoles,
        descriptionEn: 'PatientRecallInstance snoozed',
        descriptionAr: 'تأجيل مثيل الاستدعاء',
        details: { snoozedUntil: snoozedUntil.toISOString() },
      });
      return instanceDto(updated);
    });
  }

  async book(
    id: string,
    input: {
      appointmentId?: string;
      start?: string;
      end?: string;
      providerId?: string;
      actorId: string;
      actorRoles: string[];
    },
  ) {
    const tenant = await this.tenantContext.resolve();
    const now = new Date();

    const existing = await this.prisma.withTenantContext(tenant.tenantId, (c) =>
      c.patientRecallInstance.findFirst({
        where: { id, tenantId: tenant.tenantId, deletedAt: null },
        include: { patient: { select: { id: true } } },
      }),
    );
    if (!existing) throw new NotFoundException('Recall instance not found');
    if (!canBook(existing.status)) {
      throw new ConflictException(`Cannot book from status ${existing.status}`);
    }

    let appointmentId = input.appointmentId?.trim() || null;

    if (!appointmentId) {
      if (!input.start?.trim() || !input.end?.trim() || !input.providerId?.trim()) {
        throw new BadRequestException(
          'appointmentId or (start, end, providerId) required to book recall',
        );
      }
      const start = new Date(input.start);
      const end = new Date(input.end);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        throw new BadRequestException('Invalid start/end');
      }
      appointmentId = randomUUID();
      await this.concurrency.withBookingTransaction(async (client) => {
        await this.concurrency.assertSlotAvailableUnderLock(client, {
          tenantId: tenant.tenantId,
          providerId: input.providerId!.trim(),
          resourceIds: [],
          start,
          end,
        });
        await client.appointment.create({
          data: {
            id: appointmentId!,
            tenantId: tenant.tenantId,
            branchId: tenant.branchId ?? null,
            patientId: existing.patientId,
            providerId: input.providerId!.trim(),
            scheduledStart: start,
            scheduledEnd: end,
            status: PrismaAppointmentStatus.PENDING,
            snapshotWriteMode: 'LEGACY',
          },
        });
      });
    } else {
      const appt = await this.prisma.withTenantContext(tenant.tenantId, (c) =>
        c.appointment.findFirst({
          where: {
            id: appointmentId!,
            tenantId: tenant.tenantId,
            patientId: existing.patientId,
            deletedAt: null,
          },
        }),
      );
      if (!appt) throw new NotFoundException('Appointment not found for patient');
    }

    return this.prisma.withTenantContext(tenant.tenantId, async (c) => {
      const updated = await c.patientRecallInstance.updateMany({
        where: {
          id,
          tenantId: tenant.tenantId,
          status: { in: [PatientRecallStatus.DUE, PatientRecallStatus.SNOOZED] },
          deletedAt: null,
        },
        data: {
          status: PatientRecallStatus.BOOKED,
          appointmentId,
          updatedAt: now,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Recall book lost race');
      }
      const row = await c.patientRecallInstance.findFirstOrThrow({ where: { id } });
      await this.audit.record({
        tenantId: tenant.tenantId,
        action: 'recall_instance.booked',
        resourceId: id,
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        descriptionEn: 'PatientRecallInstance booked',
        descriptionAr: 'حجز مثيل الاستدعاء',
        details: { appointmentId },
      });
      return instanceDto(row);
    });
  }

  async complete(id: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    const now = new Date();
    return this.prisma.withTenantContext(tenant.tenantId, async (c) => {
      const row = await c.patientRecallInstance.findFirst({
        where: { id, tenantId: tenant.tenantId, deletedAt: null },
      });
      if (!row) throw new NotFoundException('Recall instance not found');
      if (!canComplete(row.status)) {
        throw new ConflictException(`Cannot complete from status ${row.status}`);
      }
      const updated = await c.patientRecallInstance.update({
        where: { id },
        data: {
          status: PatientRecallStatus.COMPLETED,
          completedAt: now,
          updatedAt: now,
        },
      });
      await this.audit.record({
        tenantId: tenant.tenantId,
        action: 'recall_instance.completed',
        resourceId: id,
        actorId,
        actorRoles,
        descriptionEn: 'PatientRecallInstance completed',
        descriptionAr: 'إكمال مثيل الاستدعاء',
        details: {},
      });
      return instanceDto(updated);
    });
  }

  async optOut(id: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    const now = new Date();
    return this.prisma.withTenantContext(tenant.tenantId, async (c) => {
      const row = await c.patientRecallInstance.findFirst({
        where: { id, tenantId: tenant.tenantId, deletedAt: null },
      });
      if (!row) throw new NotFoundException('Recall instance not found');
      if (!canOptOut(row.status)) {
        throw new ConflictException(`Cannot opt-out from status ${row.status}`);
      }
      const updated = await c.patientRecallInstance.update({
        where: { id },
        data: {
          status: PatientRecallStatus.OPTED_OUT,
          optedOutAt: now,
          updatedAt: now,
        },
      });
      await this.audit.record({
        tenantId: tenant.tenantId,
        action: 'recall_instance.opted_out',
        resourceId: id,
        actorId,
        actorRoles,
        descriptionEn: 'PatientRecallInstance opted out',
        descriptionAr: 'انسحاب من الاستدعاء',
        details: {},
      });
      return instanceDto(updated);
    });
  }
}

/**
 * Deterministic due scan: materialize DUE instances from active RecallRules.
 * Notifications are optional delivery — SoR remains RecallRule + Instance rows.
 */
@Injectable()
export class ScanRecallDueHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly producer: NotificationIntentProducerService,
    @Inject(SCHEDULING_AUDIT_LOG) private readonly audit: SchedulingAuditLog,
  ) {}

  async execute(input: {
    actorId: string;
    actorRoles: string[];
    asOf?: Date;
    notify?: boolean;
  }) {
    const tenant = await this.tenantContext.resolve();
    const asOf = input.asOf ?? new Date();
    let created = 0;
    let notified = 0;
    let skipped = 0;

    const { rulesScanned } = await this.prisma.withTenantContext(tenant.tenantId, async (c) => {
      const rules = await c.recallRule.findMany({
        where: { tenantId: tenant.tenantId, active: true, deletedAt: null },
      });

      for (const rule of rules) {
        const expr = parseBoundedEligibilityExpr(rule.eligibilityExpr);
        const appointments = await c.appointment.findMany({
          where: {
            tenantId: tenant.tenantId,
            deletedAt: null,
            status: PrismaAppointmentStatus.COMPLETED,
            ...(rule.clinicalServiceId
              ? { clinicalServiceId: rule.clinicalServiceId }
              : {}),
            scheduledEnd: { lte: asOf },
          },
          select: {
            patientId: true,
            scheduledEnd: true,
            patient: { select: { id: true, dateOfBirth: true } },
          },
          orderBy: { scheduledEnd: 'desc' },
          take: 2000,
        });

        const lastByPatient = new Map<
          string,
          { last: Date; dateOfBirth: Date | null }
        >();
        for (const appt of appointments) {
          if (lastByPatient.has(appt.patientId)) continue;
          lastByPatient.set(appt.patientId, {
            last: appt.scheduledEnd,
            dateOfBirth: appt.patient.dateOfBirth,
          });
        }

        for (const [patientId, info] of lastByPatient) {
          if (
            !patientPassesBoundedEligibility({
              expr,
              dateOfBirth: info.dateOfBirth,
              lastQualifyingServiceAt: info.last,
              asOf,
            })
          ) {
            skipped += 1;
            continue;
          }

          const dueAt = computeDueAt(info.last, rule.intervalDays);
          if (!isDueAsOf(dueAt, asOf)) {
            skipped += 1;
            continue;
          }

          const open = await c.patientRecallInstance.findFirst({
            where: {
              tenantId: tenant.tenantId,
              patientId,
              ruleId: rule.id,
              deletedAt: null,
              status: {
                in: [
                  PatientRecallStatus.DUE,
                  PatientRecallStatus.SNOOZED,
                  PatientRecallStatus.BOOKED,
                ],
              },
            },
          });
          if (open) {
            if (
              open.status === PatientRecallStatus.SNOOZED &&
              open.snoozedUntil &&
              open.snoozedUntil.getTime() > asOf.getTime()
            ) {
              skipped += 1;
              continue;
            }
            if (
              open.status === PatientRecallStatus.SNOOZED &&
              open.snoozedUntil &&
              open.snoozedUntil.getTime() <= asOf.getTime()
            ) {
              await c.patientRecallInstance.update({
                where: { id: open.id },
                data: {
                  status: PatientRecallStatus.DUE,
                  dueAt,
                  lastQualifyingServiceAt: info.last,
                  updatedAt: asOf,
                },
              });
              created += 1;
              continue;
            }
            skipped += 1;
            continue;
          }

          const instanceId = randomUUID();
          await c.patientRecallInstance.create({
            data: {
              id: instanceId,
              tenantId: tenant.tenantId,
              patientId,
              ruleId: rule.id,
              dueAt,
              status: PatientRecallStatus.DUE,
              lastQualifyingServiceAt: info.last,
            },
          });
          created += 1;

          if (input.notify) {
            await this.producer.produceInApp({
              tenantId: tenant.tenantId,
              branchId: tenant.branchId,
              recipientId: patientId,
              title: 'Recall due',
              body: `A clinical recall is due (rule ${rule.id}).`,
              priority: 'medium',
              idempotencyKey: `recall-due:${instanceId}`,
              producerModuleId: 'scheduling.recall-due-scan',
            });
            notified += 1;
          }
        }
      }

      return { rulesScanned: rules.length };
    });

    await this.audit.record({
      tenantId: tenant.tenantId,
      action: 'recall_due.scanned',
      resourceId: tenant.tenantId,
      actorId: input.actorId,
      actorRoles: input.actorRoles,
      descriptionEn: 'Recall due scan completed',
      descriptionAr: 'اكتملت عملية مسح الاستدعاءات المستحقة',
      details: { created, notified, skipped, asOf: asOf.toISOString() },
    });

    return { created, notified, skipped, asOf: asOf.toISOString(), rulesScanned };
  }
}
