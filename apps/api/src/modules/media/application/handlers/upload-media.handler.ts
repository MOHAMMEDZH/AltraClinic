import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { UploadMediaCommand } from '../commands/upload-media.command';
import { MediaAsset } from '../../domain/entities/media-asset.entity';
import { MediaCategoryVO } from '../../domain/value-objects/media-category.vo';
import { MediaAssetRepository } from '../../domain/repositories/media-asset.repository.interface';
import { MediaProcessingPipeline } from '../services/media-processing-pipeline.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { MEDIA_ASSET_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { SubscriptionEnforcementService } from '../../../subscription/application/services/subscription-enforcement.service';
import {
  MediaFileTooLargeException,
  UnsupportedMediaTypeException,
} from '../../domain/exceptions/media.exceptions';
import {
  MediaUploadedEvent,
  MediaProcessedEvent,
  MediaQuarantinedEvent,
} from '../../domain/events/media.events';
import { assertMediaOwnerReference } from '../../services/media-owner-reference.validation';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'application/dicom',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function maxFileSizeBytes(): number {
  return parseInt(process.env.MEDIA_MAX_FILE_SIZE_BYTES ?? String(50 * 1024 * 1024), 10);
}

@Injectable()
export class UploadMediaHandler {
  constructor(
    @Inject(MEDIA_ASSET_REPOSITORY) private readonly repo: MediaAssetRepository,
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
    private readonly pipeline: MediaProcessingPipeline,
    private readonly enforcement: SubscriptionEnforcementService,
  ) {}

  async execute(cmd: UploadMediaCommand) {
    const tenant = await this.tenantContext.resolve();

    if (cmd.buffer.length > maxFileSizeBytes()) {
      throw new MediaFileTooLargeException(maxFileSizeBytes());
    }

    if (!ALLOWED_MIME_TYPES.has(cmd.mimeType)) {
      throw new UnsupportedMediaTypeException(cmd.mimeType);
    }

    const category = new MediaCategoryVO(cmd.category);

    if (category.requiresPatientLink() && !cmd.patientId) {
      throw new UnsupportedMediaTypeException('patientId required for this category');
    }

    if (cmd.patientId?.trim()) {
      const patient = await this.prisma.patient.findFirst({
        where: { id: cmd.patientId, tenantId: tenant.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!patient) {
        throw new NotFoundException('patientId does not belong to the current tenant');
      }
    }

    const encounterId = cmd.clinical?.encounterId?.trim() || null;
    if (encounterId) {
      const encounter = await this.prisma.encounter.findFirst({
        where: { id: encounterId, tenantId: tenant.tenantId, deletedAt: null },
        select: { id: true, patientId: true },
      });
      if (!encounter) {
        throw new BadRequestException('encounterId does not belong to the current tenant');
      }
      if (cmd.patientId?.trim() && encounter.patientId !== cmd.patientId) {
        throw new BadRequestException('encounterId patient does not match patientId');
      }
    }

    await assertMediaOwnerReference(this.prisma, tenant.tenantId, cmd.ownerType, cmd.ownerId, {
      patientId: cmd.patientId ?? null,
      encounterId,
    });

    await this.enforcement.enforceStorageLimit(tenant.tenantId, cmd.buffer.length);

    const asset = MediaAsset.create({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      category,
      ownerType: cmd.ownerType,
      ownerId: cmd.ownerId,
      patientId: cmd.patientId ?? null,
      originalFilename: cmd.originalFilename,
      mimeType: cmd.mimeType,
      sizeBytes: cmd.buffer.length,
      storageKey: '',
      uploadedBy: cmd.uploadedBy,
      comparisonGroupId: cmd.comparisonGroupId ?? null,
      comparisonRole: cmd.comparisonRole ?? null,
    });

    await this.repo.save(asset);

    await this.events.publish(
      new MediaUploadedEvent(
        tenant.tenantId,
        tenant.branchId ?? null,
        asset.id,
        category.value,
        cmd.ownerType,
        cmd.ownerId,
        cmd.patientId ?? null,
        cmd.uploadedBy,
      ),
    );

    const { asset: processed, bytesAdded } = await this.pipeline.execute({ asset, buffer: cmd.buffer });

    if (cmd.clinical) {
      processed.metadata = processed.metadata.withClinical(cmd.clinical);
    }

    await this.repo.save(processed);

    if (processed.status === 'quarantined') {
      await this.events.publish(
        new MediaQuarantinedEvent(tenant.tenantId, processed.id, processed.quarantineReason ?? 'quarantined'),
      );
      return {
        mediaId: processed.id,
        status: processed.status,
        quarantineReason: processed.quarantineReason,
      };
    }

    await this.events.publish(
      new MediaProcessedEvent(
        tenant.tenantId,
        processed.id,
        processed.variants.length,
        processed.totalStorageBytes(),
      ),
    );

    return {
      mediaId: processed.id,
      status: processed.status,
      variants: processed.variants.map((v) => ({
        type: v.type,
        mimeType: v.mimeType,
        sizeBytes: v.sizeBytes,
        width: v.width,
        height: v.height,
      })),
      metadata: processed.metadata.toPlain(),
      bytesAdded,
    };
  }
}
