import { Injectable } from '@nestjs/common';
import { CommissionCalculation } from '../domain/entities/commission-calculation.entity';
import { CommissionRepository } from '../domain/repositories/commission.repository.interface';

@Injectable()
export class InMemoryCommissionRepository implements CommissionRepository {
  private readonly store = new Map<string, Map<string, CommissionCalculation>>();

  private bucket(tenantId: string): Map<string, CommissionCalculation> {
    const key = tenantId.trim().toLowerCase();
    if (!this.store.has(key)) this.store.set(key, new Map());
    return this.store.get(key)!;
  }

  async save(commission: CommissionCalculation): Promise<void> {
    const bucket = this.bucket(commission.tenantId);
    bucket.set(commission.commissionId, commission);
  }

  async findById(commissionId: string, tenantId: string): Promise<CommissionCalculation | null> {
    const bucket = this.bucket(tenantId);
    return bucket.get(commissionId) ?? null;
  }

  async list(filters: {
    tenantId: string;
    providerId?: string | null;
    branchId?: string | null;
    status?: string | null;
  }): Promise<CommissionCalculation[]> {
    const bucket = this.bucket(filters.tenantId);
    let commissions = Array.from(bucket.values());

    if (filters.providerId) {
      commissions = commissions.filter((commission) => commission.providerId === filters.providerId);
    }

    if (filters.branchId) {
      commissions = commissions.filter((commission) => commission.branchId === filters.branchId);
    }

    if (filters.status) {
      commissions = commissions.filter((commission) => commission.status.status === filters.status);
    }

    return commissions;
  }
}
