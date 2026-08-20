import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const PLAN_LINK_ROLES = ['PRIMARY', 'SUPPORTING'] as const;
export const LAB_STATUSES = ['DRAFT', 'SENT', 'IN_LAB', 'RECEIVED', 'SEATED', 'CANCELLED'] as const;
export const LAB_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['IN_LAB', 'RECEIVED', 'CANCELLED'],
  IN_LAB: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['SEATED', 'CANCELLED'],
  SEATED: [],
  CANCELLED: [],
};

export function assertUuid(value: string, field: string): string {
  const v = value?.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) {
    throw new BadRequestException(`${field} must be a UUID`);
  }
  return v;
}

type Db = Prisma.TransactionClient | {
  patient: { findFirst: Function };
  appointment: { findFirst: Function };
  encounter: { findFirst: Function };
  treatmentPlanItem: { findFirst: Function };
  user: { findFirst: Function };
  mediaAsset: { findFirst: Function };
  canonicalClinicalServiceDefinition: { findFirst: Function };
  branch: { findFirst: Function };
  tenant: { findFirst: Function };
  appointmentServiceSnapshotRevision: { findFirst: Function };
};

export async function assertTenantPatient(db: Db, tenantId: string, patientId: string) {
  const row = await db.patient.findFirst({
    where: { id: patientId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!row) throw new NotFoundException('Patient not found');
  return row;
}

export async function assertTenantAppointment(db: Db, tenantId: string, appointmentId: string) {
  const row = await db.appointment.findFirst({
    where: { id: appointmentId, tenantId, deletedAt: null },
    select: {
      id: true,
      tenantId: true,
      branchId: true,
      patientId: true,
      clinicalServiceId: true,
      status: true,
      snapshotWriteMode: true,
    },
  });
  if (!row) throw new NotFoundException('Appointment not found');
  return row;
}

export async function assertTenantPlanItem(db: Db, tenantId: string, planItemId: string) {
  const row = await db.treatmentPlanItem.findFirst({
    where: { id: planItemId, tenantId },
    select: {
      id: true,
      tenantId: true,
      clinicalServiceId: true,
      status: true,
      dependsOnItemId: true,
      phase: { select: { planId: true, plan: { select: { patientId: true } } } },
    },
  });
  if (!row) throw new NotFoundException('Treatment plan item not found');
  return row;
}

export async function assertTenantUser(db: Db, tenantId: string, userId: string) {
  const row = await db.user.findFirst({
    where: { id: userId, tenantId, deletedAt: null },
    select: { id: true, isActive: true },
  });
  if (!row) throw new NotFoundException('User not found');
  return row;
}

export async function assertTenantBranch(db: Db, tenantId: string, branchId: string) {
  const row = await db.branch.findFirst({
    where: { id: branchId, tenantId, deletedAt: null },
    select: { id: true, tenantId: true },
  });
  if (!row) throw new BadRequestException('branchId does not belong to the current tenant');
  return row;
}

export async function assertTenantEncounter(db: Db, tenantId: string, encounterId: string) {
  const row = await db.encounter.findFirst({
    where: { id: encounterId, tenantId, deletedAt: null },
    select: {
      id: true,
      tenantId: true,
      patientId: true,
      appointmentId: true,
      branchId: true,
    },
  });
  if (!row) throw new BadRequestException('encounterId not found for tenant');
  return row;
}

export async function assertTenantSnapshotRevisionContext(
  db: Db,
  tenantId: string,
  snapshotRevisionId: string,
  context: {
    clinicalServiceId: string;
    appointmentId?: string | null;
    patientId?: string | null;
    branchId?: string | null;
    encounterId?: string | null;
  },
) {
  const snap = await db.appointmentServiceSnapshotRevision.findFirst({
    where: { id: snapshotRevisionId, tenantId },
    select: {
      id: true,
      clinicalServiceId: true,
      appointmentId: true,
      appointment: { select: { patientId: true, branchId: true } },
    },
  });
  if (!snap) throw new BadRequestException('snapshotRevisionId not found for tenant');
  if (snap.clinicalServiceId && snap.clinicalServiceId !== context.clinicalServiceId) {
    throw new BadRequestException(
      'snapshotRevisionId clinical service does not match clinicalServiceId',
    );
  }
  if (context.appointmentId && snap.appointmentId !== context.appointmentId) {
    throw new BadRequestException('snapshotRevisionId appointment does not match appointmentId');
  }
  if (snap.appointment) {
    if (context.patientId && snap.appointment.patientId !== context.patientId) {
      throw new BadRequestException('snapshotRevisionId patient context does not match patientId');
    }
    if (
      context.branchId &&
      snap.appointment.branchId &&
      snap.appointment.branchId !== context.branchId
    ) {
      throw new BadRequestException('snapshotRevisionId branch context does not match branchId');
    }
  }
  if (context.encounterId) {
    const encounter = await db.encounter.findFirst({
      where: { id: context.encounterId, tenantId },
      select: { appointmentId: true },
    });
    if (!encounter) throw new BadRequestException('encounterId not found for tenant');
    if (encounter.appointmentId && encounter.appointmentId !== snap.appointmentId) {
      throw new BadRequestException(
        'snapshotRevisionId appointment does not match encounterId appointment',
      );
    }
  }
  return snap;
}

export async function assertReadableClinicalService(
  db: Db,
  tenantId: string,
  clinicalServiceId: string,
) {
  const row = await db.canonicalClinicalServiceDefinition.findFirst({
    where: { id: clinicalServiceId },
    select: { id: true, tenantId: true, provenance: true },
  });
  if (!row) throw new BadRequestException('clinicalServiceId not found');
  const platformOk = row.tenantId == null && row.provenance === 'SYSTEM_CANONICAL';
  const tenantOk = row.tenantId === tenantId;
  if (!platformOk && !tenantOk) {
    throw new BadRequestException('clinicalServiceId does not belong to the current tenant');
  }
  return row;
}
