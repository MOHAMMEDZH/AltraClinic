import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';

@Injectable()
export class BeautyExtendedService {
  constructor(private readonly prisma: PrismaService) {}

  async getPatientSummary(tenantId: string, patientId: string) {
    const row = await this.prisma.beautyRecord.findFirst({
      where: { tenantId, patientId },
      include: { patient: { select: { firstName: true, lastName: true, dateOfBirth: true } } },
    });

    if (!row) {
      return { patientId, hasRecord: false };
    }

    const state = row.bodyMapState as {
      profile?: Record<string, unknown>;
      treatmentPlans?: { id: string; title: string; status: string; estimatedCost?: number }[];
      sessions?: { status?: string; scheduledAt?: string }[];
      skincareRegimens?: unknown[];
    };

    const plans = state?.treatmentPlans ?? [];
    const sessions = state?.sessions ?? [];
    const activePlan = plans.find((p) => p.status === 'active' || p.status === 'approved') ?? null;
    const invoiceCount = await this.prisma.invoice.count({
      where: { tenantId, patientId, deletedAt: null },
    });

    return {
      patientId,
      patientName: `${row.patient.firstName} ${row.patient.lastName}`.trim(),
      dateOfBirth: row.patient.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      hasRecord: true,
      recordId: row.id,
      profile: state?.profile ?? null,
      activePlans: plans.filter((p) => p.status === 'active' || p.status === 'approved').length,
      sessionCount: sessions.length,
      upcomingSessions: sessions.filter((s) => s.status === 'scheduled').length,
      followUpDue: sessions.filter((s) => s.status === 'follow_up_due').length,
      skincareRegimens: (state?.skincareRegimens ?? []).length,
      activePlan,
      invoiceCount,
      annotationCount: await this.prisma.beautyAnnotation.count({ where: { beautyRecordId: row.id } }),
      lastUpdated: row.updatedAt.toISOString(),
    };
  }

  async getTimeline(tenantId: string, patientId: string, limit = 50) {
    const record = await this.prisma.beautyRecord.findFirst({
      where: { tenantId, patientId },
      include: { annotations: { orderBy: { recordedAt: 'desc' }, take: 20 } },
    });
    if (!record) return [];

    const state = record.bodyMapState as {
      consultations?: { id: string; type: string; date: string; notes?: string }[];
      treatmentPlans?: { id: string; title: string; status: string; updatedAt?: string }[];
      sessions?: { id: string; type: string; status: string; scheduledAt: string; completedAt?: string }[];
      measurements?: { id: string; label: string; value: number; unit: string; recordedAt: string }[];
    };

    const entries: {
      id: string;
      type: string;
      title: string;
      subtitle: string | null;
      occurredAt: string;
      metadata?: Record<string, unknown>;
    }[] = [];

    for (const c of state?.consultations ?? []) {
      entries.push({
        id: c.id,
        type: 'consultation',
        title: c.type === 'initial' ? 'Initial consultation' : 'Follow-up consultation',
        subtitle: c.notes ?? null,
        occurredAt: c.date,
        metadata: { consultationId: c.id },
      });
    }
    for (const p of state?.treatmentPlans ?? []) {
      entries.push({
        id: p.id,
        type: 'treatment_plan',
        title: p.title,
        subtitle: p.status,
        occurredAt: p.updatedAt ?? record.updatedAt.toISOString(),
        metadata: { planId: p.id },
      });
    }
    for (const s of state?.sessions ?? []) {
      entries.push({
        id: s.id,
        type: 'session',
        title: s.type,
        subtitle: s.status,
        occurredAt: s.completedAt ?? s.scheduledAt,
        metadata: { sessionId: s.id },
      });
    }
    for (const m of state?.measurements ?? []) {
      entries.push({
        id: m.id,
        type: 'measurement',
        title: m.label,
        subtitle: `${m.value} ${m.unit}`,
        occurredAt: m.recordedAt,
      });
    }
    for (const a of record.annotations) {
      entries.push({
        id: a.id,
        type: 'annotation',
        title: `${a.treatment} — ${a.zone}`,
        subtitle: a.notes,
        occurredAt: a.recordedAt.toISOString(),
        metadata: { annotationId: a.id },
      });
    }

    const [appointments, invoices, images] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { tenantId, patientId, deletedAt: null },
        orderBy: { scheduledStart: 'desc' },
        take: 10,
        select: { id: true, scheduledStart: true, serviceType: true, status: true },
      }),
      this.prisma.invoice.findMany({
        where: { tenantId, patientId, deletedAt: null },
        orderBy: { invoiceDate: 'desc' },
        take: 10,
        select: { id: true, invoiceNumber: true, invoiceDate: true, amountTotal: true, status: true },
      }),
      this.prisma.mediaAsset.findMany({
        where: { tenantId, patientId, category: 'BEAUTY_BEFORE_AFTER', deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, originalFilename: true, comparisonRole: true, createdAt: true },
      }),
    ]);

    for (const a of appointments) {
      entries.push({
        id: a.id,
        type: 'appointment',
        title: a.serviceType ?? 'Appointment',
        subtitle: a.status,
        occurredAt: a.scheduledStart.toISOString(),
        metadata: { appointmentId: a.id },
      });
    }
    for (const inv of invoices) {
      entries.push({
        id: inv.id,
        type: 'invoice',
        title: inv.invoiceNumber,
        subtitle: inv.status,
        occurredAt: inv.invoiceDate.toISOString(),
        metadata: { invoiceId: inv.id },
      });
    }
    for (const img of images) {
      entries.push({
        id: img.id,
        type: 'imaging',
        title: img.originalFilename,
        subtitle: img.comparisonRole ?? null,
        occurredAt: img.createdAt.toISOString(),
        metadata: { mediaId: img.id },
      });
    }

    entries.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    return entries.slice(0, limit);
  }

  async updateAnnotation(
    tenantId: string,
    annotationId: string,
    payload: {
      zone?: string;
      treatment?: string;
      parameters?: Record<string, unknown>;
      notes?: string | null;
    },
  ) {
    const row = await this.prisma.beautyAnnotation.findFirst({
      where: { id: annotationId, tenantId },
    });
    if (!row) throw new NotFoundException('Annotation not found');

    const updated = await this.prisma.beautyAnnotation.update({
      where: { id: annotationId },
      data: {
        zone: payload.zone ?? row.zone,
        treatment: payload.treatment ?? row.treatment,
        parameters: payload.parameters ?? (row.parameters as object),
        notes: payload.notes !== undefined ? payload.notes : row.notes,
      },
    });

    return {
      id: updated.id,
      zone: updated.zone,
      treatment: updated.treatment,
      coordinates: updated.coordinates as { x: number; y: number; view: string },
      parameters: updated.parameters as Record<string, unknown>,
      recordedBy: updated.recordedBy,
      recordedAt: updated.recordedAt.toISOString(),
      notes: updated.notes,
    };
  }

  async deleteAnnotation(tenantId: string, annotationId: string) {
    const row = await this.prisma.beautyAnnotation.findFirst({
      where: { id: annotationId, tenantId },
    });
    if (!row) throw new NotFoundException('Annotation not found');
    await this.prisma.beautyAnnotation.delete({ where: { id: annotationId } });
    return { deleted: true };
  }
}
