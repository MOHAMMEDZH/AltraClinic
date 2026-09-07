import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';

export const CLINICAL_FORM_KINDS = [
  'CONSENT',
  'PHOTO_CONSENT',
  'TREATMENT_CONSENT',
  'INTAKE',
  'PRE_CARE',
  'POST_CARE',
  'OTHER',
] as const;

export type ClinicalFormKind = (typeof CLINICAL_FORM_KINDS)[number];

export const CLINICAL_FORM_SIGN_METHODS = ['STAFF_WITNESSED', 'PATIENT_SELF'] as const;
export type ClinicalFormSignMethod = (typeof CLINICAL_FORM_SIGN_METHODS)[number];

type PrismaLike = Pick<
  PrismaService,
  'patient' | 'appointment' | 'canonicalClinicalServiceDefinition'
>;

export async function assertTenantPatient(
  prisma: PrismaLike,
  tenantId: string,
  patientId: string,
): Promise<{ id: string }> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!patient) throw new NotFoundException('Patient not found');
  return patient;
}

export async function assertCanonicalClinicalService(
  prisma: PrismaLike,
  tenantId: string,
  clinicalServiceId: string,
): Promise<{ id: string; tenantId: string | null; provenance: string }> {
  const service = await prisma.canonicalClinicalServiceDefinition.findFirst({
    where: { id: clinicalServiceId },
    select: { id: true, tenantId: true, provenance: true },
  });
  if (!service) throw new BadRequestException('clinicalServiceId not found');
  const platformOk = service.tenantId == null && service.provenance === 'SYSTEM_CANONICAL';
  const tenantOk = service.tenantId === tenantId;
  if (!platformOk && !tenantOk) {
    throw new BadRequestException('clinicalServiceId does not belong to the current tenant');
  }
  return service;
}

export async function assertTenantAppointment(
  prisma: PrismaLike,
  tenantId: string,
  appointmentId: string,
  ctx: { patientId: string; clinicalServiceId?: string | null },
): Promise<{ id: string; patientId: string; clinicalServiceId: string | null }> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, tenantId, deletedAt: null },
    select: { id: true, patientId: true, clinicalServiceId: true },
  });
  if (!appointment) {
    throw new BadRequestException('appointmentId does not belong to the current tenant');
  }
  if (appointment.patientId !== ctx.patientId) {
    throw new BadRequestException('appointmentId patient does not match patientId');
  }
  if (
    ctx.clinicalServiceId?.trim() &&
    appointment.clinicalServiceId &&
    appointment.clinicalServiceId !== ctx.clinicalServiceId
  ) {
    throw new BadRequestException('appointmentId clinical service does not match clinicalServiceId');
  }
  return appointment;
}
