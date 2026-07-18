import { Injectable } from '@nestjs/common';
import type { ExportArtifact } from '../domain/export/export-adapter.contracts';
import type { ExportArtifactRepository } from '../application/ports/export-artifact.repository';

@Injectable()
export class InMemoryExportArtifactRepository implements ExportArtifactRepository {
  private readonly items = new Map<string, ExportArtifact>();

  async save(artifact: ExportArtifact): Promise<ExportArtifact> {
    const copy = { ...artifact };
    this.items.set(artifact.artifactId, copy);
    return { ...copy };
  }

  async update(artifact: ExportArtifact): Promise<ExportArtifact> {
    this.items.set(artifact.artifactId, { ...artifact });
    return { ...artifact };
  }

  async findById(tenantId: string, artifactId: string): Promise<ExportArtifact | null> {
    const item = this.items.get(artifactId);
    if (!item || item.tenantId !== tenantId) return null;
    return { ...item };
  }

  async findByJobId(tenantId: string, jobId: string): Promise<ExportArtifact | null> {
    for (const item of this.items.values()) {
      if (item.tenantId === tenantId && item.jobId === jobId) return { ...item };
    }
    return null;
  }

  async findExpired(now: Date, limit = 100): Promise<ExportArtifact[]> {
    return [...this.items.values()]
      .filter((a) => a.status === 'expired' && !a.deletedAt)
      .slice(0, limit)
      .map((a) => ({ ...a }));
  }

  async findAvailablePastExpiry(now: Date, limit = 100): Promise<ExportArtifact[]> {
    return [...this.items.values()]
      .filter(
        (a) =>
          a.status === 'available' &&
          a.expiresAt.getTime() <= now.getTime() &&
          !a.deletedAt,
      )
      .slice(0, limit)
      .map((a) => ({ ...a }));
  }

  reset(): void {
    this.items.clear();
  }
}
