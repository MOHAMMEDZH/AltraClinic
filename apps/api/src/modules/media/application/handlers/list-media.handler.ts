import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { MEDIA_ASSET_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { MediaAssetRepository } from '../../domain/repositories/media-asset.repository.interface';
import { MediaListService } from '../services/media-list.service';
import { MediaMetadataVO } from '../../domain/value-objects/media-metadata.vo';

@Injectable()
export class ListMediaHandler {
  constructor(
    private readonly listService: MediaListService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: {
    patientId?: string;
    category?: string;
    ownerType?: string;
    ownerId?: string;
    encounterId?: string;
    limit?: number;
    offset?: number;
  }) {
    const tenant = await this.tenantContext.resolve();
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    return this.listService.list({
      tenantId: tenant.tenantId,
      patientId: query.patientId,
      category: query.category,
      ownerType: query.ownerType,
      ownerId: query.ownerId,
      encounterId: query.encounterId,
      limit,
      offset,
    });
  }
}

@Injectable()
export class UpdateMediaHandler {
  constructor(
    @Inject(MEDIA_ASSET_REPOSITORY) private readonly repo: MediaAssetRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(id: string, clinical: Record<string, unknown>) {
    const tenant = await this.tenantContext.resolve();
    const asset = await this.repo.findById(tenant.tenantId, id);
    if (!asset) throw new NotFoundException('Media not found');

    asset.metadata = asset.metadata.withClinical(clinical);
    asset.updatedAt = new Date();
    await this.repo.save(asset);

    return {
      id: asset.id,
      metadata: asset.metadata.toPlain(),
      updatedAt: asset.updatedAt.toISOString(),
    };
  }
}

function parseClinicalFromUpload(input: {
  imagingType?: string;
  title?: string;
  toothNumbers?: string;
  encounterId?: string;
}) {
  let toothNumbers: number[] | undefined;
  if (input.toothNumbers?.trim()) {
    try {
      const parsed = JSON.parse(input.toothNumbers) as unknown;
      if (Array.isArray(parsed)) {
        toothNumbers = parsed.map(Number).filter((n) => !Number.isNaN(n));
      }
    } catch {
      toothNumbers = input.toothNumbers.split(/[,\s]+/).map(Number).filter((n) => !Number.isNaN(n));
    }
  }
  if (!input.imagingType && !input.title && !toothNumbers?.length && !input.encounterId) return null;
  return {
    imagingType: input.imagingType ?? null,
    title: input.title ?? null,
    toothNumbers,
    encounterId: input.encounterId ?? null,
  };
}

export { parseClinicalFromUpload };
