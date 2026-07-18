import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { DentalChart } from '../../domain/dental-chart.entity';
import { DentalEntryFactory } from '../../domain/dental-entry.factory';
import { ToothVO } from '../../domain/tooth.vo';
import { ToothStatus } from '../../domain/tooth-status.enum';
import { generateEntityId } from '../../../../common/id-generator.util';

export interface DentalMetricsSummary {
  chartsTotal: number;
  proceduresThisWeek: number;
  activePatients: number;
  pendingPlannedTeeth: number;
  followUpDue: number;
}

export interface DentalOverviewItem {
  patientId: string;
  patientName: string;
  chartId: string;
  procedureCount: number;
  lastUpdated: string;
  plannedCount: number;
}

@Injectable()
export class DentalOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(tenantId: string): Promise<DentalMetricsSummary> {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const records = await this.prisma.dentalRecord.findMany({
      where: { tenantId },
      select: { id: true, patientId: true, odontogramState: true, updatedAt: true },
    });

    let proceduresThisWeek = 0;
    let pendingPlannedTeeth = 0;

    for (const row of records) {
      const state = row.odontogramState as { procedures?: { performedAt?: string }[]; teeth?: { status?: string }[] } | null;
      const procs = state?.procedures ?? [];
      proceduresThisWeek += procs.filter((p) => {
        const d = p.performedAt ? new Date(p.performedAt) : row.updatedAt;
        return d >= weekStart;
      }).length;
      pendingPlannedTeeth += (state?.teeth ?? []).filter((t) => t.status === ToothStatus.Planned).length;
    }

    return {
      chartsTotal: records.length,
      proceduresThisWeek,
      activePatients: records.length,
      pendingPlannedTeeth,
      followUpDue: Math.min(records.length, pendingPlannedTeeth > 0 ? Math.ceil(pendingPlannedTeeth / 2) : 0),
    };
  }

  async listOverview(tenantId: string, limit = 20): Promise<DentalOverviewItem[]> {
    const rows = await this.prisma.dentalRecord.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: { patient: { select: { firstName: true, lastName: true } } },
    });

    return rows.map((row) => {
      const state = row.odontogramState as { procedures?: unknown[]; teeth?: { status?: string }[] } | null;
      const procedures = state?.procedures ?? [];
      const plannedCount = (state?.teeth ?? []).filter((t) => t.status === ToothStatus.Planned).length;
      return {
        patientId: row.patientId,
        patientName: `${row.patient.firstName} ${row.patient.lastName}`.trim(),
        chartId: row.id,
        procedureCount: procedures.length,
        lastUpdated: row.updatedAt.toISOString(),
        plannedCount,
      };
    });
  }

  createEmptyChart(tenantId: string, patientId: string): DentalChart {
    return DentalEntryFactory.createEmptyChart(generateEntityId('dental'), tenantId, patientId);
  }

  updateTeeth(chart: DentalChart, updates: { toothNumber: number; status: ToothStatus; notes?: string | null; surfaces?: Record<string, string> }[]): void {
    for (const u of updates) {
      const idx = chart.teeth.findIndex((t) => {
        const num = typeof t === 'object' && 'toothNumber' in t ? (t as ToothVO).toothNumber : (t as { toothNumber: number }).toothNumber;
        return num === u.toothNumber;
      });
      if (idx >= 0) {
        chart.teeth[idx] = new ToothVO(u.toothNumber, u.status, u.notes ?? null, u.surfaces ?? {});
      }
    }
    chart.updatedAt = new Date().toISOString();
  }

  assertPatientExists(tenantId: string, patientId: string) {
    return this.prisma.patient.findFirst({ where: { id: patientId, tenantId, deletedAt: null } });
  }

  async findChartOrThrow(tenantId: string, patientId: string): Promise<DentalChart> {
    const row = await this.prisma.dentalRecord.findFirst({ where: { patientId, tenantId } });
    if (!row) throw new NotFoundException('Dental chart not found');
    const state = row.odontogramState as { teeth?: unknown[]; procedures?: unknown[] } | null;
    return new DentalChart(
      row.id,
      row.tenantId,
      row.patientId,
      Array.isArray(state?.teeth) ? (state!.teeth as never[]) : [],
      Array.isArray(state?.procedures) ? (state!.procedures as never[]) : [],
      row.createdAt.toISOString(),
      row.updatedAt.toISOString(),
    );
  }
}
