/** Release 47 Step 11 — tenant directory/detail API shapes (read-only). */

export type SectionAvailability =
  | 'available'
  | 'available_legacy'
  | 'empty'
  | 'stale'
  | 'degraded'
  | 'unavailable'
  | 'permission_limited'
  | 'unknown';

export interface SectionMeta {
  readonly id: string;
  readonly availability: SectionAvailability;
  readonly reasonCode?: string;
  readonly observedAt?: string;
}

export interface TenantDirectoryItem {
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
  readonly legacyPlan: string | null;
  readonly legacyPlanAvailability: SectionAvailability;
  readonly subscriptionSummary: { status: string; plan: string } | null;
  readonly subscriptionAvailability: SectionAvailability;
}

export interface TenantDirectoryResponse {
  readonly generatedAt: string;
  readonly items: TenantDirectoryItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly hasNextPage: boolean;
  };
  readonly appliedFilters: Record<string, string>;
  readonly sort: { field: string; direction: 'asc' | 'desc' };
  readonly availableFilters: string[];
  readonly warnings: string[];
}

export interface TenantDetailResponse {
  readonly generatedAt: string;
  readonly banner: {
    readonly displayName: string;
    readonly platformTenantId: string;
    readonly status: string;
    readonly region: string;
    readonly messageKey: 'tenantDetail.banner.readOnly';
  };
  readonly identity: SectionMeta & {
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
  };
  readonly facilityProfile: SectionMeta & {
    readonly facilityType: string | null;
    readonly specialties: SectionMeta;
  };
  readonly contacts: SectionMeta;
  readonly commercial: {
    readonly planVersion: SectionMeta;
    readonly legacyPlan: SectionMeta & { readonly plan?: string };
    readonly subscription: SectionMeta & {
      readonly history?: Array<{
        id: string;
        status: string;
        plan: string;
        startDate: string;
        endDate: string;
        createdAt: string;
        primaryForLicensing: boolean;
      }>;
      readonly semantics?: string;
    };
    readonly addons: SectionMeta;
    readonly overrides: SectionMeta;
  };
  readonly access: SectionMeta | AccessSummarySection;
  readonly operations: SectionMeta;
  readonly sales: SectionMeta;
  readonly auditLink: SectionMeta;
  readonly warnings: string[];
}

export interface TenantDirectoryQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  region?: string;
  trialState?: string;
  facilityType?: string;
  legacyPlan?: string;
  subscriptionStatus?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
}

export interface AccessCapability {
  readonly key: string;
  readonly kind: 'module' | 'feature' | 'limit';
  readonly decision?: string;
  readonly value?: number | null;
  readonly unlimited?: boolean;
  readonly availability: SectionAvailability;
}

export interface AccessSummarySection {
  readonly availability: SectionAvailability;
  readonly modules?: AccessCapability[];
  readonly limits?: AccessCapability[];
  readonly reasonCode?: string;
}
