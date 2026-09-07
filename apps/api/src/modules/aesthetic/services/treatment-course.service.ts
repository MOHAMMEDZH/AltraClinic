import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CourseSessionStatus, TreatmentCourseStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { WAVE_E_AUDIT_LOG, WaveEAuditLog } from '../ports/wave-e-audit-log.port';
import {
  COURSE_TRANSITIONS,
  SESSION_TRANSITIONS,
  assertCourseSessionInterval,
  assertIntervalBounds,
  assertPackagePriceVersionForCourse,
  assertPlannedSessions,
  assertReadableClinicalService,
  assertTenantAppointment,
  assertTenantPatient,
  assertUuid,
} from './wave-e-reference.validation';

@Injectable()
export class TreatmentCourseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(WAVE_E_AUDIT_LOG) private readonly audit: WaveEAuditLog,
  ) {}

  async create(input: {
    patientId: string;
    clinicalServiceId: string;
    plannedSessions: number;
    intervalMinDays?: number | null;
    intervalMaxDays?: number | null;
    packagePriceVersionId?: string | null;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!input.actorId?.trim()) throw new BadRequestException('Authenticated actor is required');

    const patientId = assertUuid(input.patientId, 'patientId');
    const clinicalServiceId = assertUuid(input.clinicalServiceId, 'clinicalServiceId');
    const plannedSessions = assertPlannedSessions(input.plannedSessions);
    assertIntervalBounds(input.intervalMinDays, input.intervalMaxDays);

    return this.prisma.withPlatformBypass(async (tx) => {
      await assertTenantPatient(tx, tenantId, patientId);
      await assertReadableClinicalService(tx, tenantId, clinicalServiceId);
      let packagePriceVersionId: string | null = null;
      if (input.packagePriceVersionId) {
        packagePriceVersionId = assertUuid(input.packagePriceVersionId, 'packagePriceVersionId');
        await assertPackagePriceVersionForCourse(
          tx,
          tenantId,
          clinicalServiceId,
          packagePriceVersionId,
        );
      }

      const courseId = randomUUID();
      const course = await tx.treatmentCourse.create({
        data: {
          id: courseId,
          tenantId,
          patientId,
          clinicalServiceId,
          plannedSessions,
          intervalMinDays: input.intervalMinDays ?? null,
          intervalMaxDays: input.intervalMaxDays ?? null,
          packagePriceVersionId,
          status: TreatmentCourseStatus.DRAFT,
          createdBy: input.actorId,
        },
      });

      const sessions = [];
      for (let seq = 1; seq <= plannedSessions; seq++) {
        sessions.push(
          await tx.courseSession.create({
            data: {
              id: randomUUID(),
              tenantId,
              courseId,
              sequence: seq,
              status: CourseSessionStatus.PLANNED,
            },
          }),
        );
      }

      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        action: 'treatment_course.create',
        resourceId: courseId,
        descriptionEn: 'Treatment course created',
        details: { plannedSessions, clinicalServiceId },
      });

      return { ...course, sessions };
    });
  }

  async get(id: string) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    const course = await this.prisma.withPlatformBypass((tx) =>
      tx.treatmentCourse.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { sessions: { where: { deletedAt: null }, orderBy: { sequence: 'asc' } } },
      }),
    );
    if (!course) throw new NotFoundException('Treatment course not found');
    return course;
  }

  async transition(input: {
    id: string;
    toStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    return this.prisma.withPlatformBypass(async (tx) => {
      const course = await tx.treatmentCourse.findFirst({
        where: { id: input.id, tenantId, deletedAt: null },
      });
      if (!course) throw new NotFoundException('Treatment course not found');
      const allowed = COURSE_TRANSITIONS[course.status] ?? [];
      if (!allowed.includes(input.toStatus)) {
        throw new BadRequestException(`Cannot transition course from ${course.status} to ${input.toStatus}`);
      }
      const updated = await tx.treatmentCourse.update({
        where: { id: course.id },
        data: { status: input.toStatus as TreatmentCourseStatus },
      });
      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        action: 'treatment_course.transition',
        resourceId: course.id,
        descriptionEn: `Treatment course transitioned to ${input.toStatus}`,
        details: { from: course.status, to: input.toStatus },
      });
      return updated;
    });
  }

  /**
   * Explicit link only — frozen AR-13: no silent auto-book.
   */
  async linkSessionAppointment(input: {
    courseId: string;
    sessionId: string;
    appointmentId: string;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    return this.prisma.withPlatformBypass(async (tx) => {
      const course = await tx.treatmentCourse.findFirst({
        where: { id: input.courseId, tenantId, deletedAt: null },
      });
      if (!course) throw new NotFoundException('Treatment course not found');
      const session = await tx.courseSession.findFirst({
        where: { id: input.sessionId, courseId: input.courseId, tenantId, deletedAt: null },
      });
      if (!session) throw new NotFoundException('Course session not found');
      if (session.status === 'COMPLETED' || session.status === 'CANCELLED' || session.status === 'SKIPPED') {
        throw new BadRequestException(`Cannot link appointment to session in status ${session.status}`);
      }
      const appointmentId = assertUuid(input.appointmentId, 'appointmentId');
      const appt = await assertTenantAppointment(tx, tenantId, appointmentId);
      if (appt.patientId !== course.patientId) {
        throw new BadRequestException('appointmentId patient does not match course patient');
      }
      if (
        appt.clinicalServiceId &&
        appt.clinicalServiceId !== course.clinicalServiceId
      ) {
        throw new BadRequestException('appointmentId clinical service does not match course');
      }

      await assertCourseSessionInterval(tx, {
        courseId: course.id,
        tenantId,
        sessionSequence: session.sequence,
        newAppointmentStart: appt.scheduledStart,
        intervalMinDays: course.intervalMinDays,
        intervalMaxDays: course.intervalMaxDays,
      });

      const updated = await tx.courseSession.update({
        where: { id: session.id },
        data: {
          appointmentId,
          status: CourseSessionStatus.BOOKED,
        },
      });
      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        action: 'course_session.link_appointment',
        resourceId: session.id,
        descriptionEn: 'Course session explicitly linked to appointment',
        details: { appointmentId, courseId: course.id },
      });
      return updated;
    });
  }

  async transitionSession(input: {
    courseId: string;
    sessionId: string;
    toStatus: 'COMPLETED' | 'SKIPPED' | 'CANCELLED';
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    return this.prisma.withPlatformBypass(async (tx) => {
      const session = await tx.courseSession.findFirst({
        where: {
          id: input.sessionId,
          courseId: input.courseId,
          tenantId,
          deletedAt: null,
        },
      });
      if (!session) throw new NotFoundException('Course session not found');
      const allowed = SESSION_TRANSITIONS[session.status] ?? [];
      if (!allowed.includes(input.toStatus)) {
        throw new BadRequestException(
          `Cannot transition session from ${session.status} to ${input.toStatus}`,
        );
      }
      const updated = await tx.courseSession.update({
        where: { id: session.id },
        data: { status: input.toStatus as CourseSessionStatus },
      });
      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId: input.actorId,
        actorRoles: input.actorRoles,
        action: 'course_session.transition',
        resourceId: session.id,
        descriptionEn: `Course session transitioned to ${input.toStatus}`,
        details: { from: session.status, to: input.toStatus },
      });
      return updated;
    });
  }
}
