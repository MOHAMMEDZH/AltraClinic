import { Injectable } from '@nestjs/common';
import { AiModelStatus as PrismaAiStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AiModel } from '../domain/entities/ai-model.entity';
import { AiModelFilter, AiModelRepository } from '../domain/repositories/ai-model.repository.interface';
import { AiModelStatusVO } from '../domain/value-objects/ai-model-status.vo';
import { AiModelType } from '../domain/value-objects/ai-model-type';

// AiModelType is stored as VARCHAR in the schema (not a Prisma enum)
// — allows future extension without a migration.

const STATUS_TO_PRISMA: Record<string, PrismaAiStatus> = {
  draft: 'DRAFT',
  validated: 'VALIDATED',
  deployed: 'DEPLOYED',
  retired: 'RETIRED',
};

const STATUS_TO_DOMAIN: Record<PrismaAiStatus, string> = {
  DRAFT: 'draft',
  VALIDATED: 'validated',
  DEPLOYED: 'deployed',
  RETIRED: 'retired',
};

@Injectable()
export class PrismaAiModelRepository implements AiModelRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(model: AiModel): Promise<void> {
    await this.prisma.aiModel.upsert({
      where: { id: model.id },
      create: {
        id: model.id,
        tenantId: model.tenantId,
        branchId: model.branchId,
        nameEn: model.nameEn,
        nameAr: model.nameAr,
        descriptionEn: model.descriptionEn,
        descriptionAr: model.descriptionAr,
        modelType: model.modelType,           // string — no enum mapping needed
        version: model.version,
        status: STATUS_TO_PRISMA[model.status.value] as PrismaAiStatus,
        createdBy: model.createdBy,
        validatedBy: model.validatedBy ?? null,
        validatedAt: model.validatedAt ?? null,
        validationNotes: model.validationNotes ?? null,
        deployedBy: model.deployedBy ?? null,
        deployedAt: model.deployedAt ?? null,
        retiredBy: model.retiredBy ?? null,
        retiredAt: model.retiredAt ?? null,
        createdAt: model.createdAt,
      },
      update: {
        nameEn: model.nameEn,
        nameAr: model.nameAr,
        status: STATUS_TO_PRISMA[model.status.value] as PrismaAiStatus,
        validatedBy: model.validatedBy ?? null,
        validatedAt: model.validatedAt ?? null,
        validationNotes: model.validationNotes ?? null,
        deployedBy: model.deployedBy ?? null,
        deployedAt: model.deployedAt ?? null,
        retiredBy: model.retiredBy ?? null,
        retiredAt: model.retiredAt ?? null,
        updatedAt: model.updatedAt,
      },
    });
  }

  async findById(modelId: string, tenantId: string): Promise<AiModel | null> {
    const row = await this.prisma.aiModel.findFirst({
      where: { id: modelId, tenantId },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(filter: AiModelFilter): Promise<AiModel[]> {
    const rows = await this.prisma.aiModel.findMany({
      where: {
        tenantId: filter.tenantId,
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
        ...(filter.modelType ? { modelType: filter.modelType } : {}),
        ...(filter.status ? { status: STATUS_TO_PRISMA[filter.status] as PrismaAiStatus } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: filter.offset ?? 0,
      take: filter.limit ?? 50,
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    nameEn: string;
    nameAr: string;
    descriptionEn: string;
    descriptionAr: string;
    modelType: string;
    version: string;
    status: PrismaAiStatus;
    createdBy: string;
    validatedBy: string | null;
    validatedAt: Date | null;
    validationNotes: string | null;
    deployedBy: string | null;
    deployedAt: Date | null;
    retiredBy: string | null;
    retiredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): AiModel {
    const domainStatus = STATUS_TO_DOMAIN[row.status] as 'draft' | 'validated' | 'deployed' | 'retired';
    return AiModel.restore({
      modelId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      descriptionEn: row.descriptionEn,
      descriptionAr: row.descriptionAr,
      modelType: row.modelType.toLowerCase() as AiModelType,
      version: row.version,
      status: new AiModelStatusVO(domainStatus),
      createdBy: row.createdBy,
      validatedBy: row.validatedBy,
      validatedAt: row.validatedAt,
      validationNotes: row.validationNotes,
      deployedBy: row.deployedBy,
      deployedAt: row.deployedAt,
      retiredBy: row.retiredBy,
      retiredAt: row.retiredAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
