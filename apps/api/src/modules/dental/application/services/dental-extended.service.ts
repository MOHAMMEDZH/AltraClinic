import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { generateEntityId } from '../../../../common/id-generator.util';

@Injectable()
export class DentalExtendedService {
  constructor(private readonly prisma: PrismaService) {}

  async getPatientSummary(tenantId: string, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        dentalRecord: { select: { id: true, odontogramMode: true, updatedAt: true, odontogramState: true } },
      },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const [plans, perioExams, orthoCases, implants, notes, invoices] = await Promise.all([
      this.prisma.treatmentPlan.count({ where: { tenantId, patientId } }),
      this.prisma.periodontalExam.count({ where: { tenantId, patientId } }),
      this.prisma.orthodonticCase.count({ where: { tenantId, patientId, status: 'ACTIVE' } }),
      this.prisma.implantRecord.count({ where: { tenantId, patientId, status: { in: ['PLANNED', 'PLACED'] } } }),
      this.prisma.dentalClinicalNote.count({ where: { tenantId, patientId } }),
      this.prisma.invoice.count({ where: { tenantId, patientId, deletedAt: null } }),
    ]);

    const state = patient.dentalRecord?.odontogramState as { teeth?: { status?: string }[]; procedures?: unknown[] } | null;
    const teeth = state?.teeth ?? [];
    const plannedTeeth = teeth.filter((t) => t.status === 'planned').length;
    const activePlan = await this.prisma.treatmentPlan.findFirst({
      where: { tenantId, patientId, status: { in: ['APPROVED', 'IN_PROGRESS'] } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, status: true, totalEstimatedCost: true },
    });

    return {
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`.trim(),
      dateOfBirth: patient.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      hasChart: Boolean(patient.dentalRecord),
      chartId: patient.dentalRecord?.id ?? null,
      odontogramMode: patient.dentalRecord?.odontogramMode?.toLowerCase() ?? 'adult',
      lastChartUpdate: patient.dentalRecord?.updatedAt.toISOString() ?? null,
      procedureCount: (state?.procedures ?? []).length,
      plannedTeeth,
      treatmentPlanCount: plans,
      activePlan,
      perioExamCount: perioExams,
      activeOrthoCases: orthoCases,
      activeImplants: implants,
      clinicalNoteCount: notes,
      invoiceCount: invoices,
    };
  }

  async getTimeline(tenantId: string, patientId: string, limit = 50) {
    const record = await this.prisma.dentalRecord.findFirst({ where: { tenantId, patientId } });
    const state = record?.odontogramState as { procedures?: { id?: string; code?: string; description?: string; performedAt?: string }[] } | null;
    const procedures = (state?.procedures ?? []).map((p, i) => ({
      id: p.id ?? `proc-${i}`,
      type: 'procedure' as const,
      title: p.description ?? p.code ?? 'Procedure',
      subtitle: p.code ?? null,
      occurredAt: p.performedAt ?? record?.updatedAt.toISOString() ?? new Date().toISOString(),
      metadata: { code: p.code },
    }));

    const [plans, perio, ortho, implants, notes, appointments, invoices, images] = await Promise.all([
      this.prisma.treatmentPlan.findMany({
        where: { tenantId, patientId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
      this.prisma.periodontalExam.findMany({
        where: { tenantId, patientId },
        orderBy: { examDate: 'desc' },
        take: limit,
        select: { id: true, examDate: true, chartData: true },
      }),
      this.prisma.orthodonticCase.findMany({
        where: { tenantId, patientId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: { id: true, applianceType: true, status: true, updatedAt: true },
      }),
      this.prisma.implantRecord.findMany({
        where: { tenantId, patientId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: { id: true, toothId: true, status: true, placedAt: true, updatedAt: true },
      }),
      this.prisma.dentalClinicalNote.findMany({
        where: { tenantId, patientId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, noteType: true, content: true, createdAt: true },
      }),
      this.prisma.appointment.findMany({
        where: { tenantId, patientId, deletedAt: null },
        orderBy: { scheduledStart: 'desc' },
        take: limit,
        select: { id: true, scheduledStart: true, status: true, serviceType: true },
      }),
      this.prisma.invoice.findMany({
        where: { tenantId, patientId, deletedAt: null },
        orderBy: { invoiceDate: 'desc' },
        take: limit,
        select: { id: true, invoiceNumber: true, invoiceDate: true, amountTotal: true, status: true },
      }),
      this.prisma.mediaAsset.findMany({
        where: { tenantId, patientId, ownerType: { in: ['dental_chart', 'patient'] } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, originalFilename: true, category: true, createdAt: true },
      }),
    ]);

    const entries = [
      ...procedures,
      ...plans.map((p) => ({
        id: p.id,
        type: 'treatment' as const,
        title: p.title,
        subtitle: p.status,
        occurredAt: p.updatedAt.toISOString(),
        metadata: { planId: p.id },
      })),
      ...perio.map((e) => ({
        id: e.id,
        type: 'perio' as const,
        title: 'Periodontal exam',
        subtitle: (e.chartData as { summary?: { stage?: string } })?.summary?.stage ?? null,
        occurredAt: e.examDate.toISOString(),
        metadata: { examId: e.id },
      })),
      ...ortho.map((o) => ({
        id: o.id,
        type: 'ortho' as const,
        title: o.applianceType,
        subtitle: o.status,
        occurredAt: o.updatedAt.toISOString(),
        metadata: { caseId: o.id },
      })),
      ...implants.map((im) => ({
        id: im.id,
        type: 'implant' as const,
        title: `Implant tooth ${im.toothId}`,
        subtitle: im.status,
        occurredAt: (im.placedAt ?? im.updatedAt).toISOString(),
        metadata: { implantId: im.id },
      })),
      ...notes.map((n) => ({
        id: n.id,
        type: 'dental_note' as const,
        title: n.noteType,
        subtitle: n.content.slice(0, 80),
        occurredAt: n.createdAt.toISOString(),
        metadata: { noteId: n.id },
      })),
      ...appointments.map((a) => ({
        id: a.id,
        type: 'appointment' as const,
        title: a.serviceType ?? 'Dental appointment',
        subtitle: a.status,
        occurredAt: a.scheduledStart.toISOString(),
        metadata: { appointmentId: a.id },
      })),
      ...invoices.map((inv) => ({
        id: inv.id,
        type: 'invoice' as const,
        title: inv.invoiceNumber,
        subtitle: `${inv.status} · ${inv.amountTotal.toNumber()}`,
        occurredAt: inv.invoiceDate.toISOString(),
        metadata: { invoiceId: inv.id },
      })),
      ...images.map((img) => ({
        id: img.id,
        type: 'imaging' as const,
        title: img.originalFilename,
        subtitle: String(img.category),
        occurredAt: img.createdAt.toISOString(),
        metadata: { assetId: img.id },
      })),
    ];

    return entries
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, limit);
  }

  async listOrthoCases(tenantId: string, patientId: string) {
    const rows = await this.prisma.orthodonticCase.findMany({
      where: { tenantId, patientId },
      orderBy: { updatedAt: 'desc' },
    });
    return { items: rows.map((r) => this.toOrtho(r)) };
  }

  async createOrthoCase(
    tenantId: string,
    userId: string,
    input: {
      patientId: string;
      applianceType: string;
      startDate?: string | null;
      estimatedEndDate?: string | null;
      notes?: string | null;
      clinicalData?: Record<string, unknown>;
    },
  ) {
    await this.assertPatient(tenantId, input.patientId);
    const row = await this.prisma.orthodonticCase.create({
      data: {
        id: generateEntityId('ortho'),
        tenantId,
        patientId: input.patientId,
        applianceType: input.applianceType,
        startDate: input.startDate ? new Date(input.startDate) : null,
        estimatedEndDate: input.estimatedEndDate ? new Date(input.estimatedEndDate) : null,
        notes: input.notes ?? null,
        clinicalData: (input.clinicalData ?? {}) as never,
        createdBy: userId,
      },
    });
    return this.toOrtho(row);
  }

  async updateOrthoCase(
    tenantId: string,
    caseId: string,
    input: {
      status?: string;
      applianceType?: string;
      startDate?: string | null;
      estimatedEndDate?: string | null;
      notes?: string | null;
      clinicalData?: Record<string, unknown>;
    },
  ) {
    const existing = await this.prisma.orthodonticCase.findFirst({ where: { id: caseId, tenantId } });
    if (!existing) throw new NotFoundException('Orthodontic case not found');

    const row = await this.prisma.orthodonticCase.update({
      where: { id: caseId },
      data: {
        status: input.status ? (input.status.toUpperCase() as never) : undefined,
        applianceType: input.applianceType,
        startDate: input.startDate !== undefined ? (input.startDate ? new Date(input.startDate) : null) : undefined,
        estimatedEndDate:
          input.estimatedEndDate !== undefined
            ? input.estimatedEndDate
              ? new Date(input.estimatedEndDate)
              : null
            : undefined,
        notes: input.notes,
        clinicalData: input.clinicalData !== undefined ? (input.clinicalData as never) : undefined,
      },
    });
    return this.toOrtho(row);
  }

  async listImplants(tenantId: string, patientId: string) {
    const rows = await this.prisma.implantRecord.findMany({
      where: { tenantId, patientId },
      orderBy: { updatedAt: 'desc' },
    });
    return { items: rows.map((r) => this.toImplant(r)) };
  }

  async createImplant(
    tenantId: string,
    userId: string,
    input: {
      patientId: string;
      toothId: string;
      implantSystem?: string | null;
      implantDiameter?: number | null;
      implantLength?: number | null;
      abutmentType?: string | null;
      status?: string;
      placedAt?: string | null;
      notes?: string | null;
      surgicalData?: Record<string, unknown>;
    },
  ) {
    await this.assertPatient(tenantId, input.patientId);
    const row = await this.prisma.implantRecord.create({
      data: {
        id: generateEntityId('impl'),
        tenantId,
        patientId: input.patientId,
        toothId: input.toothId,
        implantSystem: input.implantSystem ?? null,
        implantDiameter: input.implantDiameter ?? null,
        implantLength: input.implantLength ?? null,
        abutmentType: input.abutmentType ?? null,
        status: (input.status?.toUpperCase() ?? 'PLANNED') as never,
        placedAt: input.placedAt ? new Date(input.placedAt) : null,
        notes: input.notes ?? null,
        surgicalData: (input.surgicalData ?? {}) as never,
        createdBy: userId,
      },
    });
    return this.toImplant(row);
  }

  async updateImplant(
    tenantId: string,
    implantId: string,
    input: {
      status?: string;
      implantSystem?: string | null;
      implantDiameter?: number | null;
      implantLength?: number | null;
      abutmentType?: string | null;
      placedAt?: string | null;
      restoredAt?: string | null;
      notes?: string | null;
      surgicalData?: Record<string, unknown>;
    },
  ) {
    const existing = await this.prisma.implantRecord.findFirst({ where: { id: implantId, tenantId } });
    if (!existing) throw new NotFoundException('Implant record not found');

    const row = await this.prisma.implantRecord.update({
      where: { id: implantId },
      data: {
        status: input.status ? (input.status.toUpperCase() as never) : undefined,
        implantSystem: input.implantSystem,
        implantDiameter: input.implantDiameter,
        implantLength: input.implantLength,
        abutmentType: input.abutmentType,
        placedAt: input.placedAt !== undefined ? (input.placedAt ? new Date(input.placedAt) : null) : undefined,
        restoredAt:
          input.restoredAt !== undefined ? (input.restoredAt ? new Date(input.restoredAt) : null) : undefined,
        notes: input.notes,
        surgicalData: input.surgicalData !== undefined ? (input.surgicalData as never) : undefined,
      },
    });
    return this.toImplant(row);
  }

  async listNotes(tenantId: string, patientId: string) {
    const rows = await this.prisma.dentalClinicalNote.findMany({
      where: { tenantId, patientId },
      orderBy: { createdAt: 'desc' },
    });
    return { items: rows.map((r) => this.toNote(r)) };
  }

  async createNote(
    tenantId: string,
    userId: string,
    input: {
      patientId: string;
      dentalRecordId?: string | null;
      encounterId?: string | null;
      noteType?: string;
      content: string;
    },
  ) {
    await this.assertPatient(tenantId, input.patientId);
    const row = await this.prisma.dentalClinicalNote.create({
      data: {
        id: generateEntityId('dnote'),
        tenantId,
        patientId: input.patientId,
        dentalRecordId: input.dentalRecordId ?? null,
        encounterId: input.encounterId ?? null,
        noteType: input.noteType ?? 'progress',
        content: input.content,
        authorId: userId,
      },
    });
    return this.toNote(row);
  }

  async updateChartMode(tenantId: string, patientId: string, mode: 'adult' | 'pediatric') {
    const record = await this.prisma.dentalRecord.findFirst({ where: { tenantId, patientId } });
    if (!record) throw new NotFoundException('Dental chart not found');

    const toothCount = mode === 'pediatric' ? 20 : 32;
    const state = record.odontogramState as { teeth?: { toothNumber: number; status: string; notes?: string | null; surfaces?: unknown }[]; procedures?: unknown[] };
    const existing = new Map((state.teeth ?? []).map((t) => [t.toothNumber, t]));
    const teeth = [];
    for (let i = 1; i <= toothCount; i++) {
      teeth.push(existing.get(i) ?? { toothNumber: i, status: 'healthy', notes: null, surfaces: {} });
    }

    const updated = await this.prisma.dentalRecord.update({
      where: { id: record.id },
      data: {
        odontogramMode: mode.toUpperCase() as never,
        odontogramState: { teeth, procedures: state.procedures ?? [] },
      },
    });

    return {
      odontogramMode: updated.odontogramMode.toLowerCase(),
      teeth,
    };
  }

  private async assertPatient(tenantId: string, patientId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, tenantId, deletedAt: null } });
    if (!patient) throw new NotFoundException('Patient not found');
  }

  private toOrtho(row: {
    id: string;
    patientId: string;
    status: string;
    applianceType: string;
    startDate: Date | null;
    estimatedEndDate: Date | null;
    notes: string | null;
    clinicalData: unknown;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      patientId: row.patientId,
      status: row.status.toLowerCase(),
      applianceType: row.applianceType,
      startDate: row.startDate?.toISOString().slice(0, 10) ?? null,
      estimatedEndDate: row.estimatedEndDate?.toISOString().slice(0, 10) ?? null,
      notes: row.notes,
      clinicalData: row.clinicalData ?? {},
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toImplant(row: {
    id: string;
    patientId: string;
    toothId: string;
    implantSystem: string | null;
    implantDiameter: { toNumber(): number } | null;
    implantLength: { toNumber(): number } | null;
    abutmentType: string | null;
    status: string;
    placedAt: Date | null;
    restoredAt: Date | null;
    notes: string | null;
    surgicalData: unknown;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      patientId: row.patientId,
      toothId: row.toothId,
      implantSystem: row.implantSystem,
      implantDiameter: row.implantDiameter?.toNumber() ?? null,
      implantLength: row.implantLength?.toNumber() ?? null,
      abutmentType: row.abutmentType,
      status: row.status.toLowerCase(),
      placedAt: row.placedAt?.toISOString() ?? null,
      restoredAt: row.restoredAt?.toISOString() ?? null,
      notes: row.notes,
      surgicalData: row.surgicalData ?? {},
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toNote(row: {
    id: string;
    patientId: string;
    dentalRecordId: string | null;
    encounterId: string | null;
    noteType: string;
    content: string;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      patientId: row.patientId,
      dentalRecordId: row.dentalRecordId,
      encounterId: row.encounterId,
      noteType: row.noteType,
      content: row.content,
      authorId: row.authorId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
