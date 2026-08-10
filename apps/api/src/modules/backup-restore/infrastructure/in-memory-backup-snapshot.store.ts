import { Injectable } from '@nestjs/common';
import type {
  BackupSnapshotRecord,
  BackupVerificationRequest,
} from '../domain/backup/backup-engine.types';

export const BACKUP_SNAPSHOT_STORE = Symbol('BACKUP_SNAPSHOT_STORE');
export const BACKUP_VERIFICATION_REQUEST_STORE = Symbol('BACKUP_VERIFICATION_REQUEST_STORE');

export interface BackupSnapshotStore {
  save(snapshot: BackupSnapshotRecord): Promise<BackupSnapshotRecord>;
  findById(tenantId: string, snapshotId: string): Promise<BackupSnapshotRecord | null>;
  listByTenant(tenantId: string): Promise<readonly BackupSnapshotRecord[]>;
  updateVerificationStatus?(
    tenantId: string,
    snapshotId: string,
    verificationStatus: BackupSnapshotRecord['verificationStatus'],
  ): Promise<BackupSnapshotRecord | null>;
  markExpirationMetadata?(
    tenantId: string,
    snapshotId: string,
    expiresAt: Date | null,
  ): Promise<BackupSnapshotRecord | null>;
}

export interface BackupVerificationRequestStore {
  save(request: BackupVerificationRequest): Promise<BackupVerificationRequest>;
  findById(tenantId: string, id: string): Promise<BackupVerificationRequest | null>;
  listPendingByTenant(tenantId: string): Promise<readonly BackupVerificationRequest[]>;
  listByTenant?(tenantId: string): Promise<readonly BackupVerificationRequest[]>;
}

@Injectable()
export class InMemoryBackupSnapshotStore implements BackupSnapshotStore {
  private readonly rows = new Map<string, BackupSnapshotRecord>();

  reset(): void {
    this.rows.clear();
  }

  async save(snapshot: BackupSnapshotRecord): Promise<BackupSnapshotRecord> {
    const copy = {
      ...snapshot,
      manifest: { ...snapshot.manifest, resources: [...snapshot.manifest.resources] },
      createdAt: new Date(snapshot.createdAt),
      expiresAt: snapshot.expiresAt ? new Date(snapshot.expiresAt) : null,
    };
    this.rows.set(snapshot.id, copy);
    return copy;
  }

  async findById(tenantId: string, snapshotId: string): Promise<BackupSnapshotRecord | null> {
    const row = this.rows.get(snapshotId);
    if (!row || row.tenantId !== tenantId) return null;
    return { ...row, manifest: { ...row.manifest, resources: [...row.manifest.resources] } };
  }

  async listByTenant(tenantId: string): Promise<readonly BackupSnapshotRecord[]> {
    return [...this.rows.values()]
      .filter((r) => r.tenantId === tenantId)
      .map((r) => ({ ...r, manifest: { ...r.manifest, resources: [...r.manifest.resources] } }));
  }

  /** Phase 43d — update verification status only (no deletion). */
  async updateVerificationStatus(
    tenantId: string,
    snapshotId: string,
    verificationStatus: BackupSnapshotRecord['verificationStatus'],
  ): Promise<BackupSnapshotRecord | null> {
    const row = this.rows.get(snapshotId);
    if (!row || row.tenantId !== tenantId) return null;
    const next = { ...row, verificationStatus };
    this.rows.set(snapshotId, next);
    return {
      ...next,
      manifest: { ...next.manifest, resources: [...next.manifest.resources] },
    };
  }

  /** Phase 43d — persist expiration metadata only (no deletion). */
  async markExpirationMetadata(
    tenantId: string,
    snapshotId: string,
    expiresAt: Date | null,
  ): Promise<BackupSnapshotRecord | null> {
    const row = this.rows.get(snapshotId);
    if (!row || row.tenantId !== tenantId) return null;
    const next = {
      ...row,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    };
    this.rows.set(snapshotId, next);
    return {
      ...next,
      manifest: { ...next.manifest, resources: [...next.manifest.resources] },
    };
  }
}

@Injectable()
export class InMemoryBackupVerificationRequestStore implements BackupVerificationRequestStore {
  private readonly rows = new Map<string, BackupVerificationRequest>();

  reset(): void {
    this.rows.clear();
  }

  async save(request: BackupVerificationRequest): Promise<BackupVerificationRequest> {
    const copy = { ...request, createdAt: new Date(request.createdAt), details: { ...request.details } };
    this.rows.set(request.id, copy);
    return copy;
  }

  async findById(tenantId: string, id: string): Promise<BackupVerificationRequest | null> {
    const row = this.rows.get(id);
    if (!row || row.tenantId !== tenantId) return null;
    return { ...row, details: { ...row.details } };
  }

  async listPendingByTenant(tenantId: string): Promise<readonly BackupVerificationRequest[]> {
    return [...this.rows.values()]
      .filter((r) => r.tenantId === tenantId && r.status === 'pending')
      .map((r) => ({ ...r, details: { ...r.details } }));
  }

  async listByTenant(tenantId: string): Promise<readonly BackupVerificationRequest[]> {
    return [...this.rows.values()]
      .filter((r) => r.tenantId === tenantId)
      .map((r) => ({ ...r, details: { ...r.details } }));
  }
}
