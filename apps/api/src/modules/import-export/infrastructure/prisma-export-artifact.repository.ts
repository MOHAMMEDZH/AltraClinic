import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type {
  ArtifactLifecycleStatus,
  ExportArtifact,
  ExportFileFormat,
} from '../domain/export/export-adapter.contracts';
import type { ExportArtifactRepository } from '../application/ports/export-artifact.repository';

function mapRow(row: {
  id: string;
  tenantId: string;
  jobId: string;
  format: string;
  sizeBytes: number;
  checksum: string;
  contentType: string;
  filename: string;
  status: string;
  storageKey: string;
  downloadTokenHash: string;
  expiresAt: Date;
  deletedAt: Date | null;
  createdAt: Date;
}): ExportArtifact {
  return {
    artifactId: row.id,
    jobId: row.jobId,
    tenantId: row.tenantId,
    format: row.format as ExportFileFormat,
    size: row.sizeBytes,
    checksum: row.checksum,
    contentType: row.contentType,
    filename: row.filename,
    status: row.status as ArtifactLifecycleStatus,
    storageKey: row.storageKey,
    downloadTokenHash: row.downloadTokenHash,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    deletedAt: row.deletedAt,
  };
}

@Injectable()
export class PrismaExportArtifactRepository implements ExportArtifactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(artifact: ExportArtifact): Promise<ExportArtifact> {
    return this.prisma.withTenantContext(artifact.tenantId, async (tx) => {
      const row = await tx.importExportArtifact.create({
        data: {
          id: artifact.artifactId,
          tenantId: artifact.tenantId,
          jobId: artifact.jobId,
          format: artifact.format,
          sizeBytes: artifact.size,
          checksum: artifact.checksum,
          contentType: artifact.contentType,
          filename: artifact.filename,
          status: artifact.status,
          storageKey: artifact.storageKey,
          downloadTokenHash: artifact.downloadTokenHash,
          expiresAt: artifact.expiresAt,
          deletedAt: artifact.deletedAt,
        },
      });
      return mapRow(row);
    });
  }

  async update(artifact: ExportArtifact): Promise<ExportArtifact> {
    return this.prisma.withTenantContext(artifact.tenantId, async (tx) => {
      const row = await tx.importExportArtifact.update({
        where: { id: artifact.artifactId },
        data: {
          status: artifact.status,
          sizeBytes: artifact.size,
          checksum: artifact.checksum,
          storageKey: artifact.storageKey,
          downloadTokenHash: artifact.downloadTokenHash,
          expiresAt: artifact.expiresAt,
          deletedAt: artifact.deletedAt,
        },
      });
      return mapRow(row);
    });
  }

  async findById(tenantId: string, artifactId: string): Promise<ExportArtifact | null> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const row = await tx.importExportArtifact.findFirst({
        where: { id: artifactId, tenantId },
      });
      return row ? mapRow(row) : null;
    });
  }

  async findByJobId(tenantId: string, jobId: string): Promise<ExportArtifact | null> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const row = await tx.importExportArtifact.findUnique({
        where: { tenantId_jobId: { tenantId, jobId } },
      });
      return row ? mapRow(row) : null;
    });
  }

  async findExpired(now: Date, limit = 100): Promise<ExportArtifact[]> {
    return this.prisma.withPlatformBypass(async (tx) => {
      const delegate = (tx as { importExportArtifact?: { findMany: Function } }).importExportArtifact;
      if (!delegate?.findMany) return [];
      const rows = await delegate.findMany({
        where: {
          status: 'expired',
          deletedAt: null,
        },
        take: limit,
      });
      return rows.map(mapRow);
    });
  }

  async findAvailablePastExpiry(now: Date, limit = 100): Promise<ExportArtifact[]> {
    return this.prisma.withPlatformBypass(async (tx) => {
      const delegate = (tx as { importExportArtifact?: { findMany: Function } }).importExportArtifact;
      if (!delegate?.findMany) return [];
      const rows = await delegate.findMany({
        where: {
          status: 'available',
          expiresAt: { lte: now },
          deletedAt: null,
        },
        take: limit,
      });
      return rows.map(mapRow);
    });
  }
}
