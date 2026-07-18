import { PortalAccount } from '../entities/portal-account.entity';
import { PortalAccountStatus } from '../value-objects/portal-account-status';

export interface PortalAccountFilter {
  tenantId: string;
  branchId?: string | null;
  status?: PortalAccountStatus | null;
  patientId?: string | null;
  limit: number;
  offset: number;
}

export interface PortalAccountPage {
  readonly items: PortalAccount[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/**
 * Persistence port for the {@link PortalAccount} aggregate. Every read is
 * tenant-scoped by contract so a caller can never accidentally cross tenant
 * boundaries (TENANCY.md). Implementations live in the infrastructure layer.
 */
export interface PortalAccountRepository {
  save(account: PortalAccount): Promise<void>;
  findById(portalAccountId: string, tenantId: string): Promise<PortalAccount | null>;
  findByPatientId(patientId: string, tenantId: string): Promise<PortalAccount | null>;
  list(filter: PortalAccountFilter): Promise<PortalAccountPage>;
}
