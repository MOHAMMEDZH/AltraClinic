import type { AuditContribution, ModuleManifest } from '../types';
import {
  collectManifestAuditContributions,
  validateBuiltinAuditIntegrity,
} from './validate-audit-integrity';
import { validateCanonicalAuditVocabulary } from './validate-canonical-audit-vocabulary';
import {
  validateStaticAuditCatalogParity,
  type StaticAuditCatalogEntryLike,
} from './validate-static-audit-catalog-parity';

function compareManifestToStaticCatalog(
  contributions: AuditContribution[],
  entries: readonly StaticAuditCatalogEntryLike[],
): string[] {
  const errors: string[] = [];
  const staticByExtensionId = new Map(entries.map((entry) => [entry.extensionId, entry]));

  if (contributions.length !== entries.length) {
    errors.push(
      `Manifest/static catalog count mismatch: manifest=${contributions.length} static=${entries.length}`,
    );
  }

  for (const contribution of contributions) {
    const staticEntry = staticByExtensionId.get(contribution.extensionId);
    if (!staticEntry) {
      errors.push(`Manifest contribution "${contribution.extensionId}" missing from static catalog`);
      continue;
    }

    if (contribution.auditKind !== staticEntry.auditKind) {
      errors.push(
        `Manifest/static auditKind mismatch for "${contribution.extensionId}": manifest=${contribution.auditKind} static=${staticEntry.auditKind}`,
      );
    }

    if (contribution.deepLinkTemplate !== staticEntry.deepLinkTemplate) {
      errors.push(
        `Manifest/static deepLinkTemplate mismatch for "${contribution.extensionId}"`,
      );
    }

    if ((contribution.providerKey ?? null) !== staticEntry.providerKey) {
      errors.push(
        `Manifest/static providerKey mismatch for "${contribution.extensionId}"`,
      );
    }

    if (contribution.auditKind === 'type') {
      if ((contribution.auditEventTypeId ?? null) !== (staticEntry.auditEventTypeId ?? null)) {
        errors.push(`Manifest/static auditEventTypeId mismatch for "${contribution.extensionId}"`);
      }
      if ((contribution.retentionPolicyId ?? null) !== (staticEntry.retentionPolicyId ?? null)) {
        errors.push(`Manifest/static retentionPolicyId mismatch for "${contribution.extensionId}"`);
      }
    }
  }

  return errors;
}

/**
 * End-to-end audit layer parity:
 * Canonical Vocabulary → Manifest Contributions → STATIC_AUDIT_CATALOG.
 */
export function validateAuditLayerParity(
  manifests: ModuleManifest[],
  staticCatalogEntries: readonly StaticAuditCatalogEntryLike[],
): string[] {
  const errors: string[] = [];

  errors.push(...validateCanonicalAuditVocabulary());
  errors.push(...validateBuiltinAuditIntegrity(manifests));
  errors.push(...validateStaticAuditCatalogParity(staticCatalogEntries));

  const contributions = collectManifestAuditContributions(manifests);
  errors.push(...compareManifestToStaticCatalog(contributions, staticCatalogEntries));

  return errors;
}
