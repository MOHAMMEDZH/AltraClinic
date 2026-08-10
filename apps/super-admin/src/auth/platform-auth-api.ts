/**
 * Platform auth API client for Super Admin.
 * No tenant/patient headers. Access token is caller-owned (kept in memory by
 * PlatformAuthProvider) — this module never persists anything itself.
 */
import type { PlatformDashboard } from '../dashboard/types';
import type { TenantDetailResponse, TenantDirectoryQuery, TenantDirectoryResponse } from '../tenants/types';

export class PlatformAuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'PlatformAuthApiError';
  }
}

/** True when the API rejected a mutation because the session lacks a fresh step-up verification. */
export function isStepUpRequiredError(err: unknown): boolean {
  return err instanceof PlatformAuthApiError && err.status === 403 && err.code === 'PLATFORM_STEP_UP_REQUIRED';
}

export interface PlatformLoginEnrollmentRequired {
  kind: 'mfa_enrollment_required';
  preauthToken: string;
  expiresIn: number;
  email: string;
}

export interface PlatformLoginChallengeRequired {
  kind: 'mfa_challenge_required';
  preauthToken: string;
  expiresIn: number;
}

export type PlatformLoginResult = PlatformLoginEnrollmentRequired | PlatformLoginChallengeRequired;

export interface PlatformSessionTokens {
  accessToken: string;
  accessExpiresIn: number;
  sessionId: string;
  tokenType: string;
  principalType: 'platform';
}

export interface PlatformMfaEnrollmentBeginResult {
  otpauthUrl: string;
  secret: string;
  expiresIn: number;
  principalType: 'platform';
}

export interface PlatformMfaEnrollmentConfirmResult extends PlatformSessionTokens {
  recoveryCodes: string[];
}

export interface PlatformPrincipal {
  id: string;
  email: string;
  displayName: string | null;
  principalType: 'platform';
  accountStatus: 'active' | 'disabled';
  /** Lifecycle status; `accountStatus` remains for backward-compatible APIs. */
  status: 'active' | 'pending_activation' | 'suspended' | 'disabled';
  sessionId: string;
  mfaEnabled: boolean;
  roleKeys: string[];
  permissions: string[];
  authzRevision: number;
}

export interface HealthcareCatalogItemDetail {
  id: string;
  canonicalKey: string;
  kind: string;
  lifecycle: string;
  sortOrder: number;
  iconKey: string | null;
  parentCanonicalKey: string | null;
  owningModuleCanonicalKey: string | null;
  version: number;
  systemSeeded: boolean;
  replacementCanonicalKey: string | null;
  translations: Array<{
    locale: string;
    displayName: string;
    shortDescription: string;
    longDescription: string | null;
    helpText: string | null;
    incomplete: boolean;
  }>;
  aliases: Array<{
    id: string;
    aliasValue: string;
    sourceNamespace: string;
    lifecycle: string;
    reason: string | null;
  }>;
  limit: {
    valueType: string;
    unit: string;
    min: string | null;
    max: string | null;
    zeroValid: boolean;
    unlimitedSupported: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthcareCatalogCreateItemRequest {
  kind: string;
  canonicalKey: string;
  sortOrder?: number;
  iconKey?: string;
  parentCanonicalKey?: string | null;
  owningModuleCanonicalKey?: string | null;
  translations: Array<{
    locale: string;
    displayName: string;
    shortDescription: string;
    longDescription?: string;
    helpText?: string;
  }>;
  limit?: {
    valueType: string;
    unit: string;
    min?: number;
    max?: number;
    zeroValid: boolean;
    unlimitedSupported: boolean;
  };
}

export interface HealthcareCatalogUpdateItemRequest {
  expectedVersion: number;
  sortOrder?: number;
  iconKey?: string | null;
  parentCanonicalKey?: string | null;
  owningModuleCanonicalKey?: string | null;
  translations?: Array<{
    locale: string;
    displayName: string;
    shortDescription: string;
    longDescription?: string | null;
    helpText?: string | null;
  }>;
  limit?: {
    valueType: string;
    unit: string;
    min?: number | null;
    max?: number | null;
    zeroValid: boolean;
    unlimitedSupported: boolean;
  };
}

export interface HealthcareCatalogRule {
  id: string;
  ruleType: string;
  subjectKey: string;
  targetKey: string;
  anyOfGroupKey: string;
  lifecycle: string;
  explanationEn: string;
  explanationAr: string;
  version: number;
  systemSeeded: boolean;
}

export interface PlatformUserListItem {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt?: string;
  roleKeys?: string[];
  activeSessionCount?: number;
  invitationStatus?: string | null;
}

export interface PlatformUsersListResponse {
  items: PlatformUserListItem[];
  page: number;
  pageSize: number;
  total: number;
}

/** Deliberately omits password hashes, MFA secrets, and raw device identifiers. */
export interface PlatformUserDetail extends PlatformUserListItem {
  isActive: boolean;
  mfaConfirmedAt: string | null;
  updatedAt: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  authzRevision: number;
  activeSessionCount: number;
  roleKeys: string[];
}

export interface PlatformRole {
  key: string;
  displayName: string;
  description?: string;
  scope?: string;
  highImpact?: boolean;
  active?: boolean;
  permissionKeys: string[];
}

export interface PlatformPermission {
  key: string;
  displayLabel: string;
  description?: string;
  domain?: string;
  action?: string;
  risk?: string;
  stepUpExpected?: boolean;
  dualControlExpected?: boolean;
  active?: boolean;
}

export interface PlatformInvitationAdminResult {
  invitationId: string;
  platformUserId: string;
  status: string;
  expiresAt: string;
  deliveryChannel: string | null;
  deliveryStatus: string | null;
  createdAt: string | null;
}

export interface PlatformManagedSession {
  sessionId: string;
  createdAt: string;
  lastInteractiveActivityAt: string;
  /** Server-provided privacy-minimized device summary — never a raw user-agent. */
  deviceSummary: string;
  deviceCategory?: string;
  deviceLabel?: string | null;
  idleExpiresAt?: string | null;
  absoluteExpiresAt?: string | null;
  authMethod?: string | null;
  isCurrent?: boolean | null;
  isStepUpFresh?: boolean | null;
  revoked?: boolean;
}

export interface PlatformInvitationValidation {
  valid: boolean;
  expired?: boolean;
  canActivate?: boolean;
  emailHint?: string;
}

export interface PlatformMfaResetRequest {
  id: string;
  targetUserId: string;
  requesterId: string;
  approverId: string | null;
  status: string;
  reason: string;
  externalRef: string | null;
  createdAt: string;
  expiresAt: string;
  decidedAt: string | null;
  completedAt: string | null;
  riskClassification: string;
}

export interface PlatformMfaStatus {
  mfaEnabled: boolean;
  mfaConfirmedAt: string | null;
  recoveryCodesRemaining: number;
}

export interface PlatformMfaReplaceBeginResult {
  otpauthUrl: string;
  secret: string;
  expiresIn: number;
  principalType: 'platform';
}

export interface PlatformSession {
  sessionId: string;
  createdAt: string;
  lastInteractiveActivityAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  /** Privacy-minimized device summary — never a raw user-agent. */
  deviceSummary: string;
  deviceCategory: string;
  deviceLabel: string | null;
  assuranceLevel: string;
  authMethod: string | null;
  isCurrent: boolean;
  isStepUpFresh: boolean;
}

export interface PlatformSessionsResult {
  sessions: PlatformSession[];
  currentSessionId: string | null;
}

export interface PlatformStepUpStatus {
  stepUpFresh: boolean;
  stepUpVerifiedAt: string | null;
}

export interface PlatformStepUpVerifyResult {
  stepUpVerifiedUntil: string;
}

export interface PlatformRevokeCountResult {
  revoked: number;
}

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('sa_platform_csrf='));
  if (!match) return null;
  return decodeURIComponent(match.slice('sa_platform_csrf='.length));
}

export function createPlatformAuthClient(apiBaseUrl: string) {
  const base = apiBaseUrl.replace(/\/$/, '');

  async function request<T>(
    path: string,
    init: RequestInit & { accessToken?: string | null; csrf?: boolean } = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (init.accessToken) {
      headers.set('Authorization', `Bearer ${init.accessToken}`);
    }
    if (init.csrf) {
      const csrf = readCsrfCookie();
      if (csrf) headers.set('X-Platform-CSRF', csrf);
    }

    const response = await fetch(`${base}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!response.ok) {
      const payload = typeof data === 'object' && data ? (data as Record<string, unknown>) : {};
      const rawMessage = payload.message;
      let message = 'Request failed.';
      let code =
        typeof payload.code === 'string'
          ? payload.code
          : typeof payload.errorCode === 'string'
            ? payload.errorCode
            : undefined;
      if (typeof rawMessage === 'string') {
        message = rawMessage;
      } else if (rawMessage && typeof rawMessage === 'object') {
        const nested = rawMessage as Record<string, unknown>;
        if (typeof nested.message === 'string') message = nested.message;
        if (typeof nested.code === 'string') code = nested.code;
      }
      throw new PlatformAuthApiError(message, response.status, code);
    }

    return data as T;
  }

  return {
    login(email: string, password: string) {
      return request<PlatformLoginResult>('/platform/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },

    beginEnrollment(preauthToken: string) {
      return request<PlatformMfaEnrollmentBeginResult>('/platform/auth/mfa/enrollment/begin', {
        method: 'POST',
        body: JSON.stringify({ preauthToken }),
      });
    },

    confirmEnrollment(preauthToken: string, code: string, deviceLabel?: string) {
      return request<PlatformMfaEnrollmentConfirmResult>('/platform/auth/mfa/enrollment/confirm', {
        method: 'POST',
        body: JSON.stringify({ preauthToken, code, deviceLabel }),
      });
    },

    mfaChallenge(preauthToken: string, code: string, deviceLabel?: string) {
      return request<PlatformSessionTokens>('/platform/auth/mfa/challenge', {
        method: 'POST',
        body: JSON.stringify({ preauthToken, code, deviceLabel }),
      });
    },

    refresh() {
      return request<PlatformSessionTokens>('/platform/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({}),
        csrf: true,
      });
    },

    logout(accessToken: string) {
      return request<void>('/platform/auth/logout', {
        method: 'POST',
        accessToken,
        csrf: true,
      });
    },

    me(accessToken: string) {
      return request<PlatformPrincipal>('/platform/auth/me', {
        method: 'GET',
        accessToken,
      });
    },

    /** Release 47 Step 10 — read-only Platform Dashboard MVP (cached snapshot). */
    getPlatformDashboard(accessToken: string) {
      return request<PlatformDashboard>('/platform/dashboard', {
        method: 'GET',
        accessToken,
      });
    },

    /** Manual refresh — POST-only so browsers cannot prefetch; rate-limited per user. */
    refreshPlatformDashboard(accessToken: string) {
      return request<PlatformDashboard>('/platform/dashboard/refresh', {
        method: 'POST',
        accessToken,
        body: JSON.stringify({}),
      });
    },

    /** Release 47 Step 11 — paginated tenant directory (read-only). */
    listPlatformTenants(accessToken: string, query: TenantDirectoryQuery = {}) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      return request<TenantDirectoryResponse>(`/platform/tenant-directory?${params.toString()}`, {
        method: 'GET',
        accessToken,
      });
    },

    getPlatformTenantDetail(accessToken: string, platformTenantId: string) {
      return request<TenantDetailResponse>(
        `/platform/tenant-directory/${encodeURIComponent(platformTenantId)}`,
        {
        method: 'GET',
        accessToken,
      });
    },

    /** Flexible Step 17 — tenant provisioning */
    validateTenantProvisioning(accessToken: string, body: Record<string, unknown>) {
      return request<{
        valid: boolean;
        errors: Array<{ code: string; field?: string }>;
        warnings: Array<{ code: string }>;
        previewFingerprint?: string;
      }>('/platform/tenant-provisioning/validate', {
        method: 'POST',
        accessToken,
        body: JSON.stringify(body),
      });
    },

    createTenantProvisioningRequest(
      accessToken: string,
      body: Record<string, unknown>,
      idempotencyKey: string,
    ) {
      return request<{ id: string; status: string; rowVersion: number }>(
        '/platform/tenant-provisioning/requests',
        {
          method: 'POST',
          accessToken,
          body: JSON.stringify(body),
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      );
    },

    getTenantProvisioningRequest(accessToken: string, requestId: string) {
      return request<{
        id: string;
        status: string;
        rowVersion: number;
        organizationName: string;
        facilityTypeKey: string;
        specialtyKeys: string[];
        publishedPlanVersionId: string;
        previewFingerprint: string | null;
        lastErrorCode: string | null;
        tenantId: string | null;
        checkpoints: Array<{ key: string; status: string; completedAt: string | null }>;
      }>(`/platform/tenant-provisioning/requests/${encodeURIComponent(requestId)}`, {
        method: 'GET',
        accessToken,
      });
    },

    startTenantProvisioning(
      accessToken: string,
      requestId: string,
      expectedRowVersion: number,
      idempotencyKey: string,
    ) {
      return request<Record<string, unknown>>(
        `/platform/tenant-provisioning/requests/${encodeURIComponent(requestId)}/start`,
        {
          method: 'POST',
          accessToken,
          body: JSON.stringify({ expectedRowVersion }),
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      );
    },

    retryTenantProvisioning(
      accessToken: string,
      requestId: string,
      expectedRowVersion: number,
      idempotencyKey: string,
    ) {
      return request<Record<string, unknown>>(
        `/platform/tenant-provisioning/requests/${encodeURIComponent(requestId)}/retry`,
        {
          method: 'POST',
          accessToken,
          body: JSON.stringify({ expectedRowVersion }),
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      );
    },

    activateTenantProvisioning(
      accessToken: string,
      requestId: string,
      expectedRowVersion: number,
      reason: string,
      idempotencyKey: string,
    ) {
      return request<Record<string, unknown>>(
        `/platform/tenant-provisioning/requests/${encodeURIComponent(requestId)}/activate`,
        {
          method: 'POST',
          accessToken,
          body: JSON.stringify({ expectedRowVersion, reason }),
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      );
    },

    compensateTenantProvisioning(
      accessToken: string,
      requestId: string,
      expectedRowVersion: number,
      reason: string,
      idempotencyKey: string,
    ) {
      return request<Record<string, unknown>>(
        `/platform/tenant-provisioning/requests/${encodeURIComponent(requestId)}/compensate`,
        {
          method: 'POST',
          accessToken,
          body: JSON.stringify({ expectedRowVersion, reason }),
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      );
    },

    getPlatformTenantAccessSummary(accessToken: string, platformTenantId: string) {
      return request<Record<string, unknown>>(
        `/platform/tenant-directory/${encodeURIComponent(platformTenantId)}/access-summary`,
        { method: 'GET', accessToken },
      );
    },

    getPlatformTenantAccessSummaryItem(
      accessToken: string,
      platformTenantId: string,
      capabilityKey: string,
    ) {
      return request<Record<string, unknown>>(
        `/platform/tenant-directory/${encodeURIComponent(platformTenantId)}/access-summary/items/${encodeURIComponent(capabilityKey)}`,
        { method: 'GET', accessToken },
      );
    },

    listHealthcareCatalogItems(
      accessToken: string,
      query: {
        kind?: string;
        lifecycle?: string;
        search?: string;
        missingTranslation?: string;
        page?: number;
        pageSize?: number;
      } = {},
    ) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      return request<{
        generatedAt: string;
        items: Array<{
          id: string;
          canonicalKey: string;
          kind: string;
          lifecycle: string;
          sortOrder: number;
          version: number;
          systemSeeded: boolean;
          displayName: string;
          missingTranslations: string[];
          referenceCount: number;
        }>;
        pagination: { page: number; pageSize: number; total: number; hasNextPage: boolean };
      }>(`/platform/healthcare-catalog/items?${params.toString()}`, {
        method: 'GET',
        accessToken,
      });
    },

    getHealthcareCatalogItem(accessToken: string, id: string) {
      return request<HealthcareCatalogItemDetail>(
        `/platform/healthcare-catalog/items/${encodeURIComponent(id)}`,
        { method: 'GET', accessToken },
      );
    },

    createHealthcareCatalogItem(
      accessToken: string,
      body: HealthcareCatalogCreateItemRequest,
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<HealthcareCatalogItemDetail>('/platform/healthcare-catalog/items', {
        method: 'POST',
        accessToken,
        headers,
        body: JSON.stringify(body),
      });
    },

    updateHealthcareCatalogItem(
      accessToken: string,
      id: string,
      body: HealthcareCatalogUpdateItemRequest,
    ) {
      return request<HealthcareCatalogItemDetail>(
        `/platform/healthcare-catalog/items/${encodeURIComponent(id)}`,
        { method: 'PATCH', accessToken, body: JSON.stringify(body) },
      );
    },

    activateHealthcareCatalogItem(
      accessToken: string,
      id: string,
      body: { expectedVersion: number; reason: string; replacementCanonicalKey?: string },
    ) {
      return request<HealthcareCatalogItemDetail>(
        `/platform/healthcare-catalog/items/${encodeURIComponent(id)}/activate`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    deprecateHealthcareCatalogItem(
      accessToken: string,
      id: string,
      body: { expectedVersion: number; reason: string; replacementCanonicalKey?: string },
    ) {
      return request<HealthcareCatalogItemDetail>(
        `/platform/healthcare-catalog/items/${encodeURIComponent(id)}/deprecate`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    retireHealthcareCatalogItem(
      accessToken: string,
      id: string,
      body: { expectedVersion: number; reason: string; replacementCanonicalKey?: string },
    ) {
      return request<HealthcareCatalogItemDetail>(
        `/platform/healthcare-catalog/items/${encodeURIComponent(id)}/retire`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    reactivateHealthcareCatalogItem(
      accessToken: string,
      id: string,
      body: { expectedVersion: number; reason: string; replacementCanonicalKey?: string },
    ) {
      return request<HealthcareCatalogItemDetail>(
        `/platform/healthcare-catalog/items/${encodeURIComponent(id)}/reactivate`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    addHealthcareCatalogAlias(
      accessToken: string,
      id: string,
      body: {
        aliasValue: string;
        sourceNamespace: string;
        reason?: string;
        expectedVersion: number;
      },
    ) {
      return request<HealthcareCatalogItemDetail>(
        `/platform/healthcare-catalog/items/${encodeURIComponent(id)}/aliases`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    retireHealthcareCatalogAlias(
      accessToken: string,
      id: string,
      aliasId: string,
      body: { expectedVersion: number; reason: string },
    ) {
      return request<HealthcareCatalogItemDetail>(
        `/platform/healthcare-catalog/items/${encodeURIComponent(id)}/aliases/${encodeURIComponent(aliasId)}/retire`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    getHealthcareCatalogItemReferences(accessToken: string, id: string) {
      return request<{
        itemId: string;
        canonicalKey: string;
        buckets: Array<{
          sourceType: string;
          count: number;
          availability: 'available' | 'unavailable';
          reasonCode?: string;
          keys?: string[];
        }>;
      }>(`/platform/healthcare-catalog/items/${encodeURIComponent(id)}/references`, {
        method: 'GET',
        accessToken,
      });
    },

    listHealthcareCatalogCompatibilityRules(accessToken: string) {
      return request<{
        items: HealthcareCatalogRule[];
      }>('/platform/healthcare-catalog/compatibility-rules', {
        method: 'GET',
        accessToken,
      });
    },

    createHealthcareCatalogCompatibilityRule(
      accessToken: string,
      body: {
        ruleType: string;
        subjectKey: string;
        targetKey: string;
        anyOfGroupKey?: string;
        explanationEn: string;
        explanationAr: string;
      },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<HealthcareCatalogRule>('/platform/healthcare-catalog/compatibility-rules', {
        method: 'POST',
        accessToken,
        headers,
        body: JSON.stringify(body),
      });
    },

    activateHealthcareCatalogCompatibilityRule(
      accessToken: string,
      id: string,
      body: { expectedVersion: number; reason: string },
    ) {
      return request<HealthcareCatalogRule>(
        `/platform/healthcare-catalog/compatibility-rules/${encodeURIComponent(id)}/activate`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    retireHealthcareCatalogCompatibilityRule(
      accessToken: string,
      id: string,
      body: { expectedVersion: number; reason: string },
    ) {
      return request<HealthcareCatalogRule>(
        `/platform/healthcare-catalog/compatibility-rules/${encodeURIComponent(id)}/retire`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    validateHealthcareCatalogSelection(
      accessToken: string,
      body: {
        facilityTypeKey?: string;
        specialtyKeys?: string[];
        moduleKeys?: string[];
        featureKeys?: string[];
      },
    ) {
      return request<{
        valid: boolean;
        violations: Array<{ reasonCode: string; message: string }>;
        warnings: Array<{ reasonCode: string; message: string }>;
        applicableRuleIds: string[];
        disclaimer: {
          notEntitlementDecision: true;
          notProvisioningDecision: true;
          notRuntimeLicenseDecision: true;
        };
      }>('/platform/healthcare-catalog/validate-selection', {
        method: 'POST',
        accessToken,
        body: JSON.stringify(body),
      });
    },

    getHealthcareCatalogDriftReport(accessToken: string) {
      return request<{
        generatedAt: string;
        summary: { errors: number; warnings: number; ignored: number };
        findings: Array<{ severity: string; code: string; detail: string }>;
      }>('/platform/healthcare-catalog/drift-report', {
        method: 'GET',
        accessToken,
      });
    },

    listPlatformUsers(
      accessToken: string,
      query: { page?: number; pageSize?: number; search?: string; status?: string } = {},
    ) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      return request<PlatformUsersListResponse>(`/platform/users?${params.toString()}`, {
        method: 'GET',
        accessToken,
      });
    },

    getPlatformUser(accessToken: string, id: string) {
      return request<PlatformUserDetail>(`/platform/users/${encodeURIComponent(id)}`, {
        method: 'GET',
        accessToken,
      });
    },

    invitePlatformUser(
      accessToken: string,
      body: { email: string; displayName?: string; roleKeys: string[]; reason?: string },
    ) {
      return request<PlatformInvitationAdminResult>('/platform/users/invitations', {
        method: 'POST',
        accessToken,
        body: JSON.stringify(body),
      });
    },

    suspendPlatformUser(accessToken: string, id: string, reason: string) {
      return request<{ ok: true }>(`/platform/users/${encodeURIComponent(id)}/suspend`, {
        method: 'POST', accessToken, body: JSON.stringify({ reason }),
      });
    },

    reactivatePlatformUser(accessToken: string, id: string, reason: string) {
      return request<{ ok: true }>(`/platform/users/${encodeURIComponent(id)}/reactivate`, {
        method: 'POST', accessToken, body: JSON.stringify({ reason }),
      });
    },

    assignPlatformRole(accessToken: string, id: string, roleKey: string, reason?: string) {
      return request<{ ok: true }>(`/platform/users/${encodeURIComponent(id)}/roles`, {
        method: 'POST', accessToken, body: JSON.stringify({ roleKey, reason }),
      });
    },

    removePlatformRole(accessToken: string, id: string, roleKey: string) {
      return request<{ ok: true }>(`/platform/users/${encodeURIComponent(id)}/roles/${encodeURIComponent(roleKey)}`, {
        method: 'DELETE', accessToken,
      });
    },

    listPlatformUserSessions(accessToken: string, id: string) {
      return request<PlatformManagedSession[]>(`/platform/users/${encodeURIComponent(id)}/sessions`, {
        method: 'GET', accessToken,
      });
    },

    revokePlatformUserSession(accessToken: string, id: string, sessionId: string, reason: string) {
      return request<{ ok: true }>(`/platform/users/${encodeURIComponent(id)}/sessions/${encodeURIComponent(sessionId)}/revoke`, {
        method: 'POST', accessToken, body: JSON.stringify({ reason }),
      });
    },

    revokeAllPlatformUserSessions(accessToken: string, id: string, reason: string) {
      return request<{ ok: true }>(`/platform/users/${encodeURIComponent(id)}/sessions/revoke-all`, {
        method: 'POST', accessToken, body: JSON.stringify({ reason }),
      });
    },

    requestMfaReset(accessToken: string, id: string, reason: string, externalRef?: string) {
      return request<{ id: string }>(`/platform/users/${encodeURIComponent(id)}/mfa-reset-requests`, {
        method: 'POST', accessToken, body: JSON.stringify({ reason, externalRef }),
      });
    },

    listPlatformRoles(accessToken: string) {
      return request<PlatformRole[]>('/platform/roles', { method: 'GET', accessToken });
    },

    listPlatformPermissions(accessToken: string) {
      return request<PlatformPermission[]>('/platform/permissions', { method: 'GET', accessToken });
    },

    approveMfaReset(accessToken: string, requestId: string, reason?: string) {
      return request<{ ok: true }>(`/platform/mfa-reset-requests/${encodeURIComponent(requestId)}/approve`, {
        method: 'POST', accessToken, body: JSON.stringify({ reason }),
      });
    },

    rejectMfaReset(accessToken: string, requestId: string, reason?: string) {
      return request<{ ok: true }>(`/platform/mfa-reset-requests/${encodeURIComponent(requestId)}/reject`, {
        method: 'POST', accessToken, body: JSON.stringify({ reason }),
      });
    },

    validateInvitation(token: string) {
      return request<PlatformInvitationValidation>(`/platform/auth/invitation/validate?token=${encodeURIComponent(token)}`, {
        method: 'GET',
      });
    },

    acceptInvitation(token: string, password: string) {
      return request<PlatformLoginEnrollmentRequired>('/platform/auth/invitation/accept', {
        method: 'POST', body: JSON.stringify({ token, password }),
      });
    },

    mfaStatus(accessToken: string) {
      return request<PlatformMfaStatus>('/platform/auth/mfa/status', {
        method: 'GET',
        accessToken,
      });
    },

    regenerateRecoveryCodes(accessToken: string) {
      return request<{ recoveryCodes: string[] }>('/platform/auth/mfa/recovery-codes/regenerate', {
        method: 'POST',
        accessToken,
      });
    },

    beginMfaReplace(accessToken: string) {
      return request<PlatformMfaReplaceBeginResult>('/platform/auth/mfa/replace/begin', {
        method: 'POST',
        accessToken,
      });
    },

    confirmMfaReplace(accessToken: string, code: string) {
      return request<{ recoveryCodes: string[] }>('/platform/auth/mfa/replace/confirm', {
        method: 'POST',
        accessToken,
        body: JSON.stringify({ code }),
      });
    },

    async listSessions(accessToken: string): Promise<PlatformSessionsResult> {
      const sessions = await request<PlatformSession[]>('/platform/auth/sessions', {
        method: 'GET',
        accessToken,
      });
      const current = sessions.find((s) => s.isCurrent);
      return { sessions, currentSessionId: current?.sessionId ?? null };
    },

    revokeSession(accessToken: string, sessionId: string) {
      return request<void>(`/platform/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, {
        method: 'POST',
        accessToken,
      });
    },

    revokeOtherSessions(accessToken: string) {
      return request<PlatformRevokeCountResult>('/platform/auth/sessions/revoke-others', {
        method: 'POST',
        accessToken,
      });
    },

    revokeAllSessions(accessToken: string) {
      return request<PlatformRevokeCountResult>('/platform/auth/sessions/revoke-all', {
        method: 'POST',
        accessToken,
      });
    },

    stepUpVerify(accessToken: string, code: string) {
      return request<PlatformStepUpVerifyResult>('/platform/auth/step-up/verify', {
        method: 'POST',
        accessToken,
        body: JSON.stringify({ code }),
      });
    },

    stepUpStatus(accessToken: string) {
      return request<PlatformStepUpStatus>('/platform/auth/step-up/status', {
        method: 'GET',
        accessToken,
      });
    },

    listPlatformPlans(
      accessToken: string,
      query: { lifecycle?: string; search?: string; page?: number; pageSize?: number } = {},
    ) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      return request<{
        items: Array<{
          id: string;
          canonicalKey: string;
          lifecycle: string;
          displayName: string;
          hasOpenDraft: boolean;
          legacyAssignmentCount: number | null;
          planVersionSubscriberCount: { status: string; reason: string };
          version: number;
        }>;
        page: number;
        pageSize: number;
        total: number;
      }>(`/platform/plans?${params.toString()}`, { method: 'GET', accessToken });
    },

    getPlatformPlan(accessToken: string, planId: string) {
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}`,
        { method: 'GET', accessToken },
      );
    },

    createPlatformPlan(
      accessToken: string,
      body: {
        canonicalKey: string;
        sortOrder?: number;
        translations: Array<{ locale: string; displayName: string; shortDescription: string }>;
      },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>('/platform/plans', {
        method: 'POST',
        accessToken,
        headers,
        body: JSON.stringify(body),
      });
    },

    listPlatformPlanVersions(accessToken: string, planId: string) {
      return request<{ items: Array<Record<string, unknown>> }>(
        `/platform/plans/${encodeURIComponent(planId)}/versions`,
        { method: 'GET', accessToken },
      );
    },

    createPlatformPlanDraftVersion(
      accessToken: string,
      planId: string,
      body: {
        translations: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
      },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/versions`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    publishPlatformPlanVersion(
      accessToken: string,
      planId: string,
      versionId: string,
      body: { expectedRowVersion: number; reason: string },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/versions/${encodeURIComponent(versionId)}/publish`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    updatePlatformPlan(
      accessToken: string,
      planId: string,
      body: {
        expectedVersion: number;
        sortOrder?: number;
        translations?: Array<{ locale: string; displayName: string; shortDescription: string }>;
      },
    ) {
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}`,
        { method: 'PATCH', accessToken, body: JSON.stringify(body) },
      );
    },

    activatePlatformPlan(
      accessToken: string,
      planId: string,
      body: { expectedVersion: number; reason: string },
    ) {
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/activate`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    archivePlatformPlan(
      accessToken: string,
      planId: string,
      body: { expectedVersion: number; reason: string },
    ) {
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/archive`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    reactivatePlatformPlan(
      accessToken: string,
      planId: string,
      body: { expectedVersion: number; reason: string },
    ) {
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/reactivate`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    getPlatformPlanReferences(accessToken: string, planId: string) {
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/references`,
        { method: 'GET', accessToken },
      );
    },

    addPlatformPlanAlias(
      accessToken: string,
      planId: string,
      body: {
        aliasValue: string;
        sourceNamespace: string;
        migrationNote?: string;
        expectedVersion: number;
      },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/aliases`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    retirePlatformPlanAlias(
      accessToken: string,
      planId: string,
      aliasId: string,
      body: { expectedVersion: number; reason: string },
    ) {
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/aliases/${encodeURIComponent(aliasId)}/retire`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    getPlatformPlanVersion(accessToken: string, planId: string, versionId: string) {
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/versions/${encodeURIComponent(versionId)}`,
        { method: 'GET', accessToken },
      );
    },

    updatePlatformPlanDraftVersion(
      accessToken: string,
      planId: string,
      versionId: string,
      body: {
        expectedRowVersion: number;
        translations?: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
        effectiveFrom?: string | null;
        trialDefaultEnabled?: boolean | null;
        trialDefaultDays?: number | null;
        internalReleaseNotes?: string | null;
      },
    ) {
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/versions/${encodeURIComponent(versionId)}`,
        { method: 'PATCH', accessToken, body: JSON.stringify(body) },
      );
    },

    clonePlatformPlanVersion(
      accessToken: string,
      planId: string,
      versionId: string,
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/versions/${encodeURIComponent(versionId)}/clone`,
        { method: 'POST', accessToken, headers },
      );
    },

    getPlatformPlanVersionReadiness(accessToken: string, planId: string, versionId: string) {
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/versions/${encodeURIComponent(versionId)}/readiness`,
        { method: 'GET', accessToken },
      );
    },

    retirePlatformPlanVersion(
      accessToken: string,
      planId: string,
      versionId: string,
      body: { expectedRowVersion: number; reason: string },
    ) {
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/versions/${encodeURIComponent(versionId)}/retire`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    comparePlatformPlanVersions(
      accessToken: string,
      planId: string,
      leftId: string,
      rightId: string,
    ) {
      const params = new URLSearchParams({ leftId, rightId });
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/versions/compare?${params.toString()}`,
        { method: 'GET', accessToken },
      );
    },

    getPlatformPlanVersionEntitlements(accessToken: string, planId: string, versionId: string) {
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/versions/${encodeURIComponent(versionId)}/entitlements`,
        { method: 'GET', accessToken },
      );
    },

    updatePlatformPlanVersionEntitlements(
      accessToken: string,
      planId: string,
      versionId: string,
      body: {
        expectedRowVersion: number;
        grants: Array<{ canonicalKey: string; kind: string }>;
      },
    ) {
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/versions/${encodeURIComponent(versionId)}/entitlements`,
        { method: 'PUT', accessToken, body: JSON.stringify(body) },
      );
    },

    applyRequiredPlatformPlanVersionEntitlements(
      accessToken: string,
      planId: string,
      versionId: string,
      body: { expectedRowVersion: number },
    ) {
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/versions/${encodeURIComponent(versionId)}/entitlements/apply-required`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    getPlatformPlanVersionLimits(accessToken: string, planId: string, versionId: string) {
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/versions/${encodeURIComponent(versionId)}/limits`,
        { method: 'GET', accessToken },
      );
    },

    updatePlatformPlanVersionLimits(
      accessToken: string,
      planId: string,
      versionId: string,
      body: {
        expectedRowVersion: number;
        assignments: Array<{
          canonicalKey: string;
          state: string;
          value?: string | null;
        }>;
      },
    ) {
      return request<Record<string, unknown>>(
        `/platform/plans/${encodeURIComponent(planId)}/versions/${encodeURIComponent(versionId)}/limits`,
        { method: 'PUT', accessToken, body: JSON.stringify(body) },
      );
    },

    getPlatformPlanLegacyMappings(accessToken: string) {
      return request<{ items: Array<Record<string, unknown>>; unresolved: Array<Record<string, unknown>> }>(
        '/platform/plans/legacy-mappings',
        { method: 'GET', accessToken },
      );
    },

    // ─── Step 15: Add-ons ───────────────────────────────────────────────────

    listPlatformAddOns(
      accessToken: string,
      query: { lifecycle?: string; search?: string; page?: number; pageSize?: number } = {},
    ) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      return request<{
        items: Array<Record<string, unknown>>;
        page: number;
        pageSize: number;
        total: number;
        emptyCatalog: boolean;
      }>(`/platform/add-ons?${params.toString()}`, { method: 'GET', accessToken });
    },

    createPlatformAddOn(
      accessToken: string,
      body: {
        canonicalKey: string;
        translations: Array<{ locale: string; displayName: string; shortDescription: string }>;
      },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>('/platform/add-ons', {
        method: 'POST',
        accessToken,
        headers,
        body: JSON.stringify(body),
      });
    },

    getPlatformAddOn(accessToken: string, addOnId: string) {
      return request<Record<string, unknown>>(`/platform/add-ons/${encodeURIComponent(addOnId)}`, {
        method: 'GET',
        accessToken,
      });
    },

    updatePlatformAddOn(
      accessToken: string,
      addOnId: string,
      body: {
        expectedRowVersion: number;
        translations?: Array<{ locale: string; displayName: string; shortDescription: string }>;
      },
    ) {
      return request<Record<string, unknown>>(`/platform/add-ons/${encodeURIComponent(addOnId)}`, {
        method: 'PATCH',
        accessToken,
        body: JSON.stringify(body),
      });
    },

    activatePlatformAddOn(
      accessToken: string,
      addOnId: string,
      body: { expectedRowVersion: number; reason: string },
    ) {
      return request<Record<string, unknown>>(
        `/platform/add-ons/${encodeURIComponent(addOnId)}/activate`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    archivePlatformAddOn(
      accessToken: string,
      addOnId: string,
      body: { expectedRowVersion: number; reason: string },
    ) {
      return request<Record<string, unknown>>(
        `/platform/add-ons/${encodeURIComponent(addOnId)}/archive`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    listPlatformAddOnVersions(accessToken: string, addOnId: string) {
      return request<{ items: Array<Record<string, unknown>> }>(
        `/platform/add-ons/${encodeURIComponent(addOnId)}/versions`,
        { method: 'GET', accessToken },
      );
    },

    createPlatformAddOnDraftVersion(
      accessToken: string,
      addOnId: string,
      body: {
        translations: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
      },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/add-ons/${encodeURIComponent(addOnId)}/versions`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    getPlatformAddOnVersion(accessToken: string, addOnId: string, versionId: string) {
      return request<Record<string, unknown>>(
        `/platform/add-ons/${encodeURIComponent(addOnId)}/versions/${encodeURIComponent(versionId)}`,
        { method: 'GET', accessToken },
      );
    },

    replacePlatformAddOnEntitlements(
      accessToken: string,
      addOnId: string,
      versionId: string,
      body: { expectedRowVersion: number; catalogItemIds: string[] },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/add-ons/${encodeURIComponent(addOnId)}/versions/${encodeURIComponent(versionId)}/entitlements`,
        { method: 'PUT', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    replacePlatformAddOnLimitEffects(
      accessToken: string,
      addOnId: string,
      versionId: string,
      body: {
        expectedRowVersion: number;
        effects: Array<{
          catalogItemId: string;
          effectType: string;
          unlimited?: boolean;
          valueText?: string | null;
        }>;
      },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/add-ons/${encodeURIComponent(addOnId)}/versions/${encodeURIComponent(versionId)}/limit-effects`,
        { method: 'PUT', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    replacePlatformAddOnApplicability(
      accessToken: string,
      addOnId: string,
      versionId: string,
      body: { expectedRowVersion: number; planCanonicalKeys: string[] },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/add-ons/${encodeURIComponent(addOnId)}/versions/${encodeURIComponent(versionId)}/applicability`,
        { method: 'PUT', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    getPlatformAddOnVersionReadiness(accessToken: string, addOnId: string, versionId: string) {
      return request<Record<string, unknown>>(
        `/platform/add-ons/${encodeURIComponent(addOnId)}/versions/${encodeURIComponent(versionId)}/readiness`,
        { method: 'GET', accessToken },
      );
    },

    publishPlatformAddOnVersion(
      accessToken: string,
      addOnId: string,
      versionId: string,
      body: { expectedRowVersion: number; reason: string },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/add-ons/${encodeURIComponent(addOnId)}/versions/${encodeURIComponent(versionId)}/publish`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    retirePlatformAddOnVersion(
      accessToken: string,
      addOnId: string,
      versionId: string,
      body: { expectedRowVersion: number; reason: string },
    ) {
      return request<Record<string, unknown>>(
        `/platform/add-ons/${encodeURIComponent(addOnId)}/versions/${encodeURIComponent(versionId)}/retire`,
        { method: 'POST', accessToken, body: JSON.stringify(body) },
      );
    },

    clonePlatformAddOnVersion(
      accessToken: string,
      addOnId: string,
      versionId: string,
      body: {
        translations?: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
      } = {},
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/add-ons/${encodeURIComponent(addOnId)}/versions/${encodeURIComponent(versionId)}/clone`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    comparePlatformAddOnVersions(
      accessToken: string,
      addOnId: string,
      leftId: string,
      rightId: string,
    ) {
      const params = new URLSearchParams({ leftId, rightId });
      return request<Record<string, unknown>>(
        `/platform/add-ons/${encodeURIComponent(addOnId)}/versions/compare?${params.toString()}`,
        { method: 'GET', accessToken },
      );
    },

    // ─── Step 15: Commercial Overrides ──────────────────────────────────────

    listPlatformCommercialOverrides(
      accessToken: string,
      query: { lifecycle?: string; page?: number; pageSize?: number } = {},
    ) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      return request<{
        items: Array<Record<string, unknown>>;
        page: number;
        pageSize: number;
        total: number;
        emptyCatalog: boolean;
      }>(`/platform/commercial-overrides?${params.toString()}`, { method: 'GET', accessToken });
    },

    createPlatformCommercialOverride(
      accessToken: string,
      body: {
        reasonCode: string;
        reasonNote: string;
        effectiveFrom?: string | null;
        expiresAt?: string | null;
        effects: Array<{
          effectKind: string;
          catalogItemId: string;
          unlimited?: boolean;
          valueText?: string | null;
        }>;
        predecessorId?: string | null;
      },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>('/platform/commercial-overrides', {
        method: 'POST',
        accessToken,
        headers,
        body: JSON.stringify(body),
      });
    },

    getPlatformCommercialOverride(accessToken: string, overrideId: string) {
      return request<Record<string, unknown>>(
        `/platform/commercial-overrides/${encodeURIComponent(overrideId)}`,
        { method: 'GET', accessToken },
      );
    },

    updatePlatformCommercialOverride(
      accessToken: string,
      overrideId: string,
      body: {
        expectedRowVersion: number;
        reasonCode?: string;
        reasonNote?: string;
        effectiveFrom?: string | null;
        expiresAt?: string | null;
        effects?: Array<{
          effectKind: string;
          catalogItemId: string;
          unlimited?: boolean;
          valueText?: string | null;
        }>;
      },
    ) {
      return request<Record<string, unknown>>(
        `/platform/commercial-overrides/${encodeURIComponent(overrideId)}`,
        { method: 'PATCH', accessToken, body: JSON.stringify(body) },
      );
    },

    getPlatformCommercialOverrideReadiness(accessToken: string, overrideId: string) {
      return request<Record<string, unknown>>(
        `/platform/commercial-overrides/${encodeURIComponent(overrideId)}/readiness`,
        { method: 'GET', accessToken },
      );
    },

    submitPlatformCommercialOverride(
      accessToken: string,
      overrideId: string,
      body: { expectedRowVersion: number },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/commercial-overrides/${encodeURIComponent(overrideId)}/submit`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    approvePlatformCommercialOverride(
      accessToken: string,
      overrideId: string,
      body: { expectedRowVersion: number },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/commercial-overrides/${encodeURIComponent(overrideId)}/approve`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    rejectPlatformCommercialOverride(
      accessToken: string,
      overrideId: string,
      body: { expectedRowVersion: number; reason: string },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/commercial-overrides/${encodeURIComponent(overrideId)}/reject`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    revokePlatformCommercialOverride(
      accessToken: string,
      overrideId: string,
      body: { expectedRowVersion: number; reason: string },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/commercial-overrides/${encodeURIComponent(overrideId)}/revoke`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    supersedePlatformCommercialOverride(
      accessToken: string,
      overrideId: string,
      body: {
        reasonCode: string;
        reasonNote: string;
        effectiveFrom?: string | null;
        expiresAt?: string | null;
        effects: Array<{
          effectKind: string;
          catalogItemId: string;
          unlimited?: boolean;
          valueText?: string | null;
        }>;
      },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/commercial-overrides/${encodeURIComponent(overrideId)}/supersede`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    comparePlatformCommercialOverrides(
      accessToken: string,
      leftId: string,
      rightId: string,
    ) {
      const params = new URLSearchParams({ leftId, rightId });
      return request<Record<string, unknown>>(
        `/platform/commercial-overrides/compare?${params.toString()}`,
        { method: 'GET', accessToken },
      );
    },

    previewPlatformCommercialComposition(
      accessToken: string,
      body: {
        planVersionId: string;
        addonVersionIds?: string[];
        overrideIds?: string[];
      },
    ) {
      return request<Record<string, unknown>>('/platform/commercial-composition/preview', {
        method: 'POST',
        accessToken,
        body: JSON.stringify(body),
      });
    },

    listPlatformSubscriptions(
      accessToken: string,
      query: { lifecycle?: string; platformTenantId?: string; page?: number; pageSize?: number } = {},
    ) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      return request<{
        items: Array<{
          id: string;
          platformTenantId: string;
          lifecycle: string;
          planCanonicalKey: string | null;
          addonCount: number;
          overrideCount: number;
          isCurrent: boolean;
          disclaimer: string;
        }>;
        page: number;
        pageSize: number;
        total: number;
      }>(`/platform/subscriptions?${params.toString()}`, { method: 'GET', accessToken });
    },

    createPlatformSubscription(
      accessToken: string,
      body: {
        platformTenantId: string;
        platformSubscriptionId?: string | null;
        commercialStart?: string | null;
        commercialEnd?: string | null;
        reasonCode?: string | null;
      },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<{ id: string } & Record<string, unknown>>('/platform/subscriptions', {
        method: 'POST',
        accessToken,
        headers,
        body: JSON.stringify(body),
      });
    },

    getPlatformSubscription(accessToken: string, subscriptionId: string) {
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}`,
        { method: 'GET', accessToken },
      );
    },

    updatePlatformSubscription(
      accessToken: string,
      subscriptionId: string,
      body: { expectedRowVersion: number; reasonCode?: string | null },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}`,
        { method: 'PATCH', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    getPlatformSubscriptionHistory(accessToken: string, subscriptionId: string) {
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/history`,
        { method: 'GET', accessToken },
      );
    },

    assignPlatformSubscriptionPlanVersion(
      accessToken: string,
      subscriptionId: string,
      body: { expectedRowVersion: number; planVersionId: string },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/plan-version`,
        { method: 'PUT', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    replacePlatformSubscriptionAddOns(
      accessToken: string,
      subscriptionId: string,
      body: { expectedRowVersion: number; addOnVersionIds: string[] },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/add-ons`,
        { method: 'PUT', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    replacePlatformSubscriptionOverrides(
      accessToken: string,
      subscriptionId: string,
      body: { expectedRowVersion: number; overrideIds: string[] },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/overrides`,
        { method: 'PUT', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    updatePlatformSubscriptionDates(
      accessToken: string,
      subscriptionId: string,
      body: {
        expectedRowVersion: number;
        commercialStart?: string | null;
        commercialEnd?: string | null;
        scheduledActivationAt?: string | null;
      },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/effective-dates`,
        { method: 'PUT', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    getPlatformSubscriptionReadiness(accessToken: string, subscriptionId: string) {
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/readiness`,
        { method: 'GET', accessToken },
      );
    },

    previewPlatformSubscription(accessToken: string, subscriptionId: string) {
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/preview`,
        { method: 'POST', accessToken, body: JSON.stringify({}) },
      );
    },

    comparePlatformSubscriptions(
      accessToken: string,
      subscriptionId: string,
      otherId: string,
    ) {
      const params = new URLSearchParams({ otherId });
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/compare?${params.toString()}`,
        { method: 'GET', accessToken },
      );
    },

    schedulePlatformSubscription(
      accessToken: string,
      subscriptionId: string,
      body: { expectedRowVersion: number; scheduledActivationAt: string; reason: string },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/schedule`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    activatePlatformSubscription(
      accessToken: string,
      subscriptionId: string,
      body: { expectedRowVersion: number; reason: string },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/activate`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    suspendPlatformSubscription(
      accessToken: string,
      subscriptionId: string,
      body: { expectedRowVersion: number; reason: string },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/suspend`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    resumePlatformSubscription(
      accessToken: string,
      subscriptionId: string,
      body: { expectedRowVersion: number; reason: string },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/resume`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    cancelPlatformSubscription(
      accessToken: string,
      subscriptionId: string,
      body: { expectedRowVersion: number; reason: string; cancellationEffectiveAt?: string },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    supersedePlatformSubscription(
      accessToken: string,
      subscriptionId: string,
      body: { expectedRowVersion: number; reason: string },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/supersede`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    renewPlatformSubscription(
      accessToken: string,
      subscriptionId: string,
      body: { expectedRowVersion: number; reason: string; renewalEffectiveAt: string },
      idempotencyKey?: string,
    ) {
      const headers = new Headers();
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      return request<Record<string, unknown>>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/renew`,
        { method: 'POST', accessToken, headers, body: JSON.stringify(body) },
      );
    },

    
    /** U01 — list tenant usage meter projections (usage.view). */
    listTenantUsage(accessToken: string, tenantId: string) {
      return request<{
        tenantId: string;
        meters: Array<{
          meterKey: string;
          limitKey: string;
          currentValue: string;
          projectedValue: string;
          limitState: string;
          limitValue?: string;
          enforcementMode: string;
          thresholdState?: string;
          staleClass: string;
          periodType: string;
          lastObservationAt?: string | null;
          lastReconciledAt?: string | null;
          privacyClass: string;
        }>;
      }>(`/platform/tenants/${encodeURIComponent(tenantId)}/usage`, {
        method: 'GET',
        accessToken,
      });
    },

    /** U01 — single meter projection. */
    getTenantUsageMeter(accessToken: string, tenantId: string, meterKey: string) {
      return request<Record<string, unknown>>(
        `/platform/tenants/${encodeURIComponent(tenantId)}/usage/${encodeURIComponent(meterKey)}`,
        { method: 'GET', accessToken },
      );
    },

    /** Flexible Step 19 — lifecycle summary (tenant.view). */
    getTenantLifecycle(accessToken: string, tenantId: string) {
      return request<{
        tenantId: string;
        platformTenantId: string;
        displayName: string;
        status: string;
        rowVersion: number;
        lifecycleEnabled: boolean;
        pendingRequests: Array<{ id: string; type: string; status: string }>;
      }>(`/platform/tenants/${encodeURIComponent(tenantId)}/lifecycle`, {
        method: 'GET',
        accessToken,
      });
    },

    previewTenantLifecycle(
      accessToken: string,
      tenantId: string,
      action: string,
    ) {
      return request<{
        previewFingerprint: string;
        blockers: string[];
        activeSessionCount: number;
        reversible: boolean;
      }>(`/platform/tenants/${encodeURIComponent(tenantId)}/lifecycle/preview`, {
        method: 'POST',
        accessToken,
        body: JSON.stringify({ action }),
      });
    },

    mutateTenantLifecycle(
      accessToken: string,
      tenantId: string,
      action: 'suspend' | 'reactivate' | 'activate',
      body: {
        expectedRowVersion: number;
        reason: string;
        previewFingerprint: string;
      },
      idempotencyKey: string,
    ) {
      return request<Record<string, unknown>>(
        `/platform/tenants/${encodeURIComponent(tenantId)}/lifecycle/${action}`,
        {
          method: 'POST',
          accessToken,
          body: JSON.stringify(body),
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      );
    },

    createTenantLifecycleArchiveRequest(
      accessToken: string,
      tenantId: string,
      body: {
        expectedRowVersion: number;
        reason: string;
        previewFingerprint: string;
      },
      idempotencyKey: string,
    ) {
      return request<Record<string, unknown>>(
        `/platform/tenants/${encodeURIComponent(tenantId)}/lifecycle/archive-requests`,
        {
          method: 'POST',
          accessToken,
          body: JSON.stringify(body),
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      );
    },

    createTenantLifecycleDeletionRequest(
      accessToken: string,
      tenantId: string,
      body: {
        expectedRowVersion: number;
        reason: string;
        previewFingerprint: string;
        typedConfirmation: string;
      },
      idempotencyKey: string,
    ) {
      return request<Record<string, unknown>>(
        `/platform/tenants/${encodeURIComponent(tenantId)}/lifecycle/deletion-requests`,
        {
          method: 'POST',
          accessToken,
          body: JSON.stringify(body),
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      );
    },

    decideTenantLifecycleRequest(
      accessToken: string,
      requestId: string,
      decision: 'approve' | 'reject' | 'cancel',
      body: {
        expectedRowVersion: number;
        reason: string;
        previewFingerprint?: string;
        decisionReason?: string;
      },
      idempotencyKey: string,
    ) {
      return request<Record<string, unknown>>(
        `/platform/tenant-lifecycle-requests/${encodeURIComponent(requestId)}/${decision}`,
        {
          method: 'POST',
          accessToken,
          body: JSON.stringify(body),
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      );
    },
    /** Step 17 — bounded runtime inspection (platform auth, subscription.view). */
    getPlatformSubscriptionRuntime(accessToken: string, subscriptionId: string) {
      return request<{
        source: 'SNAPSHOT' | 'LEGACY';
        code: string;
        lifecycle?: string;
        snapshotId?: string;
        fingerprintSchema?: string;
        fingerprint?: string;
        planCanonicalKey?: string;
        planVersionNumber?: number;
        addonCount?: number;
        overrideCount?: number;
        moduleCount: number;
        featureCount: number;
        specialtyCount?: number;
        limitsSummary: Array<{ key: string; state: string }>;
        cacheStatus: string;
        evaluatedAt: string;
        blockers?: Array<{ code: string }>;
      }>(`/platform/subscriptions/${encodeURIComponent(subscriptionId)}/runtime`, {
        method: 'GET',
        accessToken,
      });
    },

    /** Step 17 — bounded entitlement explanation by canonical key. */
    explainPlatformSubscriptionRuntime(
      accessToken: string,
      subscriptionId: string,
      key: string,
    ) {
      const params = new URLSearchParams({ key });
      return request<{
        key: string;
        catalogKind?: string;
        allowed: boolean;
        code: string;
        source: 'SNAPSHOT' | 'LEGACY';
        sourceId?: string;
        snapshotId?: string;
        fingerprintSchema?: string;
        fingerprint?: string;
        planCanonicalKey?: string;
        planVersionNumber?: number;
        lifecycle?: string;
        limitState?: string;
        evaluatedAt: string;
        attribution?: Array<{ code: string; source: string; canonicalKey?: string }>;
      }>(
        `/platform/subscriptions/${encodeURIComponent(subscriptionId)}/runtime/explain?${params.toString()}`,
        { method: 'GET', accessToken },
      );
    },

    /**
     * Interactive activity signal — empty body; server uses its clock.
     * Does not grant auth, permissions, or step-up.
     */
    recordActivity(accessToken: string) {
      return request<{
        sessionId: string;
        lastInteractiveActivityAt: string;
        idleExpiresAt: string;
        absoluteExpiresAt: string;
        updated: boolean;
      }>('/platform/auth/activity', {
        method: 'POST',
        accessToken,
        body: JSON.stringify({}),
      });
    },

    /** Flexible Step 20 — Feature Flags and Global Settings */
    listFeatureFlags(accessToken: string) {
      return request<unknown[]>('/platform/feature-flags', {
        method: 'GET',
        accessToken,
      });
    },

    getFeatureFlag(accessToken: string, flagId: string) {
      return request<Record<string, unknown>>(
        `/platform/feature-flags/${encodeURIComponent(flagId)}`,
        { method: 'GET', accessToken },
      );
    },

    previewFeatureFlag(accessToken: string, body: Record<string, unknown>) {
      return request<{ previewFingerprint: string; expiresAt: string }>(
        '/platform/feature-flags/preview',
        {
          method: 'POST',
          accessToken,
          body: JSON.stringify(body),
        },
      );
    },

    createFeatureFlag(accessToken: string, body: Record<string, unknown>, idempotencyKey: string) {
      return request<Record<string, unknown>>('/platform/feature-flags', {
        method: 'POST',
        accessToken,
        body: JSON.stringify(body),
        headers: { 'Idempotency-Key': idempotencyKey },
      });
    },

    activateFeatureFlagKillSwitch(
      accessToken: string,
      flagId: string,
      body: Record<string, unknown>,
      idempotencyKey: string,
    ) {
      return request<Record<string, unknown>>(
        `/platform/feature-flags/${encodeURIComponent(flagId)}/kill-switch/activate`,
        {
          method: 'POST',
          accessToken,
          body: JSON.stringify(body),
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      );
    },

    deactivateFeatureFlagKillSwitch(
      accessToken: string,
      flagId: string,
      body: Record<string, unknown>,
      idempotencyKey: string,
    ) {
      return request<Record<string, unknown>>(
        `/platform/feature-flags/${encodeURIComponent(flagId)}/kill-switch/deactivate`,
        {
          method: 'POST',
          accessToken,
          body: JSON.stringify(body),
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      );
    },

    listGlobalSettings(accessToken: string) {
      return request<unknown[]>('/platform/global-settings', {
        method: 'GET',
        accessToken,
      });
    },

    getGlobalSetting(accessToken: string, key: string) {
      return request<Record<string, unknown>>(
        `/platform/global-settings/${encodeURIComponent(key)}`,
        { method: 'GET', accessToken },
      );
    },

    /** Flexible Step 21 — Audit Center */
    searchAuditEntries(
      accessToken: string,
      query: Record<string, string | undefined>,
    ) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v) qs.set(k, v);
      }
      const suffix = qs.toString() ? `?${qs}` : '';
      return request<{ items: unknown[]; nextCursor: string | null }>(
        `/platform/audit/entries${suffix}`,
        { method: 'GET', accessToken },
      );
    },

    getAuditEntry(accessToken: string, id: string) {
      return request<Record<string, unknown>>(
        `/platform/audit/entries/${encodeURIComponent(id)}`,
        { method: 'GET', accessToken },
      );
    },

    getAuditCorrelation(accessToken: string, correlationId: string) {
      return request<{ items: unknown[] }>(
        `/platform/audit/correlation/${encodeURIComponent(correlationId)}`,
        { method: 'GET', accessToken },
      );
    },

    previewAuditExport(accessToken: string, body: Record<string, unknown>) {
      return request<{ filterFingerprint: string }>('/platform/audit/exports/preview', {
        method: 'POST',
        accessToken,
        body: JSON.stringify(body),
      });
    },

    createAuditExport(accessToken: string, body: Record<string, unknown>) {
      return request<Record<string, unknown>>('/platform/audit/exports', {
        method: 'POST',
        accessToken,
        body: JSON.stringify(body),
        headers: { 'Idempotency-Key': `export-${Date.now()}` },
      });
    },

    getPlanVersionAuditEvidence(accessToken: string, planVersionId: string) {
      return request<Record<string, unknown>>(
        `/platform/audit/plan-versions/${encodeURIComponent(planVersionId)}/evidence`,
        { method: 'GET', accessToken },
      );
    },

    getOverrideAuditEvidence(accessToken: string, overrideId: string) {
      return request<Record<string, unknown>>(
        `/platform/audit/overrides/${encodeURIComponent(overrideId)}/evidence`,
        { method: 'GET', accessToken },
      );
    },

    /** Flexible Step 22 — Operations Console */
    getOperationsOverview(accessToken: string) {
      return request<Record<string, unknown>>('/platform/operations/overview', {
        method: 'GET',
        accessToken,
      });
    },
    getOperationsHealth(accessToken: string) {
      return request<Record<string, unknown>>('/platform/operations/health', {
        method: 'GET',
        accessToken,
      });
    },
    listOperationsJobs(accessToken: string, query: Record<string, string | undefined> = {}) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v) qs.set(k, v);
      }
      const suffix = qs.toString() ? `?${qs}` : '';
      return request<{ items: unknown[]; nextCursor: string | null }>(
        `/platform/operations/jobs${suffix}`,
        { method: 'GET', accessToken },
      );
    },
    listOperationsProvisioning(accessToken: string) {
      return request<unknown[]>('/platform/operations/provisioning', {
        method: 'GET',
        accessToken,
      });
    },
    retryOperationsProvisioning(
      accessToken: string,
      requestId: string,
      body: { expectedRowVersion: number; reason: string },
      idempotencyKey: string,
    ) {
      return request<{
        accepted: boolean;
        replayed: boolean;
        action: string;
        targetId: string;
        correlationId: string;
        result: string;
        sourceEffect: string;
      }>(`/platform/operations/provisioning/${encodeURIComponent(requestId)}/retry`, {
        method: 'POST',
        accessToken,
        body: JSON.stringify(body),
        headers: { 'Idempotency-Key': idempotencyKey },
      });
    },
    listOperationsSubscriptionExpiry(accessToken: string) {
      return request<unknown[]>('/platform/operations/subscription-expiry', {
        method: 'GET',
        accessToken,
      });
    },
    listOperationsOverrideExpiry(accessToken: string) {
      return request<unknown[]>('/platform/operations/override-expiry', {
        method: 'GET',
        accessToken,
      });
    },
    getOperationsEntitlementHealth(accessToken: string) {
      return request<Record<string, unknown>>('/platform/operations/entitlement-health', {
        method: 'GET',
        accessToken,
      });
    },
    getOperationsCompatibility(accessToken: string) {
      return request<Record<string, unknown>>('/platform/operations/compatibility', {
        method: 'GET',
        accessToken,
      });
    },
    listOperationsIntegrations(accessToken: string) {
      return request<unknown[]>('/platform/operations/integrations', {
        method: 'GET',
        accessToken,
      });
    },
    listOperationsBackups(accessToken: string) {
      return request<unknown[]>('/platform/operations/backups', {
        method: 'GET',
        accessToken,
      });
    },
  };
}

export type PlatformAuthClient = ReturnType<typeof createPlatformAuthClient>;
