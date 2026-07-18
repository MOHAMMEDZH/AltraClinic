import { MediaCategoryVO } from '../domain/value-objects/media-category.vo';
import { MediaAsset } from '../domain/entities/media-asset.entity';
import { MediaVariantVO } from '../domain/value-objects/media-variant.vo';
import { MediaMetadataVO } from '../domain/value-objects/media-metadata.vo';

describe('MediaCategoryVO', () => {
  it('accepts all supported categories', () => {
    expect(new MediaCategoryVO('patient_attachment').value).toBe('patient_attachment');
    expect(new MediaCategoryVO('medical_document').value).toBe('medical_document');
    expect(new MediaCategoryVO('dental_image').value).toBe('dental_image');
    expect(new MediaCategoryVO('beauty_before_after').value).toBe('beauty_before_after');
  });

  it('rejects unknown categories', () => {
    expect(() => new MediaCategoryVO('video_clip')).toThrow('Invalid media category');
  });

  it('identifies image categories', () => {
    expect(new MediaCategoryVO('dental_image').isImageCategory()).toBe(true);
    expect(new MediaCategoryVO('medical_document').isImageCategory()).toBe(false);
  });
});

describe('MediaAsset entity', () => {
  const base = () =>
    MediaAsset.create({
      tenantId: 'tenant-1',
      branchId: null,
      category: new MediaCategoryVO('patient_attachment'),
      ownerType: 'patient',
      ownerId: 'owner-1',
      patientId: 'patient-1',
      originalFilename: 'scan.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      storageKey: 'key/original.jpg',
      uploadedBy: 'user-1',
    });

  it('starts in pending_scan status', () => {
    const asset = base();
    expect(asset.status).toBe('pending_scan');
    expect(asset.virusScanStatus).toBe('pending');
  });

  it('marks ready with variants', () => {
    const asset = base();
    const variants = [
      new MediaVariantVO({ type: 'original', storageKey: 'k1', mimeType: 'image/jpeg', sizeBytes: 100 }),
      new MediaVariantVO({ type: 'thumbnail', storageKey: 'k2', mimeType: 'image/jpeg', sizeBytes: 50 }),
    ];
    asset.markReady(variants, new MediaMetadataVO({ width: 100, height: 100, exifStripped: true }));
    expect(asset.status).toBe('ready');
    expect(asset.variants).toHaveLength(2);
    expect(asset.isDownloadable()).toBe(true);
  });

  it('quarantines infected files', () => {
    const asset = base();
    asset.quarantine('EICAR test string detected');
    expect(asset.status).toBe('quarantined');
    expect(asset.isDownloadable()).toBe(false);
  });

  it('calculates total storage bytes', () => {
    const asset = base();
    asset.markReady(
      [new MediaVariantVO({ type: 'webp', storageKey: 'k', mimeType: 'image/webp', sizeBytes: 200 })],
      new MediaMetadataVO(),
    );
    expect(asset.totalStorageBytes()).toBe(1024 + 200);
  });
});
