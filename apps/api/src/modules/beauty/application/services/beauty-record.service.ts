import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { BeautySessionSyncService } from './beauty-session-sync.service';
import { BeautyLoyaltyService } from './beauty-loyalty.service';

export interface BeautyMetricsSummary {
  recordsTotal: number;
  activePlans: number;
  sessionsThisWeek: number;
  followUpDue: number;
  beforeAfterPairs: number;
  revenueEstimate: number;
}

export interface BeautyOverviewItem {
  patientId: string;
  patientName: string;
  recordId: string;
  activePlans: number;
  sessionCount: number;
  lastUpdated: string;
  nextSession?: string | null;
}

export interface BeautyRecordDto {
  id: string;
  patientId: string;
  bodyMapState: Record<string, unknown>;
  annotations: BeautyAnnotationDto[];
  createdAt: string;
  updatedAt: string;
}

export interface BeautyAnnotationDto {
  id: string;
  zone: string;
  treatment: string;
  coordinates: { x: number; y: number; view: string };
  parameters: Record<string, unknown>;
  recordedBy: string;
  recordedAt: string;
  notes: string | null;
}

function emptyBodyMapState(): Record<string, unknown> {
  return {
    version: 1,
    profile: { skinType: null, concerns: [], allergies: [], notes: '' },
    consultations: [],
    treatmentPlans: [],
    sessions: [],
    measurements: [],
    consents: [],
    skincareRegimens: [],
  };
}

const MAX_ARRAY_ITEMS = 500;

function sanitizeBodyMapState(raw: Record<string, unknown>): Record<string, unknown> {
  const base = emptyBodyMapState();
  const allowed = Object.keys(base);
  const result: Record<string, unknown> = { ...base };

  for (const key of allowed) {
    if (!(key in raw)) continue;
    const value = raw[key];
    if (key === 'profile' && value && typeof value === 'object') {
      const profile = value as Record<string, unknown>;
      result.profile = {
        skinType: typeof profile.skinType === 'string' ? profile.skinType : null,
        concerns: Array.isArray(profile.concerns) ? profile.concerns.slice(0, 32).map(String) : [],
        allergies: Array.isArray(profile.allergies) ? profile.allergies.slice(0, 32).map(String) : [],
        notes: typeof profile.notes === 'string' ? profile.notes.slice(0, 8000) : '',
      };
      continue;
    }
    if (Array.isArray(value)) {
      result[key] = value.slice(0, MAX_ARRAY_ITEMS);
      continue;
    }
    if (key === 'skincareRegimens' && Array.isArray(value)) {
      result.skincareRegimens = value.slice(0, MAX_ARRAY_ITEMS);
      continue;
    }
    if (key === 'version' && typeof value === 'number') {
      result.version = value;
    }
  }

  const consents = result.consents as { type?: string; granted?: boolean }[];
  if (Array.isArray(consents)) {
    result.consents = consents.filter(
      (c) => c && (c.type === 'photo' || c.type === 'treatment') && typeof c.granted === 'boolean',
    );
  }

  return result;
}

@Injectable()
export class BeautyRecordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly sessionSync: BeautySessionSyncService,
    private readonly loyalty: BeautyLoyaltyService,
  ) {}

  async getMetrics(tenantId: string): Promise<BeautyMetricsSummary> {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const records = await this.prisma.beautyRecord.findMany({
      where: { tenantId },
      select: { bodyMapState: true, updatedAt: true },
    });

    let activePlans = 0;
    let sessionsThisWeek = 0;
    let followUpDue = 0;
    let revenueEstimate = 0;

    for (const row of records) {
      const state = row.bodyMapState as {
        treatmentPlans?: { status?: string; estimatedCost?: number }[];
        sessions?: { scheduledAt?: string; status?: string }[];
      } | null;

      const plans = state?.treatmentPlans ?? [];
      activePlans += plans.filter((p) => p.status === 'active' || p.status === 'approved').length;
      revenueEstimate += plans
        .filter((p) => p.status === 'active' || p.status === 'approved')
        .reduce((sum, p) => sum + (p.estimatedCost ?? 0), 0);

      const sessions = state?.sessions ?? [];
      sessionsThisWeek += sessions.filter((s) => {
        const d = s.scheduledAt ? new Date(s.scheduledAt) : row.updatedAt;
        return d >= weekStart;
      }).length;
      followUpDue += sessions.filter((s) => s.status === 'follow_up_due').length;
    }

    const beforeAfterPairs = await this.prisma.mediaAsset.count({
      where: { tenantId, category: 'BEAUTY_BEFORE_AFTER', comparisonRole: 'BEFORE' },
    });

    return {
      recordsTotal: records.length,
      activePlans,
      sessionsThisWeek,
      followUpDue,
      beforeAfterPairs,
      revenueEstimate,
    };
  }

  async listOverview(tenantId: string, limit = 20): Promise<BeautyOverviewItem[]> {
    const rows = await this.prisma.beautyRecord.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: { patient: { select: { firstName: true, lastName: true } } },
    });

    return rows.map((row) => {
      const state = row.bodyMapState as {
        treatmentPlans?: { status?: string }[];
        sessions?: { scheduledAt?: string; status?: string }[];
      } | null;
      const plans = state?.treatmentPlans ?? [];
      const sessions = state?.sessions ?? [];
      const activePlans = plans.filter((p) => p.status === 'active' || p.status === 'approved').length;
      const upcoming = sessions
        .filter((s) => s.status === 'scheduled')
        .map((s) => s.scheduledAt)
        .filter(Boolean)
        .sort()[0];

      return {
        patientId: row.patientId,
        patientName: `${row.patient.firstName} ${row.patient.lastName}`.trim(),
        recordId: row.id,
        activePlans,
        sessionCount: sessions.length,
        lastUpdated: row.updatedAt.toISOString(),
        nextSession: upcoming ?? null,
      };
    });
  }

  async getAnalytics(tenantId: string) {
    const records = await this.prisma.beautyRecord.findMany({
      where: { tenantId },
      select: { bodyMapState: true },
    });

    let revenuePipeline = 0;
    let totalPlans = 0;
    let approvedPlans = 0;
    let totalSessions = 0;
    let completedSessions = 0;
    const treatmentCounts = new Map<string, number>();
    const clinicianCounts = new Map<string, number>();

    for (const row of records) {
      const state = row.bodyMapState as {
        treatmentPlans?: { status?: string; estimatedCost?: number; sessionSequence?: { type: string }[] }[];
        sessions?: { type?: string; status?: string; clinicianId?: string }[];
      } | null;

      for (const plan of state?.treatmentPlans ?? []) {
        totalPlans++;
        if (plan.status === 'approved' || plan.status === 'active') {
          approvedPlans++;
          revenuePipeline += plan.estimatedCost ?? 0;
        }
        for (const step of plan.sessionSequence ?? []) {
          treatmentCounts.set(step.type, (treatmentCounts.get(step.type) ?? 0) + 1);
        }
      }

      for (const session of state?.sessions ?? []) {
        totalSessions++;
        if (session.status === 'completed') completedSessions++;
        if (session.type) treatmentCounts.set(session.type, (treatmentCounts.get(session.type) ?? 0) + 1);
        if (session.clinicianId) {
          clinicianCounts.set(session.clinicianId, (clinicianCounts.get(session.clinicianId) ?? 0) + 1);
        }
      }
    }

    const topTreatments = [...treatmentCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([type, count]) => ({ type, count }));

    const beautyPatientIds = (
      await this.prisma.beautyRecord.findMany({ where: { tenantId }, select: { patientId: true } })
    ).map((r) => r.patientId);

    const paidAggregate = beautyPatientIds.length
      ? await this.prisma.invoice.aggregate({
          where: { tenantId, patientId: { in: beautyPatientIds }, deletedAt: null },
          _sum: { amountPaid: true },
        })
      : { _sum: { amountPaid: null } };

    const practitionerLoad = await Promise.all(
      [...clinicianCounts.entries()].map(async ([clinicianId, sessions]) => {
        const user = await this.prisma.user.findFirst({
          where: { id: clinicianId, tenantId },
          select: { firstName: true, lastName: true, email: true },
        });
        const name = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email : clinicianId.slice(0, 8);
        return { clinicianId, sessions, practitionerName: name };
      }),
    );

    return {
      revenuePipeline,
      revenueCollected: Number(paidAggregate._sum.amountPaid ?? 0),
      conversionRate: totalPlans ? Math.round((approvedPlans / totalPlans) * 100) : 0,
      retentionRate: totalSessions ? Math.round((completedSessions / totalSessions) * 100) : 0,
      avgSessionsPerPlan: totalPlans ? totalSessions / totalPlans : 0,
      topTreatments,
      practitionerLoad,
    };
  }

  async assertPatientExists(tenantId: string, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async getRecord(tenantId: string, patientId: string): Promise<BeautyRecordDto | null> {
    const row = await this.prisma.beautyRecord.findFirst({
      where: { patientId, tenantId },
      include: { annotations: { orderBy: { recordedAt: 'desc' } } },
    });
    if (!row) return null;
    return this.toDto(row);
  }

  async createRecord(tenantId: string, patientId: string): Promise<BeautyRecordDto> {
    await this.assertPatientExists(tenantId, patientId);

    const existing = await this.prisma.beautyRecord.findFirst({
      where: { patientId, tenantId },
      include: { annotations: true },
    });
    if (existing) return this.toDto(existing);

    const row = await this.prisma.beautyRecord.create({
      data: {
        tenantId,
        patientId,
        bodyMapState: emptyBodyMapState(),
      },
      include: { annotations: true },
    });
    return this.toDto(row);
  }

  async updateBodyMapState(
    tenantId: string,
    patientId: string,
    bodyMapState: Record<string, unknown>,
    authenticatedActorId: string,
  ): Promise<BeautyRecordDto> {
    const record = await this.prisma.beautyRecord.findFirst({
      where: { patientId, tenantId },
    });
    if (!record) throw new NotFoundException('Beauty record not found');

    const previous = (record.bodyMapState as Record<string, unknown>) ?? emptyBodyMapState();
    const sanitized = sanitizeBodyMapState(bodyMapState);
    const prevSessions = (previous.sessions as { id: string }[]) ?? [];
    const nextSessionsRaw = (sanitized.sessions as { id: string }[]) ?? [];

    const ctx = (await this.tenant.resolve()) as TenantContextContract;
    const syncedSessions = await this.sessionSync.syncSessions(
      tenantId,
      ctx.branchId ?? null,
      patientId,
      prevSessions as Parameters<BeautySessionSyncService['syncSessions']>[3],
      nextSessionsRaw as Parameters<BeautySessionSyncService['syncSessions']>[4],
      authenticatedActorId,
    );
    sanitized.sessions = syncedSessions;

    await this.loyalty.onSessionsUpdated(
      tenantId,
      patientId,
      prevSessions as { id: string; status?: string; type?: string }[],
      syncedSessions as { id: string; status?: string; type?: string }[],
    );

    const row = await this.prisma.beautyRecord.update({
      where: { id: record.id },
      data: { bodyMapState: sanitized },
      include: { annotations: { orderBy: { recordedAt: 'desc' } } },
    });
    return this.toDto(row);
  }

  async approvePlan(tenantId: string, patientId: string, planId: string, approvedBy: string): Promise<BeautyRecordDto> {
    const record = await this.prisma.beautyRecord.findFirst({
      where: { patientId, tenantId },
    });
    if (!record) throw new NotFoundException('Beauty record not found');

    const state = sanitizeBodyMapState((record.bodyMapState as Record<string, unknown>) ?? emptyBodyMapState());
    const plans = (state.treatmentPlans as { id: string; status?: string; approvedAt?: string; approvedBy?: string }[]) ?? [];
    const idx = plans.findIndex((p) => p.id === planId);
    if (idx < 0) throw new NotFoundException('Treatment plan not found');

    plans[idx] = {
      ...plans[idx],
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy,
    };
    state.treatmentPlans = plans;

    const row = await this.prisma.beautyRecord.update({
      where: { id: record.id },
      data: { bodyMapState: state },
      include: { annotations: { orderBy: { recordedAt: 'desc' } } },
    });
    return this.toDto(row);
  }

  async hasConsent(tenantId: string, patientId: string, type: 'photo' | 'treatment'): Promise<boolean> {
    const record = await this.prisma.beautyRecord.findFirst({
      where: { patientId, tenantId },
      select: { bodyMapState: true },
    });
    if (!record) return false;
    const state = record.bodyMapState as { consents?: { type?: string; granted?: boolean }[] } | null;
    return (state?.consents ?? []).some((c) => c.type === type && c.granted === true);
  }

  async assertConsent(tenantId: string, patientId: string, type: 'photo' | 'treatment'): Promise<void> {
    const ok = await this.hasConsent(tenantId, patientId, type);
    if (!ok) throw new ForbiddenException(`Missing ${type} consent`);
  }

  async exportRecord(tenantId: string, patientId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, dateOfBirth: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const record = await this.getRecord(tenantId, patientId);
    if (!record) return null;

    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, patientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, invoiceNumber: true, status: true, amountTotal: true, amountPaid: true, createdAt: true },
    });

    const media = await this.prisma.mediaAsset.findMany({
      where: { tenantId, patientId, category: 'BEAUTY_BEFORE_AFTER', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, originalFilename: true, comparisonRole: true, createdAt: true },
    });

    return {
      exportedAt: new Date().toISOString(),
      patient,
      record,
      invoices,
      media,
    };
  }

  async addAnnotation(
    tenantId: string,
    patientId: string,
    userId: string,
    payload: {
      zone: string;
      treatment: string;
      coordinates: { x: number; y: number; view: string };
      parameters?: Record<string, unknown>;
      notes?: string | null;
    },
  ): Promise<BeautyAnnotationDto> {
    let record = await this.prisma.beautyRecord.findFirst({
      where: { patientId, tenantId },
    });
    if (!record) {
      await this.createRecord(tenantId, patientId);
      record = await this.prisma.beautyRecord.findFirstOrThrow({
        where: { patientId, tenantId },
      });
    }

    await this.assertConsent(tenantId, patientId, 'treatment');

    const annotation = await this.prisma.beautyAnnotation.create({
      data: {
        id: randomUUID(),
        beautyRecordId: record.id,
        tenantId,
        zone: payload.zone,
        treatment: payload.treatment,
        coordinates: payload.coordinates,
        parameters: payload.parameters ?? {},
        recordedBy: userId,
        notes: payload.notes ?? null,
      },
    });

    return {
      id: annotation.id,
      zone: annotation.zone,
      treatment: annotation.treatment,
      coordinates: annotation.coordinates as { x: number; y: number; view: string },
      parameters: annotation.parameters as Record<string, unknown>,
      recordedBy: annotation.recordedBy,
      recordedAt: annotation.recordedAt.toISOString(),
      notes: annotation.notes,
    };
  }

  private toDto(row: {
    id: string;
    patientId: string;
    bodyMapState: unknown;
    createdAt: Date;
    updatedAt: Date;
    annotations: {
      id: string;
      zone: string;
      treatment: string;
      coordinates: unknown;
      parameters: unknown;
      recordedBy: string;
      recordedAt: Date;
      notes: string | null;
    }[];
  }): BeautyRecordDto {
    return {
      id: row.id,
      patientId: row.patientId,
      bodyMapState: (row.bodyMapState as Record<string, unknown>) ?? emptyBodyMapState(),
      annotations: row.annotations.map((a) => ({
        id: a.id,
        zone: a.zone,
        treatment: a.treatment,
        coordinates: a.coordinates as { x: number; y: number; view: string },
        parameters: a.parameters as Record<string, unknown>,
        recordedBy: a.recordedBy,
        recordedAt: a.recordedAt.toISOString(),
        notes: a.notes,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
