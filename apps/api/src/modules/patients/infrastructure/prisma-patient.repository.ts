import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Patient } from '../domain/patient.entity';
import {
  PatientRepository,
  PatientUpdateInput,
} from '../domain/patient.repository.interface';
import { PatientNameVO } from '../domain/patient-name.vo';
import { AddressVO } from '../domain/address.vo';
import type {
  PatientDetailRecord,
  PatientDuplicateCandidate,
  PatientListFilter,
  PatientListItem,
  PatientProfileData,
  PatientTimelineEntry,
} from '../domain/patient.types';

type PrismaPatientRow = {
  id: string;
  tenantId: string;
  branchId: string | null;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  nationalId: string | null;
  bloodGroup: string | null;
  notes: string | null;
  profileData: unknown;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  addresses: Array<{
    id: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string | null;
    country: string;
    isPrimary: boolean;
  }>;
};

@Injectable()
export class PrismaPatientRepository implements PatientRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(patient: Patient): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.patient.upsert({
        where: { id: patient.id },
        create: {
          id: patient.id,
          tenantId: patient.tenantId,
          branchId: patient.branchId,
          firstName: patient.name.firstName,
          lastName: patient.name.lastName,
          firstNameAr: patient.firstNameAr,
          lastNameAr: patient.lastNameAr,
          dateOfBirth: patient.dateOfBirth ? new Date(patient.dateOfBirth) : null,
          gender: patient.gender,
          phone: patient.phone,
          email: patient.email,
          nationalId: patient.nationalId,
          bloodGroup: patient.bloodGroup,
          notes: patient.notes,
          profileData: patient.profileData as Prisma.InputJsonValue,
          createdAt: patient.createdAt,
        },
        update: {
          firstName: patient.name.firstName,
          lastName: patient.name.lastName,
          firstNameAr: patient.firstNameAr,
          lastNameAr: patient.lastNameAr,
          dateOfBirth: patient.dateOfBirth ? new Date(patient.dateOfBirth) : null,
          gender: patient.gender,
          phone: patient.phone,
          email: patient.email,
          nationalId: patient.nationalId,
          bloodGroup: patient.bloodGroup,
          notes: patient.notes,
          profileData: patient.profileData as Prisma.InputJsonValue,
          updatedAt: patient.updatedAt ?? new Date(),
        },
      });

      await tx.patientAddress.deleteMany({ where: { patientId: patient.id } });
      if (patient.addresses.length > 0) {
        await tx.patientAddress.createMany({
          data: patient.addresses.map((a, index) => ({
            patientId: patient.id,
            line1: a.line1,
            line2: null,
            city: a.city,
            state: a.state,
            postalCode: a.postalCode,
            country: a.country ?? 'SY',
            isPrimary: index === 0,
          })),
        });
      }
    });
  }

  async findById(id: string, tenantId: string): Promise<Patient | null> {
    const row = await this.prisma.patient.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { addresses: true },
    });
    return row ? this.toDomain(row as PrismaPatientRow) : null;
  }

  async findByIdentifier(identifier: string, tenantId: string): Promise<Patient | null> {
    const row = await this.prisma.patient.findFirst({
      where: { tenantId, deletedAt: null, nationalId: identifier.trim() },
      include: { addresses: true },
    });
    return row ? this.toDomain(row as PrismaPatientRow) : null;
  }

  async findDetailById(id: string, tenantId: string): Promise<PatientDetailRecord | null> {
    const row = await this.prisma.patient.findFirst({
      where: { id, tenantId },
      include: { addresses: { orderBy: { isPrimary: 'desc' } } },
    });
    return row ? this.toDetail(row as PrismaPatientRow) : null;
  }

  async list(filter: PatientListFilter): Promise<{ items: PatientListItem[]; total: number }> {
    const where: Prisma.PatientWhereInput = { tenantId: filter.tenantId };

    if (filter.branchId) where.branchId = filter.branchId;
    if (filter.status === 'active') where.deletedAt = null;
    if (filter.status === 'archived') where.deletedAt = { not: null };
    if (filter.gender) where.gender = filter.gender;

    const q = filter.q?.trim();
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { firstNameAr: { contains: q, mode: 'insensitive' } },
        { lastNameAr: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { nationalId: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filter.offset,
        take: filter.limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          firstNameAr: true,
          lastNameAr: true,
          phone: true,
          email: true,
          dateOfBirth: true,
          gender: true,
          nationalId: true,
          bloodGroup: true,
          createdAt: true,
          deletedAt: true,
          appointments: {
            orderBy: { scheduledStart: 'desc' },
            take: 1,
            select: { scheduledStart: true },
          },
          encounters: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    const items: PatientListItem[] = rows.map((row) => {
      const lastAppt = row.appointments[0]?.scheduledStart ?? null;
      const lastEnc = row.encounters[0]?.createdAt ?? null;
      const lastVisitAt =
        lastAppt && lastEnc
          ? lastAppt > lastEnc
            ? lastAppt
            : lastEnc
          : lastAppt ?? lastEnc;

      return {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        firstNameAr: row.firstNameAr,
        lastNameAr: row.lastNameAr,
        phone: row.phone,
        email: row.email,
        dateOfBirth: row.dateOfBirth ? row.dateOfBirth.toISOString().split('T')[0] : null,
        gender: (row.gender as PatientListItem['gender']) ?? null,
        nationalId: row.nationalId,
        bloodGroup: row.bloodGroup,
        createdAt: row.createdAt,
        archived: row.deletedAt != null,
        lastVisitAt,
      };
    });

    return { items, total };
  }

  async update(
    id: string,
    tenantId: string,
    input: PatientUpdateInput,
  ): Promise<PatientDetailRecord | null> {
    const existing = await this.prisma.patient.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) return null;

    await this.prisma.$transaction(async (tx) => {
      await tx.patient.update({
        where: { id },
        data: {
          firstName: input.firstName ?? undefined,
          lastName: input.lastName ?? undefined,
          firstNameAr: input.firstNameAr ?? undefined,
          lastNameAr: input.lastNameAr ?? undefined,
          dateOfBirth:
            input.dateOfBirth === null
              ? null
              : input.dateOfBirth
                ? new Date(input.dateOfBirth)
                : undefined,
          gender: input.gender ?? undefined,
          phone: input.phone ?? undefined,
          email: input.email ?? undefined,
          nationalId: input.nationalId ?? undefined,
          bloodGroup: input.bloodGroup ?? undefined,
          notes: input.notes ?? undefined,
          branchId: input.branchId ?? undefined,
          profileData:
            input.profileData !== undefined
              ? (input.profileData as Prisma.InputJsonValue)
              : undefined,
        },
      });

      if (input.addressLine1 !== undefined || input.city !== undefined) {
        await tx.patientAddress.deleteMany({ where: { patientId: id } });
        if (input.addressLine1 && input.city) {
          await tx.patientAddress.create({
            data: {
              patientId: id,
              line1: input.addressLine1,
              city: input.city,
              state: input.state ?? null,
              postalCode: input.postalCode ?? null,
              country: input.country ?? 'SY',
              isPrimary: true,
            },
          });
        }
      }
    });

    return this.findDetailById(id, tenantId);
  }

  async archive(id: string, tenantId: string): Promise<boolean> {
    const result = await this.prisma.patient.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count > 0;
  }

  async reactivate(id: string, tenantId: string): Promise<boolean> {
    const result = await this.prisma.patient.updateMany({
      where: { id, tenantId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return result.count > 0;
  }

  async findDuplicates(id: string, tenantId: string): Promise<PatientDuplicateCandidate[]> {
    const patient = await this.prisma.patient.findFirst({
      where: { id, tenantId },
    });
    if (!patient) return [];

    const candidates = await this.prisma.patient.findMany({
      where: {
        tenantId,
        id: { not: id },
        deletedAt: null,
        OR: [
          ...(patient.phone ? [{ phone: patient.phone }] : []),
          ...(patient.nationalId ? [{ nationalId: patient.nationalId }] : []),
          ...(patient.email ? [{ email: patient.email }] : []),
          {
            firstName: { equals: patient.firstName, mode: 'insensitive' as const },
            lastName: { equals: patient.lastName, mode: 'insensitive' as const },
            ...(patient.dateOfBirth ? { dateOfBirth: patient.dateOfBirth } : {}),
          },
        ],
      },
      take: 10,
    });

    return candidates.map((c) => {
      const reasons: string[] = [];
      let score = 0;
      if (patient.phone && c.phone === patient.phone) {
        reasons.push('phone');
        score += 40;
      }
      if (patient.nationalId && c.nationalId === patient.nationalId) {
        reasons.push('nationalId');
        score += 50;
      }
      if (patient.email && c.email === patient.email) {
        reasons.push('email');
        score += 30;
      }
      if (
        c.firstName.toLowerCase() === patient.firstName.toLowerCase() &&
        c.lastName.toLowerCase() === patient.lastName.toLowerCase()
      ) {
        reasons.push('name');
        score += 20;
        if (patient.dateOfBirth && c.dateOfBirth?.getTime() === patient.dateOfBirth.getTime()) {
          reasons.push('dateOfBirth');
          score += 30;
        }
      }

      return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        nationalId: c.nationalId,
        dateOfBirth: c.dateOfBirth ? c.dateOfBirth.toISOString().split('T')[0] : null,
        matchScore: Math.min(score, 100),
        matchReasons: reasons,
      };
    }).sort((a, b) => b.matchScore - a.matchScore);
  }

  async merge(
    tenantId: string,
    targetId: string,
    sourceId: string,
  ): Promise<{ targetId: string; archivedSourceId: string }> {
    const [target, source] = await Promise.all([
      this.prisma.patient.findFirst({ where: { id: targetId, tenantId, deletedAt: null } }),
      this.prisma.patient.findFirst({ where: { id: sourceId, tenantId, deletedAt: null } }),
    ]);
    if (!target || !source) throw new Error('Patient not found for merge');

    const sourceProfile = (source.profileData ?? {}) as PatientProfileData;

    await this.prisma.$transaction(async (tx) => {
      await tx.appointment.updateMany({ where: { patientId: sourceId, tenantId }, data: { patientId: targetId } });
      await tx.encounter.updateMany({ where: { patientId: sourceId, tenantId }, data: { patientId: targetId } });
      await tx.invoice.updateMany({ where: { patientId: sourceId, tenantId }, data: { patientId: targetId } });
      await tx.queueTicket.updateMany({ where: { patientId: sourceId, tenantId }, data: { patientId: targetId } });
      await tx.mediaAsset.updateMany({ where: { patientId: sourceId, tenantId }, data: { patientId: targetId } });
      await tx.treatmentPlan.updateMany({ where: { patientId: sourceId, tenantId }, data: { patientId: targetId } });
      await tx.periodontalExam.updateMany({ where: { patientId: sourceId, tenantId }, data: { patientId: targetId } });
      await tx.commissionCalculation.updateMany({
        where: { patientId: sourceId, tenantId },
        data: { patientId: targetId },
      });
      await tx.clinicSubscription.updateMany({
        where: { customerId: sourceId, tenantId },
        data: { customerId: targetId },
      });

      const targetDental = await tx.dentalRecord.findUnique({ where: { patientId: targetId } });
      if (!targetDental) {
        await tx.dentalRecord.updateMany({ where: { patientId: sourceId, tenantId }, data: { patientId: targetId } });
      } else {
        await tx.dentalRecord.deleteMany({ where: { patientId: sourceId, tenantId } });
      }

      const targetBeauty = await tx.beautyRecord.findUnique({ where: { patientId: targetId } });
      if (!targetBeauty) {
        await tx.beautyRecord.updateMany({ where: { patientId: sourceId, tenantId }, data: { patientId: targetId } });
      } else {
        await tx.beautyRecord.deleteMany({ where: { patientId: sourceId, tenantId } });
      }

      const targetLoyalty = await tx.loyaltyAccount.findUnique({ where: { patientId: targetId } });
      if (!targetLoyalty) {
        await tx.loyaltyAccount.updateMany({ where: { patientId: sourceId, tenantId }, data: { patientId: targetId } });
      }

      const targetPortal = await tx.portalAccount.findUnique({ where: { patientId: targetId } });
      if (!targetPortal) {
        await tx.portalAccount.updateMany({ where: { patientId: sourceId, tenantId }, data: { patientId: targetId } });
      }

      await tx.patientAddress.updateMany({ where: { patientId: sourceId }, data: { patientId: targetId } });

      await tx.patient.update({
        where: { id: targetId },
        data: {
          phone: target.phone ?? source.phone,
          email: target.email ?? source.email,
          nationalId: target.nationalId ?? source.nationalId,
          bloodGroup: target.bloodGroup ?? source.bloodGroup,
          branchId: target.branchId ?? source.branchId,
          notes: [target.notes, source.notes].filter(Boolean).join('\n---\n') || null,
          profileData: {
            ...((target.profileData ?? {}) as PatientProfileData),
            ...Object.fromEntries(
              Object.entries((source.profileData ?? {}) as PatientProfileData).filter(
                ([key, value]) =>
                  key !== 'mergedIntoId' &&
                  value != null &&
                  ((target.profileData ?? {}) as PatientProfileData)[key as keyof PatientProfileData] == null,
              ),
            ),
          } as Prisma.InputJsonValue,
        },
      });

      await tx.patient.update({
        where: { id: sourceId },
        data: {
          deletedAt: new Date(),
          profileData: {
            ...sourceProfile,
            mergedIntoId: targetId,
          } as Prisma.InputJsonValue,
        },
      });
    });

    return { targetId, archivedSourceId: sourceId };
  }

  async getTimeline(id: string, tenantId: string, limit = 50): Promise<PatientTimelineEntry[]> {
    const patient = await this.prisma.patient.findFirst({ where: { id, tenantId } });
    if (!patient) return [];

    const [appointments, encounters, invoices, media, perioExams, treatmentItems, auditEntries] =
      await Promise.all([
      this.prisma.appointment.findMany({
        where: { patientId: id, tenantId },
        orderBy: { scheduledStart: 'desc' },
        take: limit,
      }),
      this.prisma.encounter.findMany({
        where: { patientId: id, tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.invoice.findMany({
        where: { patientId: id, tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.mediaAsset.findMany({
        where: { patientId: id, tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.periodontalExam.findMany({
        where: { patientId: id, tenantId },
        orderBy: { examDate: 'desc' },
        take: limit,
      }),
      this.prisma.treatmentPlanItem.findMany({
        where: {
          tenantId,
          status: 'COMPLETED',
          phase: { plan: { patientId: id } },
        },
        include: { phase: { include: { plan: true } } },
        orderBy: { completedAt: 'desc' },
        take: limit,
      }),
      this.prisma.auditEntry.findMany({
        where: { tenantId, resourceType: 'patient', resourceId: id },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const entries: PatientTimelineEntry[] = [
      ...appointments.map((a) => ({
        id: a.id,
        type: 'appointment' as const,
        title: 'Appointment',
        subtitle: a.notes,
        occurredAt: a.scheduledStart.toISOString(),
        status: a.status,
        metadata: { providerId: a.providerId },
      })),
      ...encounters.map((e) => ({
        id: e.id,
        type: 'encounter' as const,
        title: 'Clinical encounter',
        subtitle: e.chiefComplaint,
        occurredAt: e.createdAt.toISOString(),
        status: e.status ? String(e.status).toLowerCase() : null,
        metadata: { clinicianId: e.clinicianId },
      })),
      ...invoices.map((i) => ({
        id: i.id,
        type: 'invoice' as const,
        title: 'Invoice',
        subtitle: i.invoiceNumber,
        occurredAt: i.createdAt.toISOString(),
        status: i.status,
        metadata: { totalAmount: i.amountTotal.toString() },
      })),
      ...media.map((m) => {
        const meta = (m.metadata ?? {}) as {
          clinical?: { title?: string; imagingType?: string; encounterId?: string };
        };
        const isDental = m.category === 'DENTAL_IMAGE';
        if (isDental) {
          return {
            id: m.id,
            type: 'imaging' as const,
            title: meta.clinical?.title ?? m.originalFilename ?? 'Dental image',
            subtitle: meta.clinical?.imagingType ?? null,
            occurredAt: m.createdAt.toISOString(),
            status: m.status,
            metadata: {
              category: 'dental_image',
              imagingType: meta.clinical?.imagingType,
              encounterId: meta.clinical?.encounterId,
              mimeType: m.mimeType,
            },
          };
        }
        return {
          id: m.id,
          type: 'document' as const,
          title: m.originalFilename ?? 'Document',
          subtitle: m.category,
          occurredAt: m.createdAt.toISOString(),
          status: m.status,
          metadata: { mimeType: m.mimeType, category: m.category },
        };
      }),
      ...perioExams.map((e) => {
        const data = (e.chartData ?? {}) as { summary?: { stage?: string; bopPercent?: number } };
        return {
          id: e.id,
          type: 'perio' as const,
          title: 'Periodontal exam',
          subtitle: data.summary?.stage ?? null,
          occurredAt: e.examDate.toISOString(),
          status: data.summary?.stage ?? null,
          metadata: {
            bopPercent: data.summary?.bopPercent,
            examId: e.id,
          },
        };
      }),
      ...treatmentItems.map((item) => ({
        id: item.id,
        type: 'treatment' as const,
        title: item.description,
        subtitle: item.code,
        occurredAt: (item.completedAt ?? item.phase.plan.updatedAt).toISOString(),
        status: item.status,
        metadata: {
          planId: item.phase.planId,
          planTitle: item.phase.plan.title,
          encounterId: item.encounterId,
        },
      })),
      ...auditEntries.map((entry) => ({
        id: entry.id,
        type: 'audit' as const,
        title: entry.action,
        subtitle: entry.descriptionEn ?? entry.category,
        occurredAt: entry.createdAt.toISOString(),
        status: entry.category,
        metadata: {
          actorId: entry.actorId,
          changes: entry.changes,
        },
      })),
    ];

    for (const e of encounters) {
      const diagnoses = (e.diagnoses ?? []) as Array<{ code?: string; description?: string; system?: string }>;
      diagnoses.forEach((dx, idx) => {
        entries.push({
          id: `${e.id}-dx-${idx}`,
          type: 'diagnosis',
          title: dx.description ?? dx.code ?? 'Diagnosis',
          subtitle: dx.code ?? null,
          occurredAt: e.createdAt.toISOString(),
          status: dx.system ?? null,
          metadata: { encounterId: e.id },
        });
      });

      const medications = (e.medications ?? []) as Array<{
        name?: string;
        dose?: string;
        dosage?: string;
        frequency?: string;
      }>;
      medications.forEach((med, idx) => {
        entries.push({
          id: `${e.id}-rx-${idx}`,
          type: 'prescription',
          title: med.name ?? 'Medication',
          subtitle: [med.dose ?? med.dosage, med.frequency].filter(Boolean).join(' · ') || null,
          occurredAt: e.createdAt.toISOString(),
          status: null,
          metadata: { encounterId: e.id },
        });
      });
    }

    entries.push({
      id: `audit-created-${patient.id}`,
      type: 'audit',
      title: 'Patient registered',
      subtitle: null,
      occurredAt: patient.createdAt.toISOString(),
      status: 'registration',
      metadata: {},
    });

    if (patient.deletedAt) {
      entries.push({
        id: `audit-archived-${patient.id}`,
        type: 'audit',
        title: 'Patient archived',
        subtitle: null,
        occurredAt: patient.deletedAt.toISOString(),
        status: 'archive',
        metadata: {},
      });
    }

    if (patient.notes) {
      entries.push({
        id: `note-${patient.id}`,
        type: 'note',
        title: 'Patient note',
        subtitle: patient.notes.slice(0, 120),
        occurredAt: patient.updatedAt.toISOString(),
        status: null,
      });
    }

    return entries
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, limit);
  }

  private toDomain(row: PrismaPatientRow): Patient {
    const name = new PatientNameVO(row.firstName, row.lastName);
    const addresses = (row.addresses ?? []).map(
      (a) =>
        new AddressVO(
          a.line1,
          a.city,
          a.state,
          a.postalCode,
          a.country ?? null,
        ),
    );

    const patient = new Patient(
      row.id,
      row.tenantId,
      row.branchId,
      name,
      row.dateOfBirth ? row.dateOfBirth.toISOString().split('T')[0] : null,
      (row.gender as 'male' | 'female' | 'other' | null) ?? null,
      addresses,
      row.createdAt,
    );
    patient.firstNameAr = row.firstNameAr;
    patient.lastNameAr = row.lastNameAr;
    patient.phone = row.phone;
    patient.email = row.email;
    patient.nationalId = row.nationalId;
    patient.bloodGroup = row.bloodGroup;
    patient.notes = row.notes;
    patient.profileData = (row.profileData ?? {}) as PatientProfileData;
    return patient;
  }

  private toDetail(row: PrismaPatientRow): PatientDetailRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      firstName: row.firstName,
      lastName: row.lastName,
      firstNameAr: row.firstNameAr,
      lastNameAr: row.lastNameAr,
      dateOfBirth: row.dateOfBirth ? row.dateOfBirth.toISOString().split('T')[0] : null,
      gender: (row.gender as PatientDetailRecord['gender']) ?? null,
      phone: row.phone,
      email: row.email,
      nationalId: row.nationalId,
      bloodGroup: row.bloodGroup,
      notes: row.notes,
      profileData: (row.profileData ?? {}) as PatientProfileData,
      addresses: (row.addresses ?? []).map((a) => ({
        id: a.id,
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        state: a.state,
        postalCode: a.postalCode,
        country: a.country,
        isPrimary: a.isPrimary,
      })),
      archived: row.deletedAt != null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
