import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';
import { SharpMediaProcessorService } from '../infrastructure/processing/sharp-media-processor.service';
import { LocalMediaStorageService } from '../infrastructure/storage/local-media-storage.service';

describe('SharpMediaProcessorService', () => {
  let basePath: string;
  let storage: LocalMediaStorageService;
  let processor: SharpMediaProcessorService;
  let imageBuffer: Buffer;

  beforeAll(async () => {
    imageBuffer = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 100, b: 50 } },
    })
      .jpeg()
      .toBuffer();
  });

  beforeEach(async () => {
    basePath = await mkdtemp(join(tmpdir(), 'sharp-test-'));
    storage = new LocalMediaStorageService({ basePath });
    processor = new SharpMediaProcessorService();
  });

  afterEach(async () => {
    await rm(basePath, { recursive: true, force: true });
  });

  it('identifies processable image mime types', () => {
    expect(processor.isProcessableImage('image/jpeg')).toBe(true);
    expect(processor.isProcessableImage('image/png')).toBe(true);
    expect(processor.isProcessableImage('application/pdf')).toBe(false);
    expect(processor.isProcessableImage('image/gif')).toBe(false);
  });

  it('generates compressed, thumbnail, and webp variants', async () => {
    const result = await processor.processImage({
      tenantId: 'tenant-1',
      assetId: 'asset-1',
      buffer: imageBuffer,
      mimeType: 'image/jpeg',
      storage,
      options: { generateAvif: false },
    });

    const types = result.variants.map((v) => v.type);
    expect(types).toContain('compressed');
    expect(types).toContain('thumbnail');
    expect(types).toContain('webp');
    expect(result.metadata.exifStripped).toBe(true);
    expect(result.metadata.width).toBe(800);
    expect(result.metadata.checksumSha256).toHaveLength(64);
  });

  it('thumbnail is smaller than original dimensions', async () => {
    const result = await processor.processImage({
      tenantId: 'tenant-1',
      assetId: 'asset-2',
      buffer: imageBuffer,
      mimeType: 'image/jpeg',
      storage,
      options: { generateAvif: false },
    });

    const thumb = result.variants.find((v) => v.type === 'thumbnail')!;
    expect(thumb.width!).toBeLessThanOrEqual(256);
    expect(thumb.height!).toBeLessThanOrEqual(256);
  });

  it('extracts document metadata for PDF mime type', () => {
    const buf = Buffer.from('%PDF-1.4 fake');
    const meta = processor.extractDocumentMetadata(buf, 'application/pdf');
    expect(meta.format).toBe('pdf');
    expect(meta.checksumSha256).toHaveLength(64);
  });
});
