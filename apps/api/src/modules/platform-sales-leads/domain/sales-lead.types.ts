export type SalesLeadStage =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'DEMO_SCHEDULED'
  | 'PROPOSAL'
  | 'WON'
  | 'LOST';

export type SalesLeadSource =
  | 'INBOUND'
  | 'OUTBOUND'
  | 'REFERRAL'
  | 'PARTNER'
  | 'EVENT'
  | 'OTHER';

export type SalesDemoStatus = 'NONE' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export interface SalesLeadDto {
  id: string;
  stage: SalesLeadStage;
  source: SalesLeadSource;
  ownerRepresentativeId: string | null;
  organizationName: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactJobTitle: string | null;
  facilityTypeKey: string | null;
  specialtyKeys: string[];
  desiredModuleKeys: string[];
  estimatedUsers: number | null;
  estimatedProviders: number | null;
  estimatedLocations: number | null;
  nextActionType: string | null;
  nextActionDueAt: string | null;
  nextActionNote: string | null;
  demoScheduledAt: string | null;
  demoTimezone: string | null;
  demoStatus: SalesDemoStatus;
  demoNote: string | null;
  wonLostReason: string | null;
  linkedPlatformTenantId: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalesLeadNoteDto {
  id: string;
  leadId: string;
  body: string;
  createdById: string;
  createdAt: string;
}

export interface SalesLeadStageHistoryDto {
  id: string;
  leadId: string;
  fromStage: SalesLeadStage | null;
  toStage: SalesLeadStage;
  actorPlatformUserId: string;
  reason: string | null;
  createdAt: string;
}

export interface SalesLeadOwnershipHistoryDto {
  id: string;
  leadId: string;
  fromOwnerRepresentativeId: string | null;
  toOwnerRepresentativeId: string | null;
  actorPlatformUserId: string;
  reason: string | null;
  createdAt: string;
}

export interface PlanFitAdvisoryDto {
  leadId: string;
  valid: boolean;
  violations: Array<{ reasonCode: string; message: string; subjectKey?: string; targetKey?: string }>;
  warnings: Array<{ reasonCode: string; message: string; subjectKey?: string; targetKey?: string }>;
  applicableRuleIds: string[];
  candidatePublishedPlanVersions: Array<{ id: string; planKey: string; version: number }>;
  disclaimer: {
    advisoryOnly: true;
    notEntitlementDecision: true;
    notProvisioningDecision: true;
    notRuntimeLicenseDecision: true;
    doesNotMutateCommercialSoR: true;
  };
}
