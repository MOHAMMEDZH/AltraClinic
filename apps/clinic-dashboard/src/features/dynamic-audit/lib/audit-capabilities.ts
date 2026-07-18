import type {
  AuditCapabilityFlags,
  AuditEventTypeSnapshot,
  AuditFeedSnapshot,
  AuditSnapshot,
  AuditSurfaceSnapshot,
} from './audit-types';

function hasFeed(feeds: AuditFeedSnapshot[], feedId: string): boolean {
  return feeds.some((feed) => feed.feedId === feedId);
}

function hasSurface(surfaces: AuditSurfaceSnapshot[], surfaceId: string): boolean {
  return surfaces.some((surface) => surface.surfaceId === surfaceId);
}

/** Aggregate capabilities projected exclusively from snapshot — never UI-recomputed. */
export function resolveAuditCapabilities(input: {
  eventTypes: AuditEventTypeSnapshot[];
  feeds: AuditFeedSnapshot[];
  surfaces: AuditSurfaceSnapshot[];
}): AuditCapabilityFlags {
  const { eventTypes, feeds, surfaces } = input;

  const canViewSecurityAudit = hasFeed(feeds, 'security') || hasSurface(surfaces, 'security-audit');
  const canViewClinicalAudit = hasFeed(feeds, 'clinical') || hasSurface(surfaces, 'clinical-audit');
  const canViewFinancialAudit = hasFeed(feeds, 'financial');
  const canViewCrossBranchAudit = hasFeed(feeds, 'branch-audit');
  const canExportAudit = hasFeed(feeds, 'data-exports');
  const canPlaceLegalHold = hasFeed(feeds, 'legal-hold') || hasSurface(surfaces, 'legal-hold-audit');
  const canManageRetentionPolicies = canPlaceLegalHold;
  const canViewSensitiveAuditDetails = canViewSecurityAudit || canViewClinicalAudit || canPlaceLegalHold;
  const canVerifyAuditIntegrity = canExportAudit || canPlaceLegalHold;

  const canViewAuditCenter =
    eventTypes.length > 0 ||
    feeds.length > 0 ||
    hasSurface(surfaces, 'audit-center') ||
    canViewSecurityAudit ||
    canViewClinicalAudit;

  const canSearchAudit = canViewAuditCenter;

  return {
    canViewAuditCenter,
    canViewSecurityAudit,
    canViewClinicalAudit,
    canViewFinancialAudit,
    canViewCrossBranchAudit,
    canSearchAudit,
    canExportAudit,
    canVerifyAuditIntegrity,
    canManageRetentionPolicies,
    canPlaceLegalHold,
    canViewSensitiveAuditDetails,
  };
}

export function resolveAuditCapabilitiesFromSnapshot(snapshot: AuditSnapshot): AuditCapabilityFlags {
  return {
    canViewAuditCenter: snapshot.canViewAuditCenter,
    canViewSecurityAudit: snapshot.canViewSecurityAudit,
    canViewClinicalAudit: snapshot.canViewClinicalAudit,
    canViewFinancialAudit: snapshot.canViewFinancialAudit,
    canViewCrossBranchAudit: snapshot.canViewCrossBranchAudit,
    canSearchAudit: snapshot.canSearchAudit,
    canExportAudit: snapshot.canExportAudit,
    canVerifyAuditIntegrity: snapshot.canVerifyAuditIntegrity,
    canManageRetentionPolicies: snapshot.canManageRetentionPolicies,
    canPlaceLegalHold: snapshot.canPlaceLegalHold,
    canViewSensitiveAuditDetails: snapshot.canViewSensitiveAuditDetails,
  };
}

export function emptyAuditCapabilities(): AuditCapabilityFlags {
  return {
    canViewAuditCenter: false,
    canViewSecurityAudit: false,
    canViewClinicalAudit: false,
    canViewFinancialAudit: false,
    canViewCrossBranchAudit: false,
    canSearchAudit: false,
    canExportAudit: false,
    canVerifyAuditIntegrity: false,
    canManageRetentionPolicies: false,
    canPlaceLegalHold: false,
    canViewSensitiveAuditDetails: false,
  };
}
