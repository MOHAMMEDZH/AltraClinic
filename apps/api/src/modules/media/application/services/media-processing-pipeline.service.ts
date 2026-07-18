import { Inject, Injectable, Logger } from '@nestjs/common';
import { MediaAsset } from '../../domain/entities/media-asset.entity';
import { MediaVariantVO } from '../../domain/value-objects/media-variant.vo';
import { MediaMetadataVO } from '../../domain/value-objects/media-metadata.vo';
import { MediaStoragePort, MEDIA_STORAGE } from '../../infrastructure/storage/media-storage.port';
import { VirusScannerPort, VIRUS_SCANNER } from '../../infrastructure/virus-scan/virus-scanner.port';
import { SharpMediaProcessorService } from '../../infrastructure/processing/sharp-media-processor.service';

export interface PipelineInput {
  asset: MediaAsset;
  buffer: Buffer;
}

export interface PipelineResult {
  asset: MediaAsset;
  bytesAdded: number;
}

/**
 * MediaProcessingPipeline
 *
 * Orchestrates the full upload → scan → store → transform → persist flow.
 *
 * PIPELINE STAGES:
 *   1. Virus scan (hook — quarantine on infected)
 *   2. Store original in secure storage
 *   3. Image processing (compression, thumbnail, webp, avif) OR document metadata
 *   4. Mark asset READY with variants
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Scan AFTER store, not before — ClamAV needs the file on disk."
 *   Counter: We scan the in-memory buffer before any persistence. ClamAV accepts
 *   streams/buffers via INSTREAM. Storing infected files—even in quarantine—
 *   increases attack surface. Scan-first is the safer order.
 *   Decision: Scan buffer → store clean files only.
 */
@Injectable()
export class MediaProcessingPipeline {
  private readonly logger = new Logger(MediaProcessingPipeline.name);

  constructor(
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStoragePort,
    @Inject(VIRUS_SCANNER) private readonly virusScanner: VirusScannerPort,
    private readonly processor: SharpMediaProcessorService,
  ) {}

  async execute(input: PipelineInput): Promise<PipelineResult> {
    const { asset, buffer } = input;
    asset.markProcessing();

    // Stage 1: Virus scan
    const scanResult = await this.virusScanner.scan({
      buffer,
      filename: asset.originalFilename,
      mimeType: asset.mimeType,
      tenantId: asset.tenantId,
    });

    if (scanResult.status === 'infected') {
      asset.quarantine(scanResult.details ?? 'Virus detected', 'infected');
      this.logger.warn(`Media ${asset.id} quarantined: ${scanResult.details}`);
      return { asset, bytesAdded: 0 };
    }

    if (scanResult.status === 'error') {
      asset.markVirusScan('error');
      // Fail closed in production would quarantine; dev allows through with warning
      this.logger.warn(`Virus scan error for ${asset.id}: ${scanResult.details}`);
    } else {
      asset.markVirusScan('clean');
    }

    // Stage 2: Store original
    const ext = this.extensionFromFilename(asset.originalFilename, asset.mimeType);
    const original = await this.storage.put({
      tenantId: asset.tenantId,
      assetId: asset.id,
      variant: 'original',
      extension: ext,
      buffer,
      mimeType: asset.mimeType,
    });
    asset.storageKey = original.storageKey;

    const originalVariant = new MediaVariantVO({
      type: 'original',
      storageKey: original.storageKey,
      mimeType: asset.mimeType,
      sizeBytes: original.sizeBytes,
    });

    let variants: MediaVariantVO[] = [originalVariant];
    let metadata: MediaMetadataVO;
    let bytesAdded = original.sizeBytes;

    // Stage 3: Process images or extract document metadata
    if (this.processor.isProcessableImage(asset.mimeType)) {
      const processed = await this.processor.processImage({
        tenantId: asset.tenantId,
        assetId: asset.id,
        buffer,
        mimeType: asset.mimeType,
        storage: this.storage,
        options: {
          generateAvif: asset.category.value !== 'dental_image',
        },
      });
      variants = [originalVariant, ...processed.variants];
      metadata = processed.metadata;
      bytesAdded += processed.totalBytes;
    } else {
      metadata = this.processor.extractDocumentMetadata(buffer, asset.mimeType);
    }

    // Stage 4: Mark ready
    asset.markReady(variants, metadata);
    this.logger.log(`Media ${asset.id} processed: ${variants.length} variants, ${bytesAdded} bytes`);

    return { asset, bytesAdded };
  }

  private extensionFromFilename(filename: string, mimeType: string): string {
    const parts = filename.split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    }
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    };
    return map[mimeType] ?? 'bin';
  }
}
