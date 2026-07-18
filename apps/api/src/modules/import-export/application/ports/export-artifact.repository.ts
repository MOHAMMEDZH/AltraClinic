import type { ExportArtifact } from '../../domain/export/export-adapter.contracts';

export const EXPORT_ARTIFACT_REPOSITORY = Symbol('EXPORT_ARTIFACT_REPOSITORY');

export interface ExportArtifactRepository {
  save(artifact: ExportArtifact): Promise<ExportArtifact>;
  update(artifact: ExportArtifact): Promise<ExportArtifact>;
  findById(tenantId: string, artifactId: string): Promise<ExportArtifact | null>;
  findByJobId(tenantId: string, jobId: string): Promise<ExportArtifact | null>;
  findExpired(now: Date, limit?: number): Promise<ExportArtifact[]>;
  findAvailablePastExpiry(now: Date, limit?: number): Promise<ExportArtifact[]>;
}
