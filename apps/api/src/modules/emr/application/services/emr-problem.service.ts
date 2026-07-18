import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';

export interface PatientProblemRecord {
  id: string;
  patientId: string;
  code: string | null;
  codingSystem: string | null;
  description: string;
  status: 'active' | 'resolved';
  onsetDate: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class EmrProblemService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, patientId: string, status?: string): Promise<PatientProblemRecord[]> {
    const rows = await this.prisma.patientProblem.findMany({
      where: {
        tenantId,
        patientId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((r) => this.toRecord(r));
  }

  async create(
    tenantId: string,
    patientId: string,
    input: {
      code?: string | null;
      codingSystem?: string | null;
      description: string;
      onsetDate?: string | null;
    },
  ): Promise<PatientProblemRecord> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const row = await this.prisma.patientProblem.create({
      data: {
        tenantId,
        patientId,
        code: input.code?.trim() || null,
        codingSystem: input.codingSystem?.trim() || 'ICD-10',
        description: input.description.trim(),
        onsetDate: input.onsetDate ? new Date(input.onsetDate) : null,
        status: 'active',
      },
    });
    return this.toRecord(row);
  }

  async resolve(tenantId: string, problemId: string): Promise<PatientProblemRecord> {
    const existing = await this.prisma.patientProblem.findFirst({
      where: { id: problemId, tenantId },
    });
    if (!existing) throw new NotFoundException('Problem not found');

    const row = await this.prisma.patientProblem.update({
      where: { id: problemId },
      data: { status: 'resolved', resolvedAt: new Date() },
    });
    return this.toRecord(row);
  }

  private toRecord(row: {
    id: string;
    patientId: string;
    code: string | null;
    codingSystem: string | null;
    description: string;
    status: string;
    onsetDate: Date | null;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): PatientProblemRecord {
    return {
      id: row.id,
      patientId: row.patientId,
      code: row.code,
      codingSystem: row.codingSystem,
      description: row.description,
      status: row.status as 'active' | 'resolved',
      onsetDate: row.onsetDate?.toISOString() ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
