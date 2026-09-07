import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';

/** Closed owner-type contract for MediaAsset (schema comment + production usage). */
export const MEDIA_OWNER_TYPES = [
  'patient',
  'encounter',
  'appointment',
  'beauty_service',
  'invoice',
  'dental_chart',
] as const;

export type MediaOwnerType = (typeof MEDIA_OWNER_TYPES)[number];

type PrismaLike = Pick<
  PrismaService,
  'patient' | 'encounter' | 'appointment' | 'beautyRecord' | 'invoice'
>;

export async function assertMediaOwnerReference(
  prisma: PrismaLike,
  tenantId: string,
  ownerType: string,
  ownerId: string,
  ctx: { patientId?: string | null; encounterId?: string | null },
): Promise<void> {
  const normalizedType = ownerType?.trim().toLowerCase();
  if (!normalizedType) {
    throw new BadRequestException('ownerType is required');
  }
  if (!MEDIA_OWNER_TYPES.includes(normalizedType as MediaOwnerType)) {
    throw new BadRequestException(`Unsupported ownerType: ${ownerType}`);
  }
  if (!ownerId?.trim()) {
    throw new BadRequestException('ownerId is required');
  }

  const patientId = ctx.patientId?.trim() || null;
  const encounterId = ctx.encounterId?.trim() || null;

  switch (normalizedType as MediaOwnerType) {
    case 'patient': {
      const patient = await prisma.patient.findFirst({
        where: { id: ownerId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!patient) {
        throw new NotFoundException('ownerId does not belong to the current tenant');
      }
      if (patientId && patientId !== ownerId) {
        throw new BadRequestException('ownerId must match patientId for patient ownerType');
      }
      break;
    }
    case 'encounter': {
      const encounter = await prisma.encounter.findFirst({
        where: { id: ownerId, tenantId, deletedAt: null },
        select: { id: true, patientId: true },
      });
      if (!encounter) {
        throw new NotFoundException('ownerId does not belong to the current tenant');
      }
      if (patientId && encounter.patientId !== patientId) {
        throw new BadRequestException('encounter owner patient does not match patientId');
      }
      if (encounterId && encounterId !== ownerId) {
        throw new BadRequestException('ownerId must match encounterId for encounter ownerType');
      }
      break;
    }
    case 'appointment': {
      const appointment = await prisma.appointment.findFirst({
        where: { id: ownerId, tenantId, deletedAt: null },
        select: { id: true, patientId: true },
      });
      if (!appointment) {
        throw new NotFoundException('ownerId does not belong to the current tenant');
      }
      if (patientId && appointment.patientId !== patientId) {
        throw new BadRequestException('appointment owner patient does not match patientId');
      }
      break;
    }
    case 'beauty_service': {
      const record = await prisma.beautyRecord.findFirst({
        where: { id: ownerId, tenantId },
        select: { id: true, patientId: true },
      });
      if (!record) {
        throw new NotFoundException('ownerId does not belong to the current tenant');
      }
      if (patientId && record.patientId !== patientId) {
        throw new BadRequestException('beauty_service owner patient does not match patientId');
      }
      break;
    }
    case 'invoice': {
      const invoice = await prisma.invoice.findFirst({
        where: { id: ownerId, tenantId, deletedAt: null },
        select: { id: true, patientId: true },
      });
      if (!invoice) {
        throw new NotFoundException('ownerId does not belong to the current tenant');
      }
      if (patientId && invoice.patientId && invoice.patientId !== patientId) {
        throw new BadRequestException('invoice owner patient does not match patientId');
      }
      break;
    }
    case 'dental_chart': {
      const patient = await prisma.patient.findFirst({
        where: { id: ownerId, tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!patient) {
        throw new NotFoundException('ownerId does not belong to the current tenant');
      }
      if (patientId && patientId !== ownerId) {
        throw new BadRequestException('dental_chart ownerId must match patientId when patientId is supplied');
      }
      break;
    }
    default:
      throw new BadRequestException(`Unsupported ownerType: ${ownerType}`);
  }
}
