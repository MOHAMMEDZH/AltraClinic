import { Injectable } from '@nestjs/common';
import type {
  ApiCredential,
  ServiceAccount,
} from '../domain/integrations.entities';
import type {
  ApiCredentialRepository,
  ServiceAccountRepository,
} from '../application/ports/repositories';

/**
 * Phase 44b in-memory repositories — tenant-scoped; used by unit/security tests
 * and as Nest default until Prisma migrations are applied in an environment.
 */
@Injectable()
export class InMemoryApiCredentialRepository
  implements ApiCredentialRepository
{
  private readonly byTenant = new Map<string, Map<string, ApiCredential>>();

  private bucket(tenantId: string): Map<string, ApiCredential> {
    let map = this.byTenant.get(tenantId);
    if (!map) {
      map = new Map();
      this.byTenant.set(tenantId, map);
    }
    return map;
  }

  async findById(
    tenantId: string,
    id: string,
  ): Promise<ApiCredential | null> {
    return this.bucket(tenantId).get(id) ?? null;
  }

  async findByPrefix(
    tenantId: string,
    prefix: string,
  ): Promise<ApiCredential | null> {
    for (const row of this.bucket(tenantId).values()) {
      if (row.prefix === prefix) return row;
    }
    return null;
  }

  async findByKeyHash(
    tenantId: string,
    keyHash: string,
  ): Promise<ApiCredential | null> {
    for (const row of this.bucket(tenantId).values()) {
      if (row.keyHash === keyHash) return row;
    }
    return null;
  }

  async findByKeyHashGlobal(
    keyHash: string,
  ): Promise<ApiCredential | null> {
    for (const bucket of this.byTenant.values()) {
      for (const row of bucket.values()) {
        if (row.keyHash === keyHash) return row;
      }
    }
    return null;
  }

  async listByTenant(tenantId: string): Promise<readonly ApiCredential[]> {
    return [...this.bucket(tenantId).values()];
  }

  async save(credential: ApiCredential): Promise<ApiCredential> {
    this.bucket(credential.tenantId).set(credential.id, { ...credential });
    return { ...credential };
  }

  async saveMany(credentials: readonly ApiCredential[]): Promise<void> {
    for (const c of credentials) {
      await this.save(c);
    }
  }

  /** Test helper */
  clear(): void {
    this.byTenant.clear();
  }
}

@Injectable()
export class InMemoryServiceAccountRepository
  implements ServiceAccountRepository
{
  private readonly byTenant = new Map<string, Map<string, ServiceAccount>>();

  private bucket(tenantId: string): Map<string, ServiceAccount> {
    let map = this.byTenant.get(tenantId);
    if (!map) {
      map = new Map();
      this.byTenant.set(tenantId, map);
    }
    return map;
  }

  async findById(
    tenantId: string,
    id: string,
  ): Promise<ServiceAccount | null> {
    return this.bucket(tenantId).get(id) ?? null;
  }

  async listByTenant(tenantId: string): Promise<readonly ServiceAccount[]> {
    return [...this.bucket(tenantId).values()];
  }

  async save(account: ServiceAccount): Promise<ServiceAccount> {
    this.bucket(account.tenantId).set(account.id, { ...account });
    return { ...account };
  }

  clear(): void {
    this.byTenant.clear();
  }
}
