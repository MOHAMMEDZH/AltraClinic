/**
 * Release 47 Step 11 — explicit safe DTOs for Tenant Directory / Detail.
 * No Prisma shapes, no raw features/license payloads, no PHI.
 */

export type SectionAvailability =
  | 'available'
  | 'available_legacy'
  | 'empty'
  | 'stale'
  | 'degraded'
  | 'unavailable'
  | 'permission_limited'
  | 'unknown';

export interface SectionMetaDto {
  readonly id: string;
  readonly availability: SectionAvailability;
  readonly reasonCode?: string;
  readonly observedAt?: string;
}

export interface DirectorySubscriptionSummaryDto {
  readonly status: string;
  readonly plan: string;
}

export interface TenantDirectoryItemDto {
  readonly platformTenantId: string;
  readonly tenantId: string;
  readonly displayName: string;
  readonly slug: string | null;
  readonly status: string;
  readonly region: string;
  readonly trialEndsAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly facilityType: string;
  /** Present only when caller has plan.view; otherwise null + commercial.legacyPlan permission_limited. */
  readonly legacyPlan: string | null;
  readonly legacyPlanAvailability: SectionAvailability;
  readonly subscriptionSummary: DirectorySubscriptionSummaryDto | null;
  readonly subscriptionAvailability: SectionAvailability;
}

export interface TenantDirectoryPaginationDto {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hasNextPage: boolean;
}

export interface TenantDirectoryResponseDto {
  readonly generatedAt: string;
  readonly items: TenantDirectoryItemDto[];
  readonly pagination: TenantDirectoryPaginationDto;
  readonly appliedFilters: Record<string, string>;
  readonly sort: { field: string; direction: 'asc' | 'desc' };
  readonly availableFilters: string[];
  readonly warnings: string[];
}

export interface TenantIdentitySectionDto extends SectionMetaDto {
  readonly platformTenantId: string;
  readonly tenantId: string;
  readonly displayName: string;
  readonly slug: string | null;
  readonly tenantName: string | null;
  readonly status: string;
  readonly region: string;
  readonly trialEndsAt: string | null;
  readonly activatedAt: string | null;
  readonly suspendedAt: string | null;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly readOnlyPlatformView: true;
}

export interface FacilityProfileSectionDto extends SectionMetaDto {
  readonly facilityType: string | null;
  readonly specialties: SectionMetaDto;
}

export interface SubscriptionHistoryItemDto {
  readonly id: string;
  readonly status: string;
  readonly plan: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly createdAt: string;
  readonly primaryForLicensing: boolean;
}

export interface CommercialSectionDto {
  readonly planVersion: SectionMetaDto;
  readonly legacyPlan: SectionMetaDto & { readonly plan?: string };
  readonly subscription: SectionMetaDto & {
    readonly history?: SubscriptionHistoryItemDto[];
    readonly semantics?: string;
  };
  readonly addons: SectionMetaDto;
  readonly overrides: SectionMetaDto;
}

export interface AccessEffectDto {
  readonly type:
    | 'plan_version_default'
    | 'addon'
    | 'governed_override'
    | 'operational_flag'
    | 'legacy_plan_assignment'
    | 'legacy_license'
    | 'current_license_projection'
    | 'unknown';
  readonly label?: string;
}

export interface AccessCapabilityDto {
  readonly key: string;
  readonly kind: 'module' | 'feature' | 'limit';
  readonly decision?: string;
  readonly value?: number | null;
  readonly unit?: string | null;
  readonly unlimited?: boolean;
  readonly unknown?: boolean;
  readonly sourceType: AccessEffectDto['type'];
  readonly sourceLabel: string;
  readonly reasonCode?: string;
  readonly effects: AccessEffectDto[];
  readonly availability: SectionAvailability;
}

export interface SourceClassDto {
  readonly availability: SectionAvailability;
  readonly reasonCode?: string;
  readonly value?: string;
}

export interface AccessSummaryDto {
  readonly observedAt: string;
  readonly freshness: { readonly cachePossible: boolean; readonly note: string };
  readonly runtimeAuthority: 'current_licensing_engine_projection';
  readonly licenseStatus: string | null;
  readonly uiPlan: string | null;
  readonly backendPlan: string | null;
  readonly platformPlan: string | null;
  readonly sourceClasses: Record<string, SourceClassDto>;
  readonly modules: AccessCapabilityDto[];
  readonly features: AccessCapabilityDto[];
  readonly limits: AccessCapabilityDto[];
  readonly grants: {
    readonly usersBonus: number;
    readonly storageGbBonus: number;
    readonly aiCreditsBonus: number;
    readonly sourceType: 'current_license_projection';
    readonly note: string;
  } | null;
  readonly usage: SectionMetaDto;
  readonly knownLimitations: string[];
  readonly availability: SectionAvailability;
  readonly reasonCode?: string;
}

export interface TenantDetailResponseDto {
  readonly generatedAt: string;
  readonly banner: {
    readonly displayName: string;
    readonly platformTenantId: string;
    readonly status: string;
    readonly region: string;
    readonly messageKey: 'tenantDetail.banner.readOnly';
  };
  readonly identity: TenantIdentitySectionDto;
  readonly facilityProfile: FacilityProfileSectionDto;
  readonly contacts: SectionMetaDto;
  readonly commercial: CommercialSectionDto;
  readonly access: AccessSummaryDto | SectionMetaDto;
  readonly operations: SectionMetaDto & { readonly links?: Array<{ id: string; availability: SectionAvailability; reasonCode?: string }> };
  readonly sales: SectionMetaDto;
  readonly auditLink: SectionMetaDto;
  readonly warnings: string[];
}
