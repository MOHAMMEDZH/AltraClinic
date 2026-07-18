import type { AuditContribution, ModuleManifest } from '../types';
import { CANONICAL_AUDIT_EVENT_TYPES, CANONICAL_AUDIT_EVENT_TYPE_COUNT } from './canonical-audit-event-types';
import { CANONICAL_AUDIT_FEEDS, CANONICAL_AUDIT_FEED_COUNT } from './canonical-audit-feeds';
import {
  CANONICAL_AUDIT_ENTRY_COUNT,
  CANONICAL_AUDIT_NAV_SURFACES,
  CANONICAL_AUDIT_NAV_SURFACE_COUNT,
  CANONICAL_AUDIT_SURFACES,
} from './canonical-audit-surfaces';
import {
  AUDIT_BUILTIN_PROVIDER_KEY,
  CANONICAL_AUDIT_FEATURE_IDS,
  type CanonicalAuditSurfaceEntry,
} from './audit-types';
import { validateCanonicalAuditVocabulary } from './validate-canonical-audit-vocabulary';

const CANONICAL_BY_EXTENSION_ID = new Map(
  CANONICAL_AUDIT_SURFACES.map((entry) => [`${entry.moduleId}/audit/${entry.localId}`, entry]),
);

const FEED_LOCAL_IDS = new Set(CANONICAL_AUDIT_FEEDS.map((feed) => feed.localId));
const SURFACE_LOCAL_IDS = new Set(CANONICAL_AUDIT_NAV_SURFACES.map((surface) => surface.localId));
const VALID_FEATURE_IDS = new Set<string>(CANONICAL_AUDIT_FEATURE_IDS);
const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;
const VALID_PERMISSION_ACTIONS = new Set(['view', 'create', 'update', 'delete', 'approve', 'export', 'manage']);

export function collectManifestAuditContributions(manifests: ModuleManifest[]): AuditContribution[] {
  return manifests.flatMap((manifest) => manifest.extensions.audit ?? []);
}

export function validateBuiltinAuditIntegrity(manifests: ModuleManifest[]): string[] {
  const errors: string[] = [...validateCanonicalAuditVocabulary()];

  const seenExtensionIds = new Map<string, string>();
  const seenEventTypeIds = new Map<string, string>();
  const seenFeedIds = new Map<string, string>();
  const seenSurfaceIds = new Map<string, string>();
  const seenDeepLinks = new Map<string, string>();
  const seenRoutes = new Map<string, string>();
  const seenProviderOwners = new Map<string, string>();

  let manifestAuditCount = 0;

  for (const manifest of manifests) {
    const audit = manifest.extensions.audit ?? [];
    manifestAuditCount += audit.length;

    for (const contribution of audit) {
      const owner = contribution.extensionId;

      const priorExt = seenExtensionIds.get(contribution.extensionId);
      if (priorExt) {
        errors.push(`Duplicate audit extensionId "${contribution.extensionId}" (${priorExt} and ${owner})`);
      } else {
        seenExtensionIds.set(contribution.extensionId, owner);
      }

      if (!contribution.extensionId.startsWith(`${manifest.moduleId}/audit/`)) {
        errors.push(
          `Audit extensionId "${contribution.extensionId}" must be prefixed with ${manifest.moduleId}/audit/`,
        );
      }

      if (
        (FEED_LOCAL_IDS.has(contribution.localId!) || SURFACE_LOCAL_IDS.has(contribution.localId!)) &&
        manifest.moduleId !== 'settings'
      ) {
        errors.push(
          `Audit feed/surface "${contribution.localId}" must be declared on settings module (found on ${manifest.moduleId})`,
        );
      }

      if (!contribution.providerKey) {
        errors.push(`Audit contribution ${owner} missing providerKey`);
      } else if (!PROVIDER_KEY_PATTERN.test(contribution.providerKey)) {
        errors.push(`Audit contribution ${owner} has invalid providerKey "${contribution.providerKey}"`);
      } else if (contribution.providerKey !== AUDIT_BUILTIN_PROVIDER_KEY) {
        errors.push(
          `Audit contribution ${owner} must use providerKey "${AUDIT_BUILTIN_PROVIDER_KEY}"`,
        );
      }

      if (contribution.auditKind === 'feed' && contribution.feedId) {
        const ownershipKey = `${contribution.feedId}::${contribution.providerKey}`;
        const priorOwner = seenProviderOwners.get(ownershipKey);
        const ownerClaim = String(contribution.ownerModuleId ?? contribution.owningModuleId ?? manifest.moduleId);
        if (priorOwner && priorOwner !== ownerClaim) {
          errors.push(
            `Ambiguous feed ownership for "${contribution.feedId}" (${priorOwner} and ${ownerClaim})`,
          );
        } else {
          seenProviderOwners.set(ownershipKey, ownerClaim);
        }

        const priorFeed = seenFeedIds.get(contribution.feedId);
        if (priorFeed) {
          errors.push(`Duplicate feedId "${contribution.feedId}" (${priorFeed} and ${owner})`);
        } else {
          seenFeedIds.set(contribution.feedId, owner);
        }

        if (!contribution.ownerModuleId || !contribution.visibility || !contribution.licensing) {
          errors.push(`Audit feed ${owner} has invalid ownership metadata`);
        }
        if (
          !contribution.retentionPolicyId ||
          !contribution.redactionPolicyId ||
          !contribution.exportPolicyId
        ) {
          errors.push(`Audit feed ${owner} has invalid policy metadata`);
        }
      }

      if (contribution.auditKind === 'surface' && contribution.surfaceId) {
        const priorSurface = seenSurfaceIds.get(contribution.surfaceId);
        if (priorSurface) {
          errors.push(`Duplicate surfaceId "${contribution.surfaceId}" (${priorSurface} and ${owner})`);
        } else {
          seenSurfaceIds.set(contribution.surfaceId, owner);
        }
      }

      if (contribution.auditKind === 'type') {
        if (!contribution.auditEventTypeId) {
          errors.push(`Audit type contribution ${owner} missing auditEventTypeId`);
        } else {
          const priorType = seenEventTypeIds.get(contribution.auditEventTypeId);
          if (priorType) {
            errors.push(
              `Duplicate auditEventTypeId "${contribution.auditEventTypeId}" (${priorType} and ${owner})`,
            );
          } else {
            seenEventTypeIds.set(contribution.auditEventTypeId, owner);
          }
        }
        if (!contribution.owningModuleId || !contribution.producerModuleId) {
          errors.push(`Audit type ${owner} has invalid ownership metadata`);
        }
        if (
          !contribution.retentionPolicyId ||
          !contribution.redactionPolicyId ||
          !contribution.integrityPolicyId ||
          !contribution.exportPolicyId
        ) {
          errors.push(`Audit type ${owner} has invalid policy metadata`);
        }
        if (!contribution.eventVersion || !contribution.schemaVersion) {
          errors.push(`Audit type ${owner} has invalid version metadata`);
        }
        if (contribution.tenantScoped !== true) {
          errors.push(`Audit type ${owner} has invalid tenantScoped`);
        }
      }

      if (contribution.requiredFeature && !VALID_FEATURE_IDS.has(contribution.requiredFeature)) {
        errors.push(`Audit contribution ${owner} has invalid featureId "${contribution.requiredFeature}"`);
      }

      const permissionResource = contribution.permissionResource ?? contribution.resourceId;
      if (!permissionResource?.startsWith('api.')) {
        errors.push(`Audit contribution ${owner} has invalid permission resource`);
      }

      if (
        contribution.permissionAction &&
        !VALID_PERMISSION_ACTIONS.has(contribution.permissionAction)
      ) {
        errors.push(`Audit contribution ${owner} has invalid permissionAction`);
      }

      if (!contribution.deepLinkTemplate) {
        errors.push(`Audit contribution ${owner} missing deepLinkTemplate`);
      } else if (!contribution.deepLinkTemplate.startsWith('/')) {
        errors.push(`Audit contribution ${owner} deepLinkTemplate must start with "/"`);
      } else {
        const prior = seenDeepLinks.get(contribution.deepLinkTemplate);
        if (prior) {
          errors.push(`Duplicate deepLinkTemplate "${contribution.deepLinkTemplate}" (${prior} and ${owner})`);
        } else {
          seenDeepLinks.set(contribution.deepLinkTemplate, owner);
        }
      }

      if (contribution.route) {
        if (!contribution.route.startsWith('/')) {
          errors.push(`Audit contribution ${owner} has invalid route "${contribution.route}"`);
        }
        const priorRoute = seenRoutes.get(contribution.route);
        if (priorRoute) {
          errors.push(`Duplicate route "${contribution.route}" (${priorRoute} and ${owner})`);
        } else {
          seenRoutes.set(contribution.route, owner);
        }
      }

      const canonical = CANONICAL_BY_EXTENSION_ID.get(contribution.extensionId);
      if (!canonical) {
        errors.push(`Orphan audit contribution "${contribution.extensionId}" (no canonical entry)`);
        continue;
      }

      if (manifest.moduleId !== canonical.moduleId) {
        errors.push(
          `Audit "${contribution.localId}" ownership mismatch: manifest=${manifest.moduleId} canonical=${canonical.moduleId}`,
        );
      }

      if (contribution.auditKind !== canonical.auditKind) {
        errors.push(
          `Audit "${contribution.localId}" auditKind mismatch: manifest=${contribution.auditKind} canonical=${canonical.auditKind}`,
        );
      }

      if ((contribution.providerKey ?? null) !== canonical.providerKey) {
        errors.push(
          `Audit "${contribution.localId}" providerKey mismatch: manifest=${contribution.providerKey ?? 'null'} canonical=${canonical.providerKey}`,
        );
      }

      compareSurfaceFields(errors, contribution, canonical);
    }
  }

  for (const surface of CANONICAL_AUDIT_SURFACES) {
    const extensionId = `${surface.moduleId}/audit/${surface.localId}`;
    if (!seenExtensionIds.has(extensionId)) {
      errors.push(`Missing audit contribution for canonical entry "${extensionId}"`);
    }
  }

  if (manifestAuditCount !== CANONICAL_AUDIT_ENTRY_COUNT) {
    errors.push(
      `Audit contribution count mismatch: manifests=${manifestAuditCount} expected=${CANONICAL_AUDIT_ENTRY_COUNT}`,
    );
  }

  if (CANONICAL_AUDIT_EVENT_TYPE_COUNT !== 42) {
    errors.push(`Canonical audit event type count must be 42 (got ${CANONICAL_AUDIT_EVENT_TYPE_COUNT})`);
  }
  if (CANONICAL_AUDIT_FEED_COUNT !== 14) {
    errors.push(`Canonical audit feed count must be 14 (got ${CANONICAL_AUDIT_FEED_COUNT})`);
  }
  if (CANONICAL_AUDIT_NAV_SURFACE_COUNT !== 4) {
    errors.push(`Canonical audit nav surface count must be 4 (got ${CANONICAL_AUDIT_NAV_SURFACE_COUNT})`);
  }

  return errors;
}

function compareSurfaceFields(
  errors: string[],
  contribution: AuditContribution,
  canonical: CanonicalAuditSurfaceEntry,
): void {
  if (canonical.auditKind === 'type') {
    if (contribution.auditEventTypeId !== canonical.auditEventTypeId) {
      errors.push(
        `Audit "${contribution.localId}" auditEventTypeId mismatch: manifest=${contribution.auditEventTypeId} canonical=${canonical.auditEventTypeId}`,
      );
    }
    if (contribution.categoryId !== canonical.categoryId) {
      errors.push(
        `Audit "${contribution.localId}" categoryId mismatch: manifest=${contribution.categoryId} canonical=${canonical.categoryId}`,
      );
    }
    if (contribution.severity !== canonical.severity) {
      errors.push(
        `Audit "${contribution.localId}" severity mismatch: manifest=${contribution.severity} canonical=${canonical.severity}`,
      );
    }
    if (contribution.risk !== canonical.risk) {
      errors.push(
        `Audit "${contribution.localId}" risk mismatch: manifest=${contribution.risk} canonical=${canonical.risk}`,
      );
    }
    if (contribution.action !== canonical.action) {
      errors.push(
        `Audit "${contribution.localId}" action mismatch: manifest=${contribution.action} canonical=${canonical.action}`,
      );
    }
  }

  if (canonical.auditKind === 'feed') {
    if (contribution.feedId !== canonical.feedId) {
      errors.push(
        `Audit "${contribution.localId}" feedId mismatch: manifest=${contribution.feedId} canonical=${canonical.feedId}`,
      );
    }
  }

  if (canonical.auditKind === 'surface') {
    if (contribution.surfaceId !== canonical.surfaceId) {
      errors.push(
        `Audit "${contribution.localId}" surfaceId mismatch: manifest=${contribution.surfaceId} canonical=${canonical.surfaceId}`,
      );
    }
  }
}
