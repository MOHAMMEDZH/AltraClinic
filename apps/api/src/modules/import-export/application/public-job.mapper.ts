import type { ImportExportJob, JobMetadata } from '../domain/job/import-export-job.types';

const REDACTED_METADATA_KEYS = new Set([
  'storagePath',
  'absolutePath',
  'localPath',
  'filesystemPath',
]);

/**
 * Strip host filesystem paths from job payloads returned to clients.
 * Workers continue to use internal metadata; APIs must never expose absolute paths.
 */
export function toPublicImportExportJob(job: ImportExportJob): ImportExportJob {
  return {
    ...job,
    metadata: sanitizeJobMetadata(job.metadata),
  };
}

export function sanitizeJobMetadata(metadata: JobMetadata): JobMetadata {
  const next: JobMetadata = { ...metadata };
  for (const key of REDACTED_METADATA_KEYS) {
    if (key in next) delete next[key];
  }
  return next;
}

export function toPublicImportExportJobs(jobs: ImportExportJob[]): ImportExportJob[] {
  return jobs.map(toPublicImportExportJob);
}
