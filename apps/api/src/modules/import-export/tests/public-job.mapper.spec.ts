import { toPublicImportExportJob, sanitizeJobMetadata } from '../application/public-job.mapper';
import type { ImportExportJob } from '../domain/job/import-export-job.types';

describe('public-job.mapper', () => {
  it('redacts absolute filesystem paths from job metadata', () => {
    const job = {
      id: 'job-1',
      tenantId: 'tenant-a',
      metadata: {
        storagePath: 'C:\\Users\\app\\storage\\import-export\\file.csv',
        storageKey: 'tenant-a/job-1/file.csv',
        absolutePath: '/var/data/secret.csv',
        filename: 'file.csv',
      },
    } as unknown as ImportExportJob;

    const publicJob = toPublicImportExportJob(job);
    expect(publicJob.metadata.storageKey).toBe('tenant-a/job-1/file.csv');
    expect(publicJob.metadata.filename).toBe('file.csv');
    expect(publicJob.metadata.storagePath).toBeUndefined();
    expect(publicJob.metadata.absolutePath).toBeUndefined();
    expect(JSON.stringify(publicJob)).not.toMatch(/C:\\Users|\/var\/data/);
  });

  it('sanitizes metadata copies without mutating source', () => {
    const metadata = {
      source: 'api' as const,
      storagePath: '/tmp/x',
      storageKey: 'k',
    };
    const sanitized = sanitizeJobMetadata(metadata);
    expect(sanitized.storagePath).toBeUndefined();
    expect(metadata.storagePath).toBe('/tmp/x');
  });
});
