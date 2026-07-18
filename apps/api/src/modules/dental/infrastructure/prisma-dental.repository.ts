import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { DentalChart } from '../domain/dental-chart.entity';
import { DentalEntryRepository } from '../domain/dental-entry.repository.interface';

/**
 * Stores the DentalChart aggregate as a DentalRecord in Postgres.
 *
 * COMPETING ARCHITECT NOTE:
 *   Challenger: "Store procedures as DentalToothCondition rows for queryability."
 *   Decision: For Phase 1, the full chart (teeth + procedures) is stored as an
 *   opaque JSON snapshot in `odontogramState`. DentalToothCondition audit-log
 *   entries are written for each procedure to enable per-tooth queries.
 *   The JSONB snapshot is the authoritative read projection; the condition rows
 *   are the write-audit trail. This gives us both: fast full-chart reads and
 *   per-tooth history queries without dual-reading two tables on every load.
 */
@Injectable()
export class PrismaDentalRepository implements DentalEntryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(chart: DentalChart): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.dentalRecord.upsert({
        where: { patientId: chart.patientId },
        create: {
          id: chart.id,
          tenantId: chart.tenantId,
          patientId: chart.patientId,
          odontogramMode: chart.odontogramMode === 'pediatric' ? 'PEDIATRIC' : 'ADULT',
          odontogramState: {
            teeth: chart.teeth.map((t) => t.toJSON?.() ?? t),
            procedures: chart.procedures,
          },
          createdAt: new Date(chart.createdAt),
        },
        update: {
          odontogramMode: chart.odontogramMode === 'pediatric' ? 'PEDIATRIC' : 'ADULT',
          odontogramState: {
            teeth: chart.teeth.map((t) => t.toJSON?.() ?? t),
            procedures: chart.procedures,
          },
          updatedAt: new Date(chart.updatedAt),
        },
      });

      // Append new procedure events as immutable tooth-condition log entries
      if (chart.procedures.length > 0) {
        const existingCount = await tx.dentalToothCondition.count({
          where: { dentalRecordId: record.id },
        });

        // Only write conditions for newly added procedures (append-only delta)
        const newProcedures = chart.procedures.slice(existingCount);
        for (const proc of newProcedures) {
          const toothIds = proc.toothNumbers?.length ? proc.toothNumbers.map(String) : ['unknown'];
          for (const toothId of toothIds) {
            await tx.dentalToothCondition.create({
              data: {
                dentalRecordId: record.id,
                tenantId: chart.tenantId,
                toothId,
                surface: null,
                conditionCode: proc.code ?? 'procedure',
                notes: proc.description ?? null,
                encounterId: null,
                recordedBy: proc.providerId ?? chart.tenantId,
                recordedAt: proc.performedAt ? new Date(proc.performedAt) : new Date(),
              },
            });
          }
        }
      }
    });
  }

  async findByPatient(tenantId: string, patientId: string): Promise<DentalChart | null> {
    const row = await this.prisma.dentalRecord.findFirst({
      where: { patientId, tenantId },
    });
    return row ? this.toDomain(row) : null;
  }

  async search(tenantId: string, patientId?: string): Promise<DentalChart[]> {
    const rows = await this.prisma.dentalRecord.findMany({
      where: {
        tenantId,
        ...(patientId ? { patientId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    patientId: string;
    odontogramMode?: string;
    odontogramState: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): DentalChart {
    const state = row.odontogramState as {
      teeth?: unknown[];
      procedures?: unknown[];
    } | null;

    const teeth = Array.isArray(state?.teeth) ? (state!.teeth as never[]) : [];
    const procedures = Array.isArray(state?.procedures) ? (state!.procedures as never[]) : [];
    const mode = row.odontogramMode?.toLowerCase() === 'pediatric' ? 'pediatric' : 'adult';

    return new DentalChart(
      row.id,
      row.tenantId,
      row.patientId,
      teeth,
      procedures,
      row.createdAt.toISOString(),
      row.updatedAt.toISOString(),
      mode,
    );
  }
}
