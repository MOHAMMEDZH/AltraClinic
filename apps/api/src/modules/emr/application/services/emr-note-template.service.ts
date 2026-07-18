import { Injectable, NotFoundException } from '@nestjs/common';
import { ClinicalNoteType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { generateEntityId } from '../../../../common/id-generator.util';
import type { TenantNoteTemplate, SoapNotes } from '../../domain/emr.types';

@Injectable()
export class EmrNoteTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<TenantNoteTemplate[]> {
    const rows = await this.prisma.clinicalNoteTemplate.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => this.toTemplate(r));
  }

  async listAll(tenantId: string): Promise<TenantNoteTemplate[]> {
    const rows = await this.prisma.clinicalNoteTemplate.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => this.toTemplate(r));
  }

  async create(
    tenantId: string,
    input: {
      name: string;
      noteType: string;
      soapNotes?: SoapNotes;
      body?: string | null;
      sortOrder?: number;
    },
  ): Promise<TenantNoteTemplate> {
    const row = await this.prisma.clinicalNoteTemplate.create({
      data: {
        id: generateEntityId('noteTpl'),
        tenantId,
        name: input.name.trim(),
        noteType: this.parseNoteType(input.noteType),
        soapNotes: (input.soapNotes ?? {}) as Prisma.InputJsonValue,
        body: input.body?.trim() || null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    return this.toTemplate(row);
  }

  async update(
    tenantId: string,
    id: string,
    input: {
      name?: string;
      noteType?: string;
      soapNotes?: SoapNotes;
      body?: string | null;
      isActive?: boolean;
      sortOrder?: number;
    },
  ): Promise<TenantNoteTemplate> {
    const existing = await this.prisma.clinicalNoteTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Template not found');

    const row = await this.prisma.clinicalNoteTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.noteType !== undefined ? { noteType: this.parseNoteType(input.noteType) } : {}),
        ...(input.soapNotes !== undefined
          ? { soapNotes: input.soapNotes as Prisma.InputJsonValue }
          : {}),
        ...(input.body !== undefined ? { body: input.body?.trim() || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
    return this.toTemplate(row);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const existing = await this.prisma.clinicalNoteTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Template not found');
    await this.prisma.clinicalNoteTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private parseNoteType(value: string): ClinicalNoteType {
    const normalized = value.toUpperCase().replace(/-/g, '_');
    if (Object.values(ClinicalNoteType).includes(normalized as ClinicalNoteType)) {
      return normalized as ClinicalNoteType;
    }
    return ClinicalNoteType.CONSULTATION;
  }

  private toTemplate(row: {
    id: string;
    tenantId: string;
    name: string;
    noteType: ClinicalNoteType;
    soapNotes: unknown;
    body: string | null;
    isActive: boolean;
    sortOrder: number;
  }): TenantNoteTemplate {
    const soap = (row.soapNotes ?? {}) as SoapNotes;
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      noteType: row.noteType.toLowerCase().replace(/_/g, '-') as TenantNoteTemplate['noteType'],
      soapNotes: {
        subjective: soap.subjective ?? '',
        objective: soap.objective ?? '',
        assessment: soap.assessment ?? '',
        plan: soap.plan ?? '',
      },
      body: row.body,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    };
  }
}
