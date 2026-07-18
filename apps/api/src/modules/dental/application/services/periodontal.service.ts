import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';

export const PERIO_SITE_IDS = ['mb', 'b', 'db', 'ml', 'l', 'dl'] as const;
export type PerioSiteId = (typeof PERIO_SITE_IDS)[number];

export interface PerioSiteMeasurement {
  pd: number;
  recession: number;
  bop: boolean;
}

export interface PerioToothInput {
  toothNumber: number;
  mobility: number;
  furcation?: number | null;
  plaqueIndex: number;
  sites: Record<string, PerioSiteMeasurement>;
  missing?: boolean;
}

export interface PerioAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  code: string;
  toothNumber?: number;
  site?: string;
  params?: Record<string, string | number>;
}

export interface PerioSummary {
  teethCharted: number;
  sitesProbed: number;
  bopCount: number;
  bopPercent: number;
  sitesPd4Plus: number;
  sitesPd5Plus: number;
  sitesPd6Plus: number;
  maxPocketDepth: number;
  avgPocketDepth: number;
  teethWithMobility: number;
  teethWithFurcation: number;
  avgPlaqueIndex: number;
  stage: 'healthy' | 'gingivitis' | 'mild' | 'moderate' | 'severe';
  alerts: PerioAlert[];
}

function emptySite(): PerioSiteMeasurement {
  return { pd: 0, recession: 0, bop: false };
}

function defaultTooth(toothNumber: number): PerioToothInput {
  const sites = Object.fromEntries(PERIO_SITE_IDS.map((id) => [id, emptySite()])) as Record<
    string,
    PerioSiteMeasurement
  >;
  return { toothNumber, mobility: 0, furcation: null, plaqueIndex: 0, sites };
}

export function buildDefaultTeeth(): PerioToothInput[] {
  return Array.from({ length: 32 }, (_, i) => defaultTooth(i + 1));
}

export function computePerioSummary(teeth: PerioToothInput[]): PerioSummary {
  let sitesProbed = 0;
  let bopCount = 0;
  let sitesPd4Plus = 0;
  let sitesPd5Plus = 0;
  let sitesPd6Plus = 0;
  let pdSum = 0;
  let maxPocketDepth = 0;
  let teethWithMobility = 0;
  let teethWithFurcation = 0;
  let plaqueSum = 0;
  let teethCharted = 0;
  const alerts: PerioAlert[] = [];

  for (const tooth of teeth) {
    if (tooth.missing) continue;
    teethCharted += 1;
    plaqueSum += tooth.plaqueIndex;
    if (tooth.mobility > 0) {
      teethWithMobility += 1;
      if (tooth.mobility >= 2) {
        alerts.push({
          id: `mobility-${tooth.toothNumber}`,
          severity: tooth.mobility >= 3 ? 'critical' : 'warning',
          code: 'mobility',
          toothNumber: tooth.toothNumber,
          params: { grade: tooth.mobility },
        });
      }
    }
    if (tooth.furcation != null && tooth.furcation > 0) {
      teethWithFurcation += 1;
      alerts.push({
        id: `furcation-${tooth.toothNumber}`,
        severity: tooth.furcation >= 2 ? 'critical' : 'warning',
        code: 'furcation',
        toothNumber: tooth.toothNumber,
        params: { grade: tooth.furcation },
      });
    }

    for (const siteId of PERIO_SITE_IDS) {
      const site = tooth.sites[siteId];
      if (!site) continue;
      sitesProbed += 1;
      pdSum += site.pd;
      if (site.pd > maxPocketDepth) maxPocketDepth = site.pd;
      if (site.bop) bopCount += 1;
      if (site.pd >= 4) sitesPd4Plus += 1;
      if (site.pd >= 5) sitesPd5Plus += 1;
      if (site.pd >= 6) {
        sitesPd6Plus += 1;
        alerts.push({
          id: `pd6-${tooth.toothNumber}-${siteId}`,
          severity: site.pd >= 7 ? 'critical' : 'warning',
          code: 'deep_pocket',
          toothNumber: tooth.toothNumber,
          site: siteId,
          params: { depth: site.pd },
        });
      }
      if (site.recession >= 4) {
        alerts.push({
          id: `recession-${tooth.toothNumber}-${siteId}`,
          severity: site.recession >= 6 ? 'critical' : 'warning',
          code: 'recession',
          toothNumber: tooth.toothNumber,
          site: siteId,
          params: { mm: site.recession },
        });
      }
    }
  }

  const bopPercent = sitesProbed > 0 ? Math.round((bopCount / sitesProbed) * 100) : 0;
  const avgPocketDepth = sitesProbed > 0 ? Math.round((pdSum / sitesProbed) * 10) / 10 : 0;
  const avgPlaqueIndex = teethCharted > 0 ? Math.round((plaqueSum / teethCharted) * 10) / 10 : 0;

  let stage: PerioSummary['stage'] = 'healthy';
  if (bopPercent >= 10 || sitesPd4Plus >= 4) stage = 'gingivitis';
  if (sitesPd5Plus >= 2 || maxPocketDepth >= 5) stage = 'mild';
  if (sitesPd5Plus >= 8 || maxPocketDepth >= 6 || teethWithMobility >= 2) stage = 'moderate';
  if (sitesPd6Plus >= 4 || maxPocketDepth >= 7 || teethWithMobility >= 4) stage = 'severe';

  if (stage === 'moderate' || stage === 'severe') {
    alerts.unshift({
      id: 'stage-alert',
      severity: stage === 'severe' ? 'critical' : 'warning',
      code: 'periodontitis_stage',
      params: { stage },
    });
  }

  if (bopPercent >= 30) {
    alerts.push({
      id: 'bop-high',
      severity: 'warning',
      code: 'bop_elevated',
      params: { percent: bopPercent },
    });
  }

  return {
    teethCharted,
    sitesProbed,
    bopCount,
    bopPercent,
    sitesPd4Plus,
    sitesPd5Plus,
    sitesPd6Plus,
    maxPocketDepth,
    avgPocketDepth,
    teethWithMobility,
    teethWithFurcation,
    avgPlaqueIndex,
    stage,
    alerts: alerts.slice(0, 50),
  };
}

function normalizeTeeth(input?: PerioToothInput[]): PerioToothInput[] {
  const defaults = buildDefaultTeeth();
  if (!input?.length) return defaults;
  const byNum = new Map(input.map((t) => [t.toothNumber, t]));
  return defaults.map((d) => {
    const src = byNum.get(d.toothNumber);
    if (!src) return d;
    const sites = { ...d.sites };
    for (const id of PERIO_SITE_IDS) {
      if (src.sites[id]) sites[id] = { ...emptySite(), ...src.sites[id] };
    }
    return {
      toothNumber: d.toothNumber,
      mobility: src.mobility ?? 0,
      furcation: src.furcation ?? null,
      plaqueIndex: src.plaqueIndex ?? 0,
      sites,
      missing: src.missing ?? false,
    };
  });
}

@Injectable()
export class PeriodontalService {
  constructor(private readonly prisma: PrismaService) {}

  async listExams(tenantId: string, patientId: string) {
    const rows = await this.prisma.periodontalExam.findMany({
      where: { tenantId, patientId },
      orderBy: { examDate: 'desc' },
    });
    return { items: rows.map((r) => this.toExamSummary(r)) };
  }

  async getExam(tenantId: string, examId: string) {
    const row = await this.prisma.periodontalExam.findFirst({ where: { id: examId, tenantId } });
    if (!row) throw new NotFoundException('Periodontal exam not found');
    return this.toExamDetail(row);
  }

  async createExam(
    tenantId: string,
    userId: string,
    patientId: string,
    input: { examDate?: string; notes?: string | null; teeth?: PerioToothInput[] },
  ) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const teeth = normalizeTeeth(input.teeth);
    const summary = computePerioSummary(teeth);
    const examDate = input.examDate ? new Date(input.examDate) : new Date();
    if (Number.isNaN(examDate.getTime())) throw new BadRequestException('Invalid exam date');

    const row = await this.prisma.periodontalExam.create({
      data: {
        tenantId,
        patientId,
        recordedBy: userId,
        examDate,
        notes: input.notes ?? null,
        chartData: { teeth, summary },
      },
    });
    return this.toExamDetail(row);
  }

  async updateExam(
    tenantId: string,
    examId: string,
    input: { examDate?: string; notes?: string | null; teeth?: PerioToothInput[] },
  ) {
    const existing = await this.prisma.periodontalExam.findFirst({ where: { id: examId, tenantId } });
    if (!existing) throw new NotFoundException('Periodontal exam not found');

    const current = (existing.chartData ?? {}) as { teeth?: PerioToothInput[] };
    const teeth = normalizeTeeth(input.teeth ?? current.teeth);
    const summary = computePerioSummary(teeth);
    const examDate = input.examDate ? new Date(input.examDate) : existing.examDate;

    const row = await this.prisma.periodontalExam.update({
      where: { id: examId },
      data: {
        examDate,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        chartData: { teeth, summary },
      },
    });
    return this.toExamDetail(row);
  }

  async getProgress(tenantId: string, patientId: string) {
    const rows = await this.prisma.periodontalExam.findMany({
      where: { tenantId, patientId },
      orderBy: { examDate: 'asc' },
      take: 24,
    });
    const points = rows.map((r) => {
      const data = (r.chartData ?? {}) as { summary?: PerioSummary };
      const s = data.summary ?? computePerioSummary((data.teeth as PerioToothInput[]) ?? []);
      return {
        examId: r.id,
        examDate: r.examDate.toISOString(),
        bopPercent: s.bopPercent,
        avgPocketDepth: s.avgPocketDepth,
        sitesPd4Plus: s.sitesPd4Plus,
        sitesPd5Plus: s.sitesPd5Plus,
        sitesPd6Plus: s.sitesPd6Plus,
        maxPocketDepth: s.maxPocketDepth,
        stage: s.stage,
      };
    });
    const latest = points[points.length - 1] ?? null;
    const baseline = points[0] ?? null;
    const delta =
      latest && baseline && latest.examId !== baseline.examId
        ? {
            bopPercent: latest.bopPercent - baseline.bopPercent,
            avgPocketDepth: Math.round((latest.avgPocketDepth - baseline.avgPocketDepth) * 10) / 10,
            sitesPd4Plus: latest.sitesPd4Plus - baseline.sitesPd4Plus,
            maxPocketDepth: latest.maxPocketDepth - baseline.maxPocketDepth,
          }
        : null;
    return { points, latest, baseline, delta };
  }

  async compareExams(tenantId: string, baselineExamId: string, compareExamId: string) {
    const [baseline, compare] = await Promise.all([
      this.getExam(tenantId, baselineExamId),
      this.getExam(tenantId, compareExamId),
    ]);
    const toothDeltas: {
      toothNumber: number;
      maxPdDelta: number;
      bopDelta: number;
      baselineMaxPd: number;
      compareMaxPd: number;
    }[] = [];

    for (let n = 1; n <= 32; n++) {
      const bTooth = baseline.teeth.find((t) => t.toothNumber === n);
      const cTooth = compare.teeth.find((t) => t.toothNumber === n);
      if (!bTooth || !cTooth || bTooth.missing || cTooth.missing) continue;
      const bMax = Math.max(...PERIO_SITE_IDS.map((id) => bTooth.sites[id]?.pd ?? 0));
      const cMax = Math.max(...PERIO_SITE_IDS.map((id) => cTooth.sites[id]?.pd ?? 0));
      const bBop = PERIO_SITE_IDS.filter((id) => bTooth.sites[id]?.bop).length;
      const cBop = PERIO_SITE_IDS.filter((id) => cTooth.sites[id]?.bop).length;
      toothDeltas.push({
        toothNumber: n,
        maxPdDelta: cMax - bMax,
        bopDelta: cBop - bBop,
        baselineMaxPd: bMax,
        compareMaxPd: cMax,
      });
    }

    return {
      baseline: { id: baseline.id, examDate: baseline.examDate, summary: baseline.summary },
      compare: { id: compare.id, examDate: compare.examDate, summary: compare.summary },
      toothDeltas,
      summaryDelta: {
        bopPercent: compare.summary.bopPercent - baseline.summary.bopPercent,
        avgPocketDepth:
          Math.round((compare.summary.avgPocketDepth - baseline.summary.avgPocketDepth) * 10) / 10,
        sitesPd4Plus: compare.summary.sitesPd4Plus - baseline.summary.sitesPd4Plus,
        maxPocketDepth: compare.summary.maxPocketDepth - baseline.summary.maxPocketDepth,
      },
    };
  }

  private toExamSummary(row: {
    id: string;
    patientId: string;
    recordedBy: string;
    examDate: Date;
    notes: string | null;
    chartData: unknown;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const data = (row.chartData ?? {}) as { summary?: PerioSummary; teeth?: PerioToothInput[] };
    const summary = data.summary ?? computePerioSummary(data.teeth ?? []);
    return {
      id: row.id,
      patientId: row.patientId,
      recordedBy: row.recordedBy,
      examDate: row.examDate.toISOString(),
      notes: row.notes,
      summary,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toExamDetail(row: {
    id: string;
    patientId: string;
    recordedBy: string;
    examDate: Date;
    notes: string | null;
    chartData: unknown;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const data = (row.chartData ?? {}) as { teeth?: PerioToothInput[]; summary?: PerioSummary };
    const teeth = normalizeTeeth(data.teeth);
    const summary = data.summary ?? computePerioSummary(teeth);
    return {
      id: row.id,
      patientId: row.patientId,
      recordedBy: row.recordedBy,
      examDate: row.examDate.toISOString(),
      notes: row.notes,
      teeth,
      summary,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
