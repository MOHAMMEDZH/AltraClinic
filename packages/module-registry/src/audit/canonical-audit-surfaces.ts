import {
  AUDIT_BUILTIN_PROVIDER_KEY,
  AUDIT_CONTRIBUTION_SCHEMA_VERSION,
  type CanonicalAuditSurface,
  type CanonicalAuditSurfaceEntry,
} from './audit-types';
import {
  CANONICAL_AUDIT_EVENT_TYPES,
  CANONICAL_AUDIT_EVENT_TYPE_COUNT,
} from './canonical-audit-event-types';
import { CANONICAL_AUDIT_FEEDS, CANONICAL_AUDIT_FEED_COUNT } from './canonical-audit-feeds';

/** Canonical audit navigation surfaces — owned by settings (api.audit). */
export const CANONICAL_AUDIT_NAV_SURFACES: readonly CanonicalAuditSurface[] = [
  {
    surfaceId: 'audit-center',
    localId: 'surface-audit-center',
    moduleId: 'settings',
    auditKind: 'surface',
    ownerModuleId: 'settings',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    labelKey: 'audit.surface.audit-center',
    descriptionKey: 'audit.surface.audit-center.description',
    route: '/settings/audit',
    deepLinkTemplate: '/settings/audit',
    permissionResource: 'api.audit',
    permissionAction: 'view',
    requiredFeature: 'auditLogs',
    branchScope: 'branch',
    retentionPolicyId: 'retention.hot-365d',
    redactionPolicyId: 'redaction.standard',
    exportPolicyId: 'export.redacted',
    sortOrder: 10,
    schemaVersion: '1',
    contributionSchemaVersion: AUDIT_CONTRIBUTION_SCHEMA_VERSION,
  },
  {
    surfaceId: 'security-audit',
    localId: 'surface-security-audit',
    moduleId: 'settings',
    auditKind: 'surface',
    ownerModuleId: 'settings',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    labelKey: 'audit.surface.security-audit',
    descriptionKey: 'audit.surface.security-audit.description',
    route: '/settings/audit/security',
    deepLinkTemplate: '/settings/audit/security',
    permissionResource: 'api.audit',
    permissionAction: 'view',
    requiredFeature: 'auditLogs',
    branchScope: 'branch',
    retentionPolicyId: 'retention.hot-365d',
    redactionPolicyId: 'redaction.security-elevated',
    exportPolicyId: 'export.redacted',
    sortOrder: 20,
    schemaVersion: '1',
    contributionSchemaVersion: AUDIT_CONTRIBUTION_SCHEMA_VERSION,
  },
  {
    surfaceId: 'clinical-audit',
    localId: 'surface-clinical-audit',
    moduleId: 'settings',
    auditKind: 'surface',
    ownerModuleId: 'settings',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    labelKey: 'audit.surface.clinical-audit',
    descriptionKey: 'audit.surface.clinical-audit.description',
    route: '/settings/audit/clinical',
    deepLinkTemplate: '/settings/audit/clinical',
    permissionResource: 'api.audit',
    permissionAction: 'view',
    requiredFeature: 'auditLogs',
    branchScope: 'branch',
    retentionPolicyId: 'retention.warm-7y',
    redactionPolicyId: 'redaction.phi-strict',
    exportPolicyId: 'export.redacted',
    sortOrder: 30,
    schemaVersion: '1',
    contributionSchemaVersion: AUDIT_CONTRIBUTION_SCHEMA_VERSION,
  },
  {
    surfaceId: 'legal-hold-audit',
    localId: 'surface-legal-hold-audit',
    moduleId: 'settings',
    auditKind: 'surface',
    ownerModuleId: 'settings',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    labelKey: 'audit.surface.legal-hold-audit',
    descriptionKey: 'audit.surface.legal-hold-audit.description',
    route: '/settings/audit/legal-hold',
    deepLinkTemplate: '/settings/audit/legal-hold',
    permissionResource: 'api.audit',
    permissionAction: 'manage',
    requiredFeature: 'auditLogs',
    branchScope: 'tenant',
    retentionPolicyId: 'retention.legal-hold',
    redactionPolicyId: 'redaction.security-elevated',
    exportPolicyId: 'export.legal-hold-only',
    sortOrder: 40,
    schemaVersion: '1',
    contributionSchemaVersion: AUDIT_CONTRIBUTION_SCHEMA_VERSION,
  },
] as const;

export const CANONICAL_AUDIT_NAV_SURFACE_COUNT = CANONICAL_AUDIT_NAV_SURFACES.length;
export const CANONICAL_AUDIT_SURFACE_IDS = CANONICAL_AUDIT_NAV_SURFACES.map((s) => s.surfaceId);

/** Aggregated contribution surfaces: types → feeds → nav surfaces. */
export const CANONICAL_AUDIT_SURFACES: readonly CanonicalAuditSurfaceEntry[] = [
  ...CANONICAL_AUDIT_EVENT_TYPES,
  ...CANONICAL_AUDIT_FEEDS,
  ...CANONICAL_AUDIT_NAV_SURFACES,
] as const;

export const CANONICAL_AUDIT_SURFACE_COUNT = CANONICAL_AUDIT_SURFACES.length;

export const CANONICAL_AUDIT_ENTRY_COUNT =
  CANONICAL_AUDIT_EVENT_TYPE_COUNT + CANONICAL_AUDIT_FEED_COUNT + CANONICAL_AUDIT_NAV_SURFACE_COUNT;
