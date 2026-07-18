import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { generateEntityId } from '../../../../common/id-generator.util';
import type { LabResultRecord } from '../../domain/emr.types';

@Injectable()
export class EmrLabService {
  constructor(private readonly prisma: PrismaService) {}

  async listForPatient(tenantId: string, patientId: string, encounterId?: string): Promise<LabResultRecord[]> {
    const rows = await this.prisma.labResult.findMany({
      where: {
        tenantId,
        patientId,
        ...(encounterId ? { encounterId } : {}),
      },
      orderBy: { resultedAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toRecord(r));
  }

  async create(
    tenantId: string,
    input: {
      patientId: string;
      encounterId?: string | null;
      testName: string;
      value: string;
      unit?: string | null;
      referenceRange?: string | null;
      status?: string | null;
      resultedAt: string;
      notes?: string | null;
    },
  ): Promise<LabResultRecord> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: input.patientId, tenantId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const row = await this.prisma.labResult.create({
      data: {
        id: generateEntityId('lab'),
        tenantId,
        patientId: input.patientId,
        encounterId: input.encounterId ?? null,
        testName: input.testName.trim(),
        value: input.value.trim(),
        unit: input.unit?.trim() || null,
        referenceRange: input.referenceRange?.trim() || null,
        status: input.status?.trim() || null,
        resultedAt: new Date(input.resultedAt),
        notes: input.notes?.trim() || null,
      },
    });
    return this.toRecord(row);
  }

  private toRecord(row: {
    id: string;
    tenantId: string;
    patientId: string;
    encounterId: string | null;
    testName: string;
    value: string;
    unit: string | null;
    referenceRange: string | null;
    status: string | null;
    resultedAt: Date;
    notes: string | null;
    createdAt: Date;
  }): LabResultRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      patientId: row.patientId,
      encounterId: row.encounterId,
      testName: row.testName,
      value: row.value,
      unit: row.unit,
      referenceRange: row.referenceRange,
      status: row.status,
      resultedAt: row.resultedAt.toISOString(),
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
