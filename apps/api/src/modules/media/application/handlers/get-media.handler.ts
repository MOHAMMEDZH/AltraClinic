import { Inject, Injectable, Optional } from '@nestjs/common';
import { GetMediaQuery } from '../queries/get-media.query';
import { MediaAssetRepository } from '../../domain/repositories/media-asset.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { MEDIA_ASSET_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { MediaNotFoundException } from '../../domain/exceptions/media.exceptions';
import { PhotoConsentMediaGateService } from '../../../clinical-forms/services/photo-consent-media-gate.service';

@Injectable()
export class GetMediaHandler {
  constructor(
    @Inject(MEDIA_ASSET_REPOSITORY) private readonly repo: MediaAssetRepository,
    private readonly tenantContext: TenantContextService,
    @Optional() private readonly photoConsentGate?: PhotoConsentMediaGateService,
  ) {}

  async execute(query: GetMediaQuery & { actorUserId?: string | null }) {
    const tenant = await this.tenantContext.resolve();
    const asset = await this.repo.findById(tenant.tenantId, query.id);
    if (!asset) throw new MediaNotFoundException(query.id);

    if (this.photoConsentGate) {
      await this.photoConsentGate.assertPhotoConsentForMedia({
        tenantId: tenant.tenantId,
        mediaAssetId: asset.id,
        actor: { userId: query.actorUserId ?? null },
      });
    }

    return {
      id: asset.id,
      tenantId: asset.tenantId,
      category: asset.category.value,
      ownerType: asset.ownerType,
      ownerId: asset.ownerId,
      patientId: asset.patientId,
      requiresPhotoConsent: asset.requiresPhotoConsent,
      originalFilename: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      status: asset.status,
      virusScanStatus: asset.virusScanStatus,
      variants: asset.variants.map((v) => ({
        type: v.type,
        mimeType: v.mimeType,
        sizeBytes: v.sizeBytes,
        width: v.width,
        height: v.height,
      })),
      metadata: asset.metadata.toPlain(),
      comparisonGroupId: asset.comparisonGroupId,
      comparisonRole: asset.comparisonRole,
      uploadedBy: asset.uploadedBy,
      processedAt: asset.processedAt?.toISOString() ?? null,
      createdAt: asset.createdAt.toISOString(),
    };
  }
}
