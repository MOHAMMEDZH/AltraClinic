import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { MediaMetadataVO } from '../../domain/value-objects/media-metadata.vo';
import { MediaVariantVO } from '../../domain/value-objects/media-variant.vo';
import { MediaStoragePort } from '../storage/media-storage.port';

export interface ProcessedMediaOutput {
  variants: MediaVariantVO[];
  metadata: MediaMetadataVO;
  totalBytes: number;
}

export interface ImageProcessingOptions {
  thumbnailMaxSize?: number;
  compressedMaxWidth?: number;
  webpQuality?: number;
  avifQuality?: number;
  generateAvif?: boolean;
}

const DEFAULT_OPTIONS: Required<ImageProcessingOptions> = {
  thumbnailMaxSize: 256,
  compressedMaxWidth: 1920,
  webpQuality: 80,
  avifQuality: 50,
  generateAvif: true,
};

const IMAGE_MIME_PREFIX = 'image/';

/**
 * Sharp-based image processor.
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Process images async via BullMQ queue — uploads shouldn't block."
 *   Counter: For files < 10MB, Sharp processing takes 100–500ms — acceptable
 *   synchronously in the handler. Async adds complexity (partial state, retry logic).
 *   Phase 2: Move to queue when p95 upload latency exceeds 2s or file size > 25MB.
 *   Decision: Sync processing now, queue-ready pipeline interface.
 *
 *   Challenger: "AVIF encoding is CPU-heavy — skip for dental X-rays."
 *   Counter: AVIF is optional via generateAvif flag. Dental/medical images benefit
 *   most from compression; AVIF can be disabled per category in pipeline config.
 *
 * PRIVACY:
 *   All outputs re-encoded through Sharp, which strips EXIF by default.
 *   metadata.exifStripped = true on all processed images.
 */
@Injectable()
export class SharpMediaProcessorService {
  private readonly logger = new Logger(SharpMediaProcessorService.name);

  isProcessableImage(mimeType: string): boolean {
    if (!mimeType.startsWith(IMAGE_MIME_PREFIX)) return false;
    // Skip SVG (vector) and GIF (animated) — store original only
    if (mimeType === 'image/svg+xml' || mimeType === 'image/gif') return false;
    return true;
  }

  async processImage(input: {
    tenantId: string;
    assetId: string;
    buffer: Buffer;
    mimeType: string;
    storage: MediaStoragePort;
    options?: ImageProcessingOptions;
  }): Promise<ProcessedMediaOutput> {
    const opts = { ...DEFAULT_OPTIONS, ...input.options };
    const checksumSha256 = createHash('sha256').update(input.buffer).digest('hex');

    const image = sharp(input.buffer, { failOn: 'none' });
    const meta = await image.metadata();

    const metadata = new MediaMetadataVO({
      format: meta.format ?? null,
      width: meta.width ?? null,
      height: meta.height ?? null,
      hasAlpha: meta.hasAlpha ?? false,
      orientation: meta.orientation ?? null,
      exifStripped: true,
      checksumSha256,
    });

    const variants: MediaVariantVO[] = [];

    // Compressed JPEG (max width, quality 85)
    const compressedBuf = await sharp(input.buffer)
      .rotate()
      .resize({ width: opts.compressedMaxWidth, withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    const compressed = await input.storage.put({
      tenantId: input.tenantId,
      assetId: input.assetId,
      variant: 'compressed',
      extension: 'jpg',
      buffer: compressedBuf,
      mimeType: 'image/jpeg',
    });
    const compressedMeta = await sharp(compressedBuf).metadata();
    variants.push(new MediaVariantVO({
      type: 'compressed',
      storageKey: compressed.storageKey,
      mimeType: 'image/jpeg',
      sizeBytes: compressed.sizeBytes,
      width: compressedMeta.width ?? null,
      height: compressedMeta.height ?? null,
    }));

    // Thumbnail
    const thumbBuf = await sharp(input.buffer)
      .rotate()
      .resize(opts.thumbnailMaxSize, opts.thumbnailMaxSize, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();

    const thumb = await input.storage.put({
      tenantId: input.tenantId,
      assetId: input.assetId,
      variant: 'thumbnail',
      extension: 'jpg',
      buffer: thumbBuf,
      mimeType: 'image/jpeg',
    });
    const thumbMeta = await sharp(thumbBuf).metadata();
    variants.push(new MediaVariantVO({
      type: 'thumbnail',
      storageKey: thumb.storageKey,
      mimeType: 'image/jpeg',
      sizeBytes: thumb.sizeBytes,
      width: thumbMeta.width ?? null,
      height: thumbMeta.height ?? null,
    }));

    // WebP
    const webpBuf = await sharp(input.buffer)
      .rotate()
      .resize({ width: opts.compressedMaxWidth, withoutEnlargement: true })
      .webp({ quality: opts.webpQuality })
      .toBuffer();

    const webp = await input.storage.put({
      tenantId: input.tenantId,
      assetId: input.assetId,
      variant: 'webp',
      extension: 'webp',
      buffer: webpBuf,
      mimeType: 'image/webp',
    });
    const webpMeta = await sharp(webpBuf).metadata();
    variants.push(new MediaVariantVO({
      type: 'webp',
      storageKey: webp.storageKey,
      mimeType: 'image/webp',
      sizeBytes: webp.sizeBytes,
      width: webpMeta.width ?? null,
      height: webpMeta.height ?? null,
    }));

    // AVIF (optional — skip if encoding fails on platform)
    if (opts.generateAvif) {
      try {
        const avifBuf = await sharp(input.buffer)
          .rotate()
          .resize({ width: opts.compressedMaxWidth, withoutEnlargement: true })
          .avif({ quality: opts.avifQuality })
          .toBuffer();

        const avif = await input.storage.put({
          tenantId: input.tenantId,
          assetId: input.assetId,
          variant: 'avif',
          extension: 'avif',
          buffer: avifBuf,
          mimeType: 'image/avif',
        });
        const avifMeta = await sharp(avifBuf).metadata();
        variants.push(new MediaVariantVO({
          type: 'avif',
          storageKey: avif.storageKey,
          mimeType: 'image/avif',
          sizeBytes: avif.sizeBytes,
          width: avifMeta.width ?? null,
          height: avifMeta.height ?? null,
        }));
      } catch (err) {
        this.logger.warn(`AVIF encoding skipped for asset ${input.assetId}: ${(err as Error).message}`);
      }
    }

    const totalBytes = variants.reduce((sum, v) => sum + v.sizeBytes, 0);
    return { variants, metadata, totalBytes };
  }

  /** Extract metadata from non-processable files (documents). */
  extractDocumentMetadata(buffer: Buffer, mimeType: string): MediaMetadataVO {
    return new MediaMetadataVO({
      format: mimeType.split('/')[1] ?? 'unknown',
      checksumSha256: createHash('sha256').update(buffer).digest('hex'),
      exifStripped: false,
    });
  }
}
