import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';
import { MediaProcessingPipeline } from '../application/services/media-processing-pipeline.service';
import { LocalMediaStorageService } from '../infrastructure/storage/local-media-storage.service';
import { SharpMediaProcessorService } from '../infrastructure/processing/sharp-media-processor.service';
import { HookVirusScannerService } from '../infrastructure/virus-scan/noop-virus-scanner.service';
import { MediaAsset } from '../domain/entities/media-asset.entity';
import { MediaCategoryVO } from '../domain/value-objects/media-category.vo';

describe('MediaProcessingPipeline', () => {
  let basePath: string;
  let storage: LocalMediaStorageService;
  let scanner: HookVirusScannerService;
  let pipeline: MediaProcessingPipeline;
  let imageBuffer: Buffer;

  beforeAll(async () => {
    imageBuffer = await sharp({
      create: { width: 400, height: 300, channels: 3, background: '#336699' },
    })
      .png()
      .toBuffer();
  });

  beforeEach(async () => {
    basePath = await mkdtemp(join(tmpdir(), 'pipeline-test-'));
    storage = new LocalMediaStorageService({ basePath });
    scanner = new HookVirusScannerService();
    pipeline = new MediaProcessingPipeline(storage, scanner, new SharpMediaProcessorService());
  });

  afterEach(async () => {
    await rm(basePath, { recursive: true, force: true });
  });

  function createAsset(category = 'patient_attachment') {
    return MediaAsset.create({
      tenantId: 'tenant-1',
      branchId: null,
      category: new MediaCategoryVO(category),
      ownerType: 'patient',
      ownerId: 'patient-1',
      patientId: 'patient-1',
      originalFilename: 'photo.png',
      mimeType: 'image/png',
      sizeBytes: imageBuffer.length,
      storageKey: '',
      uploadedBy: 'user-1',
    });
  }

  it('processes clean image through full pipeline', async () => {
    const asset = createAsset();
    const { asset: result, bytesAdded } = await pipeline.execute({ asset, buffer: imageBuffer });

    expect(result.status).toBe('ready');
    expect(result.virusScanStatus).toBe('clean');
    expect(result.variants.length).toBeGreaterThan(1);
    expect(bytesAdded).toBeGreaterThan(0);
    expect(result.getVariant('thumbnail')).not.toBeNull();
  });

  it('quarantines infected files without storing variants', async () => {
    scanner.setHook(async () => ({
      status: 'infected',
      scannerName: 'test-scanner',
      details: 'Test virus signature',
    }));

    const asset = createAsset();
    const { asset: result, bytesAdded } = await pipeline.execute({ asset, buffer: imageBuffer });

    expect(result.status).toBe('quarantined');
    expect(result.virusScanStatus).toBe('infected');
    expect(bytesAdded).toBe(0);
  });

  it('processes medical documents without image variants', async () => {
    const asset = MediaAsset.create({
      tenantId: 'tenant-1',
      branchId: null,
      category: new MediaCategoryVO('medical_document'),
      ownerType: 'encounter',
      ownerId: 'encounter-1',
      patientId: null,
      originalFilename: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 20,
      storageKey: '',
      uploadedBy: 'user-1',
    });
    const pdfBuf = Buffer.from('%PDF-1.4 test document');

    const { asset: result } = await pipeline.execute({ asset, buffer: pdfBuf });

    expect(result.status).toBe('ready');
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].type).toBe('original');
  });
});
