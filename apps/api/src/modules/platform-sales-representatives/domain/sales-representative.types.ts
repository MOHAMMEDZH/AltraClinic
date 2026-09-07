export interface SalesRepresentativeDto {
  id: string;
  platformUserId: string;
  email: string;
  displayName: string | null;
  status: string;
  managerRepresentativeId: string | null;
  regionCode: string | null;
  territoryCode: string | null;
  targetAmount: string | null;
  targetCurrency: string | null;
  targetPeriod: string | null;
  roleKeys: string[];
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalesCustomerOwnershipDto {
  id: string;
  representativeId: string;
  platformTenantId: string;
  rowVersion: number;
  assignedAt: string;
  assignedById: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}
