import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { MediaAsset, BeautyComparisonRoleType } from '../../domain/entities/media-asset.entity';
import { MediaAssetRepository } from '../../domain/repositories/media-asset.repository.interface';
import { MediaCategoryVO } from '../../domain/value-objects/media-category.vo';
import { MediaVariantVO } from '../../domain/value-objects/media-variant.vo';
import { MediaMetadataVO } from '../../domain/value-objects/media-metadata.vo';

@Injectable()
export class PrismaMediaAssetRepository implements MediaAssetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(asset: MediaAsset): Promise<void> {
    await this.prisma.mediaAsset.upsert({
      where: { id: asset.id },
      create: this.toCreate(asset),
      update: this.toUpdate(asset),
    });
  }

  async findById(tenantId: string, id: string): Promise<MediaAsset | null> {
    const row = await this.prisma.mediaAsset.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async sumStorageBytes(tenantId: string): Promise<number> {
    const rows = await this.prisma.mediaAsset.findMany({
      where: { tenantId, deletedAt: null, status: { not: 'DELETED' } },
      select: { sizeBytes: true, variants: true },
    });

    let total = 0;
    for (const row of rows) {
      total += Number(row.sizeBytes);
      const variants = (row.variants as Array<{ sizeBytes?: number }>) ?? [];
      for (const v of variants) {
        total += v.sizeBytes ?? 0;
      }
    }
    return total;
  }

  private toCreate(asset: MediaAsset) {
    return {
      id: asset.id,
      ...this.toUpdate(asset),
      createdAt: asset.createdAt,
    };
  }

  private toUpdate(asset: MediaAsset) {
    return {
      tenantId: asset.tenantId,
      branchId: asset.branchId,
      category: asset.category.toPrisma() as 'PATIENT_ATTACHMENT' | 'MEDICAL_DOCUMENT' | 'DENTAL_IMAGE' | 'BEAUTY_BEFORE_AFTER',
      ownerType: asset.ownerType,
      ownerId: asset.ownerId,
      patientId: asset.patientId,
      originalFilename: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: BigInt(asset.sizeBytes),
      status: MediaAsset.statusToPrisma(asset.status) as 'PENDING_SCAN' | 'PROCESSING' | 'READY' | 'QUARANTINED' | 'DELETED',
      virusScanStatus: MediaAsset.virusToPrisma(asset.virusScanStatus) as 'PENDING' | 'CLEAN' | 'INFECTED' | 'SKIPPED' | 'ERROR',
      storageKey: asset.storageKey,
      variants: asset.variants.map((v) => v.toPlain()),
      metadata: asset.metadata.toPlain(),
      comparisonGroupId: asset.comparisonGroupId,
      comparisonRole: asset.comparisonRole
        ? (asset.comparisonRole.toUpperCase() as 'BEFORE' | 'AFTER')
        : null,
      uploadedBy: asset.uploadedBy,
      quarantineReason: asset.quarantineReason,
      processedAt: asset.processedAt,
      updatedAt: asset.updatedAt,
      deletedAt: asset.deletedAt,
    };
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    category: string;
    ownerType: string;
    ownerId: string;
    patientId: string | null;
    originalFilename: string;
    mimeType: string;
    sizeBytes: bigint;
    status: string;
    virusScanStatus: string;
    storageKey: string;
    variants: unknown;
    metadata: unknown;
    comparisonGroupId: string | null;
    comparisonRole: string | null;
    uploadedBy: string;
    quarantineReason: string | null;
    processedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }): MediaAsset {
    const variantsRaw = (row.variants as unknown[]) ?? [];
    const comparisonRole = row.comparisonRole
      ? row.comparisonRole.toLowerCase() as BeautyComparisonRoleType
      : null;

    return MediaAsset.restore({
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      category: MediaCategoryVO.fromPrisma(row.category),
      ownerType: row.ownerType,
      ownerId: row.ownerId,
      patientId: row.patientId,
      originalFilename: row.originalFilename,
      mimeType: row.mimeType,
      sizeBytes: Number(row.sizeBytes),
      status: MediaAsset.statusFromPrisma(row.status),
      virusScanStatus: MediaAsset.virusFromPrisma(row.virusScanStatus),
      storageKey: row.storageKey,
      variants: variantsRaw.map((v) => MediaVariantVO.fromPlain(v)),
      metadata: MediaMetadataVO.fromPlain(row.metadata),
      comparisonGroupId: row.comparisonGroupId,
      comparisonRole,
      uploadedBy: row.uploadedBy,
      quarantineReason: row.quarantineReason,
      processedAt: row.processedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }
}
