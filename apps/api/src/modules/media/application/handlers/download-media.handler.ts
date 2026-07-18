import { Inject, Injectable } from '@nestjs/common';
import { DownloadMediaQuery } from '../queries/download-media.query';
import { MediaAssetRepository } from '../../domain/repositories/media-asset.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { MEDIA_ASSET_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { MEDIA_STORAGE, MediaStoragePort } from '../../infrastructure/storage/media-storage.port';
import {
  MediaNotFoundException,
  MediaQuarantinedException,
} from '../../domain/exceptions/media.exceptions';

@Injectable()
export class DownloadMediaHandler {
  constructor(
    @Inject(MEDIA_ASSET_REPOSITORY) private readonly repo: MediaAssetRepository,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStoragePort,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: DownloadMediaQuery) {
    const tenant = await this.tenantContext.resolve();
    const asset = await this.repo.findById(tenant.tenantId, query.id);
    if (!asset) throw new MediaNotFoundException(query.id);

    if (asset.status === 'quarantined') {
      throw new MediaQuarantinedException(asset.id, asset.quarantineReason ?? 'quarantined');
    }

    if (!asset.isDownloadable()) {
      throw new MediaNotFoundException(query.id);
    }

    const variantType = query.variant ?? 'original';
    const variant = asset.getVariant(variantType);
    if (!variant) {
      throw new MediaNotFoundException(`${query.id}/${variantType}`);
    }

    const buffer = await this.storage.get(variant.storageKey);

    return {
      buffer,
      mimeType: variant.mimeType,
      filename: asset.originalFilename,
      sizeBytes: variant.sizeBytes,
    };
  }
}
