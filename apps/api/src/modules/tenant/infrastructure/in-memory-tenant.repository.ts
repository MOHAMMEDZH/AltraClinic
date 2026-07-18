import { Injectable } from '@nestjs/common';
import { Tenant } from '../domain/tenant.entity';
import { TenantRepository } from '../domain/tenant.repository.interface';

@Injectable()
export class InMemoryTenantRepository implements TenantRepository {
  private store = new Map<string, Tenant>();

  async save(tenant: Tenant): Promise<void> {
    this.store.set(tenant.id, tenant);
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.store.get(id) ?? null;
  }

  async findByDomain(domain: string): Promise<Tenant | null> {
    for (const t of this.store.values()) {
      if (t.domain?.value === domain) return t;
    }
    return null;
  }
}
