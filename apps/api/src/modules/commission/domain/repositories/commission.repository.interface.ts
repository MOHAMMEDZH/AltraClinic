import { CommissionCalculation } from '../entities/commission-calculation.entity';

export interface CommissionRepository {
  save(commission: CommissionCalculation): Promise<void>;
  findById(commissionId: string, tenantId: string): Promise<CommissionCalculation | null>;
  list(filters: { tenantId: string; providerId?: string | null; branchId?: string | null; status?: string | null }): Promise<CommissionCalculation[]>;
}
