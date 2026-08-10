/**
 * Phase 43a — RetentionPolicy entity (data shape only).
 */
import type { RetentionUnit, TenantScopedId } from './value-objects';

export interface RetentionPolicy extends TenantScopedId {
  readonly id: string;
  readonly name: string;
  readonly retainFor: number;
  readonly unit: RetentionUnit;
  /** Minimum successful snapshots to keep regardless of age. */
  readonly floorCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
