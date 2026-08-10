/**
 * Phase 43a — BackupTarget entity (data shape only).
 */
import type { BackupTargetKind, TenantScopedId } from './value-objects';

export interface BackupTarget extends TenantScopedId {
  readonly id: string;
  readonly kind: BackupTargetKind;
  readonly displayName: string;
  readonly providerKey: string;
  readonly enabled: boolean;
  readonly config: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
