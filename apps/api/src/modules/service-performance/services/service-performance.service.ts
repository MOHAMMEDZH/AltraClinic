import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma, ServicePerformanceParticipantRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import {
  SERVICE_PERFORMANCE_AUDIT_LOG,
  ServicePerformanceAuditLog,
} from '../ports/service-performance-audit-log.port';
import {
  assertReadableClinicalService,
  assertTenantAppointment,
  assertTenantBranch,
  assertTenantEncounter,
  assertTenantPatient,
  assertTenantSnapshotRevisionContext,
  assertTenantUser,
  assertUuid,
} from '../../dental/services/wave-d-reference.validation';

type ParticipantInput = {
  userId: string;
  role: 'PRIMARY' | 'ASSISTING';
  attributionShare?: number | null;
};

@Injectable()
export class ServicePerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(SERVICE_PERFORMANCE_AUDIT_LOG) private readonly audit: ServicePerformanceAuditLog,
  ) {}

  async create(input: {
    clinicalServiceId: string;
    performedAt: string;
    appointmentId?: string | null;
    encounterId?: string | null;
    patientId?: string | null;
    branchId?: string | null;
    snapshotRevisionId?: string | null;
    participants: ParticipantInput[];
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!input.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');
    this.assertParticipants(input.participants);

    return this.prisma.withPlatformBypass(async (tx) => {
        const clinicalServiceId = assertUuid(input.clinicalServiceId, 'clinicalServiceId');
        await assertReadableClinicalService(tx, tenantId, clinicalServiceId);
        let appointmentId: string | null = null;
        let appointment:
          | { id: string; patientId: string; branchId: string | null; clinicalServiceId: string | null }
          | null = null;
        let patientId = input.patientId ? assertUuid(input.patientId, 'patientId') : null;
        if (input.appointmentId) {
          appointmentId = assertUuid(input.appointmentId, 'appointmentId');
          const appt = await assertTenantAppointment(tx, tenantId, appointmentId);
          appointment = appt;
          if (patientId && appt.patientId !== patientId) {
            throw new BadRequestException('appointmentId patient does not match patientId');
          }
          patientId = patientId ?? appt.patientId;
          if (appt.clinicalServiceId && appt.clinicalServiceId !== clinicalServiceId) {
            throw new BadRequestException(
              'appointmentId clinical service does not match clinicalServiceId',
            );
          }
        }
        if (patientId) await assertTenantPatient(tx, tenantId, patientId);
        let branchId = input.branchId ? assertUuid(input.branchId, 'branchId') : tenant.branchId ?? null;
        if (branchId) {
          await assertTenantBranch(tx, tenantId, branchId);
        }
        let encounterId: string | null = null;
        if (input.encounterId) {
          encounterId = assertUuid(input.encounterId, 'encounterId');
          const encounter = await assertTenantEncounter(tx, tenantId, encounterId);
          if (patientId && encounter.patientId !== patientId) {
            throw new BadRequestException('encounterId patient does not match patientId');
          }
          patientId = patientId ?? encounter.patientId;
          if (appointmentId && encounter.appointmentId && encounter.appointmentId !== appointmentId) {
            throw new BadRequestException('encounterId appointment does not match appointmentId');
          }
          if (appointment && encounter.branchId && appointment.branchId !== encounter.branchId) {
            throw new BadRequestException('encounterId branch does not match appointmentId branch');
          }
          if (encounter.branchId) {
            if (branchId && branchId !== encounter.branchId) {
              throw new BadRequestException('encounterId branch does not match branchId');
            }
            if (!branchId) {
              branchId = encounter.branchId;
            }
          }
        }
        if (appointment && branchId && appointment.branchId && appointment.branchId !== branchId) {
          throw new BadRequestException('appointmentId branch does not match branchId');
        }
        if (input.snapshotRevisionId) {
          await assertTenantSnapshotRevisionContext(
            tx,
            tenantId,
            assertUuid(input.snapshotRevisionId, 'snapshotRevisionId'),
            {
              clinicalServiceId,
              appointmentId,
              patientId,
              branchId,
              encounterId,
            },
          );
        }
        for (const p of input.participants) {
          const user = await assertTenantUser(tx, tenantId, assertUuid(p.userId, 'userId'));
          if (!user.isActive) throw new BadRequestException('Inactive user cannot be attributed');
        }
        const id = randomUUID();
        const row = await tx.servicePerformance.create({
          data: {
            id,
            tenantId,
            branchId,
            appointmentId,
            encounterId,
            patientId,
            clinicalServiceId,
            snapshotRevisionId: input.snapshotRevisionId ?? null,
            performedAt: new Date(input.performedAt),
            status: 'DRAFT',
            createdBy: input.actorId,
            participants: {
              create: input.participants.map((p) => ({
                id: randomUUID(),
                tenantId,
                userId: p.userId,
                role: p.role as ServicePerformanceParticipantRole,
                attributionShare: p.attributionShare ?? null,
                recordedBy: input.actorId,
              })),
            },
          },
          include: { participants: true },
        });
        await this.audit.recordInTransaction(tx, {
          tenantId,
          action: 'service_performance.create',
          resourceId: id,
          actorId: input.actorId,
          actorRoles: input.actorRoles,
          descriptionEn: 'Created service performance draft',
          descriptionAr: 'تم إنشاء مسودة أداء الخدمة',
          details: { clinicalServiceId, appointmentId },
        });
        return row;
    });
  }

  async complete(input: { id: string; actorId: string; actorRoles: string[] }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    return this.prisma.withPlatformBypass(async (tx) => {
        const id = assertUuid(input.id, 'id');
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM service_performances
          WHERE id = ${id}::uuid AND "tenantId" = ${tenantId}::uuid AND "deletedAt" IS NULL
          FOR UPDATE
        `;
        if (!locked.length) throw new NotFoundException('Service performance not found');
        const row = await tx.servicePerformance.findFirst({
          where: { id, tenantId, deletedAt: null },
          include: { participants: true, appointment: { select: { providerId: true } } },
        });
        if (!row) throw new NotFoundException('Service performance not found');
        if (row.status !== 'DRAFT') {
          throw new BadRequestException('Only DRAFT performances may be completed');
        }
        this.assertCompleteReady(row.participants, row.appointment?.providerId ?? null);
        const updated = await tx.servicePerformance.update({
          where: { id: row.id },
          data: { status: 'COMPLETED', completedAt: new Date(), completedBy: input.actorId },
          include: { participants: true },
        });
        await this.audit.recordInTransaction(tx, {
          tenantId,
          action: 'service_performance.complete',
          resourceId: row.id,
          actorId: input.actorId,
          actorRoles: input.actorRoles,
          descriptionEn: 'Completed service performance',
          descriptionAr: 'تم إكمال أداء الخدمة',
          details: { participantCount: row.participants.length },
        });
        return updated;
    });
  }

  async correct(input: {
    id: string;
    reason: string;
    participants: ParticipantInput[];
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    const reason = input.reason?.trim();
    if (!reason) throw new BadRequestException('reason is required');
    this.assertParticipants(input.participants);
    return this.prisma.withPlatformBypass(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.wave_d_performance_correction', 'true', true)`;
        const id = assertUuid(input.id, 'id');
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM service_performances
          WHERE id = ${id}::uuid AND "tenantId" = ${tenantId}::uuid AND "deletedAt" IS NULL
          FOR UPDATE
        `;
        if (!locked.length) throw new NotFoundException('Service performance not found');
        const row = await tx.servicePerformance.findFirst({
          where: { id, tenantId, deletedAt: null },
          include: { participants: true, appointment: { select: { providerId: true } } },
        });
        if (!row) throw new NotFoundException('Service performance not found');
        if (row.status !== 'COMPLETED') {
          throw new BadRequestException('Correction applies only to COMPLETED performances');
        }
        for (const p of input.participants) {
          const user = await assertTenantUser(tx, tenantId, assertUuid(p.userId, 'userId'));
          if (!user.isActive) throw new BadRequestException('Inactive user cannot be attributed');
        }
        this.assertCompleteReady(
          input.participants.map((p) => ({
            userId: p.userId,
            role: p.role,
            attributionShare: p.attributionShare ?? null,
          })),
          row.appointment?.providerId ?? null,
        );
        await tx.servicePerformanceCorrection.create({
          data: {
            id: randomUUID(),
            tenantId,
            performanceId: row.id,
            reason,
            actorId: input.actorId,
            previousParticipants: row.participants as unknown as Prisma.InputJsonValue,
          },
        });
        await tx.servicePerformanceParticipant.deleteMany({ where: { performanceId: row.id } });
        await tx.servicePerformanceParticipant.createMany({
          data: input.participants.map((p) => ({
            id: randomUUID(),
            tenantId,
            performanceId: row.id,
            userId: p.userId,
            role: p.role as ServicePerformanceParticipantRole,
            attributionShare: p.attributionShare ?? null,
            recordedBy: input.actorId,
          })),
        });
        await this.audit.recordInTransaction(tx, {
          tenantId,
          action: 'service_performance.correct',
          resourceId: row.id,
          actorId: input.actorId,
          actorRoles: input.actorRoles,
          descriptionEn: 'Audited correction of completed service performance',
          descriptionAr: 'تصحيح مدقق لأداء خدمة مكتمل',
          details: { reason },
        });
        return tx.servicePerformance.findFirst({
          where: { id: row.id },
          include: { participants: true, corrections: true },
        });
    });
  }

  async get(id: string) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    const row = await this.prisma.withPlatformBypass((c) =>
      c.servicePerformance.findFirst({
        where: { id: assertUuid(id, 'id'), tenantId, deletedAt: null },
        include: { participants: true, corrections: true },
      }),
    );
    if (!row) throw new NotFoundException('Service performance not found');
    return row;
  }

  private assertParticipants(participants: ParticipantInput[]) {
    if (!participants?.length) {
      throw new BadRequestException('At least one participant is required');
    }
    const primary = participants.filter((p) => p.role === 'PRIMARY');
    if (primary.length !== 1) {
      throw new BadRequestException('Exactly one PRIMARY participant is required');
    }
    this.assertShareSum(participants);
  }

  private assertCompleteReady(
    participants: Array<{ userId: string; role: string; attributionShare?: unknown }>,
    appointmentProviderId: string | null,
  ) {
    const primary = participants.filter((p) => p.role === 'PRIMARY');
    if (primary.length !== 1) {
      throw new BadRequestException('Exactly one PRIMARY participant is required');
    }
    if (appointmentProviderId && participants.length === 1) {
      // Explicit participant is still required; providerId match is allowed but never inferred.
    }
    this.assertShareSum(participants);
  }

  private assertShareSum(participants: Array<{ attributionShare?: unknown }>) {
    const shares = participants
      .map((p) => (p.attributionShare == null ? null : Number(p.attributionShare)))
      .filter((n): n is number => n != null);
    if (shares.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) {
      throw new BadRequestException('attributionShare must be between 0 and 100');
    }
    const sum = shares.reduce((a, b) => a + b, 0);
    if (sum > 100) {
      throw new BadRequestException('attributionShare sum must be <= 100');
    }
  }
}
