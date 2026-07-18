import type { ModuleManifest, ReportingContribution } from '../types';
import { validateCanonicalReportVocabulary } from './validate-canonical-report-vocabulary';
import { validateBuiltinReportIntegrity } from './validate-report-integrity';
import {
  validateStaticReportCatalogParity,
  type StaticReportCatalogEntryLike,
} from './validate-static-report-catalog-parity';

function collectManifestReportingContributions(manifests: ModuleManifest[]): ReportingContribution[] {
  return manifests.flatMap((manifest) => manifest.extensions.reporting ?? []);
}

function compareManifestToStaticCatalog(
  contributions: ReportingContribution[],
  entries: StaticReportCatalogEntryLike[],
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

    if (contribution.reportId !== staticEntry.reportId) {
      errors.push(
        `Manifest/static reportId mismatch for "${contribution.extensionId}": manifest=${contribution.reportId} static=${staticEntry.reportId}`,
      );
    }

    if (contribution.categoryKey !== staticEntry.categoryKey) {
      errors.push(
        `Manifest/static categoryKey mismatch for "${contribution.reportId}": manifest=${contribution.categoryKey} static=${staticEntry.categoryKey}`,
      );
    }

    if ((contribution.delivery ?? null) !== staticEntry.delivery) {
      errors.push(
        `Manifest/static delivery mismatch for "${contribution.reportId}": manifest=${String(contribution.delivery ?? 'null')} static=${staticEntry.delivery}`,
      );
    }

    if (contribution.deepLinkTemplate !== staticEntry.deepLinkTemplate) {
      errors.push(
        `Manifest/static deepLinkTemplate mismatch for "${contribution.reportId}": manifest=${contribution.deepLinkTemplate} static=${staticEntry.deepLinkTemplate}`,
      );
    }

    if ((contribution.permissionAction ?? null) !== staticEntry.permissionAction) {
      errors.push(
        `Manifest/static permissionAction mismatch for "${contribution.reportId}": manifest=${String(contribution.permissionAction ?? 'null')} static=${staticEntry.permissionAction}`,
      );
    }

    if ((contribution.providerKey ?? null) !== staticEntry.providerKey) {
      errors.push(
        `Manifest/static providerKey mismatch for "${contribution.reportId}": manifest=${String(contribution.providerKey ?? 'null')} static=${staticEntry.providerKey}`,
      );
    }
  }

  return errors;
}

/**
 * End-to-end reporting layer parity:
 * canonical vocabulary → manifest contributions → static catalog.
 */
export function validateReportingLayerParity(
  manifests: ModuleManifest[],
  staticCatalogEntries: StaticReportCatalogEntryLike[],
): string[] {
  const errors: string[] = [];

  errors.push(...validateCanonicalReportVocabulary());
  errors.push(...validateBuiltinReportIntegrity(manifests));
  errors.push(...validateStaticReportCatalogParity(staticCatalogEntries));

  const contributions = collectManifestReportingContributions(manifests);
  errors.push(...compareManifestToStaticCatalog(contributions, staticCatalogEntries));

  return errors;
}
