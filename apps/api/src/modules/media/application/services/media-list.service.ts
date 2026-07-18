import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';

export interface MediaListFilter {
  tenantId: string;
  patientId?: string;
  category?: string;
  ownerType?: string;
  ownerId?: string;
  encounterId?: string;
  limit: number;
  offset: number;
}

@Injectable()
export class MediaListService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: MediaListFilter) {
    const where: Prisma.MediaAssetWhereInput = {
      tenantId: filter.tenantId,
      deletedAt: null,
      status: { not: 'DELETED' },
    };
    if (filter.patientId) where.patientId = filter.patientId;
    if (filter.category) {
      where.category = filter.category.toUpperCase().replace(/-/g, '_') as Prisma.EnumMediaCategoryFilter;
    }
    if (filter.ownerType) where.ownerType = filter.ownerType;
    if (filter.ownerId) where.ownerId = filter.ownerId;

    const [rows, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filter.offset,
        take: filter.limit,
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);

    let items = rows.map((r) => this.toItem(r));

    if (filter.encounterId) {
      items = items.filter((item) => {
        const clinical = (item.metadata as { clinical?: { encounterId?: string } })?.clinical;
        return clinical?.encounterId === filter.encounterId;
      });
    }

    return { total, items };
  }

  private toItem(row: {
    id: string;
    category: string;
    ownerType: string;
    ownerId: string;
    patientId: string | null;
    originalFilename: string;
    mimeType: string;
    sizeBytes: bigint;
    status: string;
    variants: unknown;
    metadata: unknown;
    comparisonGroupId: string | null;
    comparisonRole: string | null;
    createdAt: Date;
    processedAt: Date | null;
  }) {
    const variants = Array.isArray(row.variants) ? row.variants : [];
    const thumb = variants.find((v: { type?: string }) => v.type === 'thumbnail');
    return {
      id: row.id,
      category: row.category.toLowerCase(),
      ownerType: row.ownerType,
      ownerId: row.ownerId,
      patientId: row.patientId,
      originalFilename: row.originalFilename,
      mimeType: row.mimeType,
      sizeBytes: Number(row.sizeBytes),
      status: row.status.toLowerCase(),
      variants,
      metadata: row.metadata ?? {},
      comparisonGroupId: row.comparisonGroupId,
      comparisonRole: row.comparisonRole?.toLowerCase() ?? null,
      createdAt: row.createdAt.toISOString(),
      processedAt: row.processedAt?.toISOString() ?? null,
      thumbnailWidth: (thumb as { width?: number })?.width ?? null,
      thumbnailHeight: (thumb as { height?: number })?.height ?? null,
    };
  }
}
