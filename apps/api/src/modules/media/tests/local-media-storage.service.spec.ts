import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { LocalMediaStorageService } from '../infrastructure/storage/local-media-storage.service';

describe('LocalMediaStorageService', () => {
  let basePath: string;
  let storage: LocalMediaStorageService;

  beforeEach(async () => {
    basePath = await mkdtemp(join(tmpdir(), 'media-test-'));
    storage = new LocalMediaStorageService({ basePath });
  });

  afterEach(async () => {
    await rm(basePath, { recursive: true, force: true });
  });

  it('stores and retrieves bytes', async () => {
    const buf = Buffer.from('hello-media');
    const { storageKey } = await storage.put({
      tenantId: 'tenant-a',
      assetId: 'asset-1',
      variant: 'original',
      extension: 'txt',
      buffer: buf,
      mimeType: 'text/plain',
    });

    const retrieved = await storage.get(storageKey);
    expect(retrieved.toString()).toBe('hello-media');
  });

  it('builds tenant-scoped keys', () => {
    const key = storage.buildKey('tenant-a', 'asset-1', 'thumbnail', 'jpg');
    expect(key).toBe('tenant-a/asset-1/thumbnail.jpg');
  });

  it('rejects path traversal in storage keys', async () => {
    await expect(storage.get('../etc/passwd')).rejects.toThrow('Invalid storage key');
  });

  it('deletes stored objects', async () => {
    const { storageKey } = await storage.put({
      tenantId: 'tenant-a',
      assetId: 'asset-2',
      variant: 'original',
      extension: 'bin',
      buffer: Buffer.from('x'),
      mimeType: 'application/octet-stream',
    });
    await storage.delete(storageKey);
    await expect(storage.get(storageKey)).rejects.toThrow();
  });
});
