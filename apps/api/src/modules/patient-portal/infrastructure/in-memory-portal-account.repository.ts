import { Injectable } from '@nestjs/common';
import { PortalAccount } from '../domain/entities/portal-account.entity';
import {
  PortalAccountFilter,
  PortalAccountPage,
  PortalAccountRepository,
} from '../domain/repositories/portal-account.repository.interface';

/**
 * Development/test adapter for the {@link PortalAccountRepository} port. Every
 * read is tenant-scoped (TENANCY.md). A production adapter (e.g. Prisma) must
 * preserve the same tenant-isolation guarantees and the unique
 * (tenantId, patientId) constraint enforced here.
 */
@Injectable()
export class InMemoryPortalAccountRepository implements PortalAccountRepository {
  private readonly store = new Map<string, PortalAccount>();

  async save(account: PortalAccount): Promise<void> {
    this.store.set(this.key(account.tenantId, account.id), account);
  }

  async findById(portalAccountId: string, tenantId: string): Promise<PortalAccount | null> {
    return this.store.get(this.key(tenantId, portalAccountId)) ?? null;
  }

  async findByPatientId(patientId: string, tenantId: string): Promise<PortalAccount | null> {
    for (const account of this.store.values()) {
      if (account.tenantId === tenantId && account.patientId === patientId) {
        return account;
      }
    }
    return null;
  }

  async findByUserId(userId: string, tenantId: string): Promise<PortalAccount | null> {
    for (const account of this.store.values()) {
      if (account.tenantId === tenantId && account.userId === userId) {
        return account;
      }
    }
    return null;
  }

  async findByEnrollmentTokenHash(
    tokenHash: string,
    tenantId: string,
  ): Promise<PortalAccount | null> {
    for (const account of this.store.values()) {
      if (account.tenantId === tenantId && account.enrollmentTokenHash === tokenHash) {
        return account;
      }
    }
    return null;
  }

  async list(filter: PortalAccountFilter): Promise<PortalAccountPage> {
    const matches: PortalAccount[] = [];

    for (const account of this.store.values()) {
      if (account.tenantId !== filter.tenantId) continue;
      if (filter.branchId && account.branchId !== filter.branchId) continue;
      if (filter.status && account.status.value !== filter.status) continue;
      if (filter.patientId && account.patientId !== filter.patientId) continue;
      matches.push(account);
    }

    matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const items = matches.slice(filter.offset, filter.offset + filter.limit);
    return {
      items,
      total: matches.length,
      limit: filter.limit,
      offset: filter.offset,
    };
  }

  private key(tenantId: string, portalAccountId: string): string {
    return `${tenantId}::${portalAccountId}`;
  }
}
