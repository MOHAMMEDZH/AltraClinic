import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClinicalPriceVersionStatus, ClinicalPricingUnit, Prisma } from '@prisma/client';
import {
  assertReadableClinicalService,
  assertTenantAppointment,
  assertTenantBranch,
  assertTenantEncounter,
  assertTenantPatient,
  assertTenantUser,
  assertUuid,
} from '../../dental/services/wave-d-reference.validation';

export {
  assertUuid,
  assertTenantPatient,
  assertTenantAppointment,
  assertTenantBranch,
  assertTenantEncounter,
  assertTenantUser,
  assertReadableClinicalService,
};

export const COURSE_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export const COURSE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const SESSION_STATUSES = ['PLANNED', 'BOOKED', 'COMPLETED', 'SKIPPED', 'CANCELLED'] as const;
export const SESSION_TRANSITIONS: Record<string, string[]> = {
  PLANNED: ['BOOKED', 'SKIPPED', 'CANCELLED'],
  BOOKED: ['COMPLETED', 'SKIPPED', 'CANCELLED'],
  COMPLETED: [],
  SKIPPED: [],
  CANCELLED: [],
};

/**
 * AR-14 Round 1 — controlled deviceType → allowed parameterSchemaKey registry.
 * Not a giant medical enum; fail-closed unknown type/key and cross-type keys.
 */
export const DEVICE_TYPE_SCHEMA_REGISTRY: Record<string, readonly string[]> = {
  laser: ['laser.generic.v1'],
  ipl: ['ipl.generic.v1'],
  rf: ['rf.generic.v1'],
  ultrasound: ['ultrasound.generic.v1'],
  other: ['other.generic.v1'],
};

export const CONTROLLED_DEVICE_TYPES = Object.keys(DEVICE_TYPE_SCHEMA_REGISTRY);

/** Frozen derm ClinicalService categoryKey (AR-15 / P1-06). */
export const DERMATOLOGY_CATEGORY_KEY = 'dermatology';

type Db = Prisma.TransactionClient;

export async function assertTenantPriceVersion(tx: Db, tenantId: string, priceVersionId: string) {
  const row = await tx.clinicalServicePriceVersion.findFirst({
    where: { id: priceVersionId, tenantId },
    select: {
      id: true,
      tenantId: true,
      clinicalServiceId: true,
      pricingUnit: true,
      status: true,
      branchId: true,
    },
  });
  if (!row) throw new NotFoundException('packagePriceVersionId not found for tenant');
  return row;
}

/** Full package price attachment rules for TreatmentCourse. */
export async function assertPackagePriceVersionForCourse(
  tx: Db,
  tenantId: string,
  clinicalServiceId: string,
  packagePriceVersionId: string,
) {
  const pv = await assertTenantPriceVersion(tx, tenantId, packagePriceVersionId);
  if (pv.clinicalServiceId !== clinicalServiceId) {
    throw new BadRequestException('packagePriceVersionId clinical service mismatch');
  }
  if (pv.status !== ClinicalPriceVersionStatus.ACTIVE) {
    throw new BadRequestException(`packagePriceVersionId must be ACTIVE (was ${pv.status})`);
  }
  if (
    pv.pricingUnit !== ClinicalPricingUnit.PER_COURSE &&
    pv.pricingUnit !== ClinicalPricingUnit.PER_PACKAGE
  ) {
    throw new BadRequestException(
      `packagePriceVersionId pricingUnit must be PER_COURSE or PER_PACKAGE (was ${pv.pricingUnit})`,
    );
  }
  return pv;
}

export async function assertTenantBeautyAnnotation(
  tx: Db,
  tenantId: string,
  annotationId: string,
  expectedPatientId?: string,
) {
  const row = await tx.beautyAnnotation.findFirst({
    where: { id: annotationId, tenantId },
    select: {
      id: true,
      tenantId: true,
      beautyRecordId: true,
      beautyRecord: { select: { patientId: true, tenantId: true } },
    },
  });
  if (!row) throw new NotFoundException('beautyAnnotationId not found for tenant');
  if (row.beautyRecord.tenantId !== tenantId) {
    throw new BadRequestException('beautyAnnotationId beautyRecord tenant mismatch');
  }
  if (expectedPatientId && row.beautyRecord.patientId !== expectedPatientId) {
    throw new BadRequestException('beautyAnnotationId patient does not match patientId');
  }
  return row;
}

export function assertControlledDeviceType(deviceType: string): string {
  const t = deviceType?.trim().toLowerCase();
  if (!t) throw new BadRequestException('deviceType is required');
  if (!DEVICE_TYPE_SCHEMA_REGISTRY[t]) {
    throw new BadRequestException(
      `deviceType must be a controlled type (${CONTROLLED_DEVICE_TYPES.join(', ')})`,
    );
  }
  return t;
}

export function assertDeviceTypeSchemaKey(deviceType: string, key: string): string {
  const t = assertControlledDeviceType(deviceType);
  const k = key?.trim();
  if (!k) throw new BadRequestException('parameterSchemaKey is required');
  const allowed = DEVICE_TYPE_SCHEMA_REGISTRY[t] ?? [];
  if (!allowed.includes(k)) {
    throw new BadRequestException(
      `parameterSchemaKey '${k}' is not valid for deviceType '${t}' (allowed: ${allowed.join(', ')})`,
    );
  }
  return k;
}

/** @deprecated use assertDeviceTypeSchemaKey — kept for unit tests of key presence */
export function assertParameterSchemaKey(key: string): string {
  const k = key?.trim();
  if (!k) throw new BadRequestException('parameterSchemaKey is required');
  const all = Object.values(DEVICE_TYPE_SCHEMA_REGISTRY).flat();
  if (!all.includes(k)) {
    throw new BadRequestException(
      `parameterSchemaKey must be a registered device schema key (${all.join(', ')})`,
    );
  }
  return k;
}

export function assertPlannedSessions(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw new BadRequestException('plannedSessions must be an integer between 1 and 100');
  }
  return n;
}

export function assertIntervalBounds(min?: number | null, max?: number | null) {
  if (min != null && (!Number.isInteger(min) || min < 0)) {
    throw new BadRequestException('intervalMinDays must be a non-negative integer');
  }
  if (max != null && (!Number.isInteger(max) || max < 0)) {
    throw new BadRequestException('intervalMaxDays must be a non-negative integer');
  }
  if (min != null && max != null && min > max) {
    throw new BadRequestException('intervalMinDays must be <= intervalMaxDays');
  }
}

/** Signed UTC calendar-day delta: later - earlier. Positive when later is after earlier. */
export function signedCalendarDaysBetween(earlier: Date, later: Date): number {
  const utcA = Date.UTC(earlier.getUTCFullYear(), earlier.getUTCMonth(), earlier.getUTCDate());
  const utcB = Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate());
  return Math.floor((utcB - utcA) / (24 * 60 * 60 * 1000));
}

/**
 * R3-B2 — Enforce:
 * A) strict timestamp chronology (later sequence strictly after earlier timestamp)
 * B) signed UTC calendar-day delta against intervalMinDays / intervalMaxDays
 *
 * Separated so intervalMinDays=0 allows same UTC calendar day when timestamps differ.
 * previousTimestamp < currentTimestamp < nextTimestamp where neighbors exist.
 * No Math.abs.
 */
export async function assertCourseSessionInterval(
  tx: Db,
  params: {
    courseId: string;
    tenantId: string;
    sessionSequence: number;
    newAppointmentStart: Date;
    intervalMinDays?: number | null;
    intervalMaxDays?: number | null;
    excludeAppointmentId?: string | null;
  },
) {
  const min = params.intervalMinDays ?? null;
  const max = params.intervalMaxDays ?? null;

  const exclude =
    params.excludeAppointmentId != null
      ? { NOT: { appointmentId: params.excludeAppointmentId } }
      : {};

  const priorSessions = await tx.courseSession.findMany({
    where: {
      courseId: params.courseId,
      tenantId: params.tenantId,
      deletedAt: null,
      sequence: { lt: params.sessionSequence },
      appointmentId: { not: null },
      ...exclude,
    },
    orderBy: { sequence: 'desc' },
    take: 1,
  });
  const nextSessions = await tx.courseSession.findMany({
    where: {
      courseId: params.courseId,
      tenantId: params.tenantId,
      deletedAt: null,
      sequence: { gt: params.sessionSequence },
      appointmentId: { not: null },
      ...exclude,
    },
    orderBy: { sequence: 'asc' },
    take: 1,
  });

  const prior = priorSessions[0];
  if (prior?.appointmentId) {
    const priorAppt = await tx.appointment.findFirst({
      where: { id: prior.appointmentId, tenantId: params.tenantId },
      select: { scheduledStart: true },
    });
    if (!priorAppt) {
      throw new BadRequestException('Prior course session appointment not found');
    }
    // A — timestamp chronology (not calendar-day alone)
    if (!(params.newAppointmentStart.getTime() > priorAppt.scheduledStart.getTime())) {
      throw new BadRequestException(
        `Course session sequence ${params.sessionSequence} must be strictly after prior sequence ${prior.sequence} timestamp`,
      );
    }
    // B — calendar-day interval bounds
    const days = signedCalendarDaysBetween(priorAppt.scheduledStart, params.newAppointmentStart);
    if (min != null && days < min) {
      throw new BadRequestException(
        `Course session interval ${days}d is below intervalMinDays ${min} vs prior sequence`,
      );
    }
    if (max != null && days > max) {
      throw new BadRequestException(
        `Course session interval ${days}d is above intervalMaxDays ${max} vs prior sequence`,
      );
    }
  }

  const next = nextSessions[0];
  if (next?.appointmentId) {
    const nextAppt = await tx.appointment.findFirst({
      where: { id: next.appointmentId, tenantId: params.tenantId },
      select: { scheduledStart: true },
    });
    if (!nextAppt) {
      throw new BadRequestException('Next course session appointment not found');
    }
    if (!(nextAppt.scheduledStart.getTime() > params.newAppointmentStart.getTime())) {
      throw new BadRequestException(
        `Course session sequence ${params.sessionSequence} must be strictly before next sequence ${next.sequence} timestamp`,
      );
    }
    const days = signedCalendarDaysBetween(params.newAppointmentStart, nextAppt.scheduledStart);
    if (min != null && days < min) {
      throw new BadRequestException(
        `Course session interval ${days}d is below intervalMinDays ${min} vs next sequence`,
      );
    }
    if (max != null && days > max) {
      throw new BadRequestException(
        `Course session interval ${days}d is above intervalMaxDays ${max} vs next sequence`,
      );
    }
  }
}

/**
 * When an appointment is rescheduled, re-validate intervals for any CourseSession link
 * against both previous and next neighbors.
 */
export async function assertCourseIntervalsForReschedule(
  tx: Db,
  tenantId: string,
  appointmentId: string,
  newStart: Date,
) {
  const session = await tx.courseSession.findFirst({
    where: { appointmentId, tenantId, deletedAt: null },
    include: { course: true },
  });
  if (!session) return;
  await assertCourseSessionInterval(tx, {
    courseId: session.courseId,
    tenantId,
    sessionSequence: session.sequence,
    newAppointmentStart: newStart,
    intervalMinDays: session.course.intervalMinDays,
    intervalMaxDays: session.course.intervalMaxDays,
    excludeAppointmentId: appointmentId,
  });
}

export function assertDermatologyServiceEligibility(service: {
  domain?: string | null;
  categoryKey?: string | null;
}) {
  const category = String(service.categoryKey ?? '')
    .trim()
    .toLowerCase();
  if (category !== DERMATOLOGY_CATEGORY_KEY) {
    throw new BadRequestException(
      `Dermatology encounter requires ClinicalService categoryKey '${DERMATOLOGY_CATEGORY_KEY}' (got '${service.categoryKey ?? ''}')`,
    );
  }
  if (String(service.domain) === 'DENTAL') {
    throw new BadRequestException('Dermatology encounter cannot use DENTAL clinical service');
  }
}

/**
 * Opaque external device identifier — not an internal FK.
 * Accepts non-empty string up to 120 chars; UUID shape allowed but not required.
 */
export function assertOpaqueExternalDeviceId(deviceId?: string | null): string | null {
  if (deviceId == null || deviceId === '') return null;
  const v = String(deviceId).trim();
  if (!v) return null;
  if (v.length > 120) {
    throw new BadRequestException('deviceId external identifier max length is 120');
  }
  return v;
}

/** @deprecated — alias of signedCalendarDaysBetween (signed; no Math.abs). */
export function daysBetweenAppointments(a: Date, b: Date): number {
  return signedCalendarDaysBetween(a, b);
}
