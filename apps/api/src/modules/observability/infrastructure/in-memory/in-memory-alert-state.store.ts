import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type {
  AlertInstance,
  AlertState,
} from '../../domain/alert.types';
import type { AlertStateStorePort } from '../../application/ports/storage.port';

/**
 * Phase 45e — in-platform alert state store (OD-STORAGE / OD-DEPLOY shared port).
 */
@Injectable()
export class InMemoryAlertStateStore implements AlertStateStorePort {
  readonly contractVersion = '45e' as const;
  readonly providerKind = 'in_platform' as const;

  private readonly byId = new Map<string, AlertInstance>();
  private readonly byFingerprint = new Map<string, string>();

  upsert(alert: AlertInstance): AlertInstance {
    this.byId.set(alert.id, alert);
    this.byFingerprint.set(alert.fingerprint, alert.id);
    return alert;
  }

  getById(id: string): AlertInstance | undefined {
    return this.byId.get(id);
  }

  getByFingerprint(fingerprint: string): AlertInstance | undefined {
    const id = this.byFingerprint.get(fingerprint);
    return id ? this.byId.get(id) : undefined;
  }

  list(filter?: {
    tenantId?: string | null;
    state?: AlertState | AlertState[];
    includeOtherTenants?: boolean;
  }): readonly AlertInstance[] {
    const states = filter?.state
      ? new Set(Array.isArray(filter.state) ? filter.state : [filter.state])
      : null;
    return [...this.byId.values()].filter((a) => {
      if (states && !states.has(a.state)) return false;
      if (!filter?.includeOtherTenants && filter?.tenantId !== undefined) {
        if (filter.tenantId === null) {
          if (a.tenantId != null) return false;
        } else if (a.tenantId != null && a.tenantId !== filter.tenantId) {
          return false;
        }
      }
      return true;
    });
  }

  count(): number {
    return this.byId.size;
  }

  clear(): void {
    this.byId.clear();
    this.byFingerprint.clear();
  }

  static newId(): string {
    return randomUUID();
  }

  static fingerprint(parts: Record<string, string>): string {
    const canonical = Object.keys(parts)
      .sort()
      .map((k) => `${k}=${parts[k]}`)
      .join('|');
    return createHash('sha256').update(canonical).digest('hex').slice(0, 32);
  }
}
