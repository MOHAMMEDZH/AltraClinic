import type { ModuleManifest, WhiteLabelContribution } from '../types';
import { CANONICAL_WHITE_LABEL_SURFACES, CANONICAL_WHITE_LABEL_SURFACE_COUNT } from './canonical-surface-slots';
import { CANONICAL_WHITE_LABEL_FEATURE_IDS } from './white-label-types';
import { validateCanonicalWhiteLabelVocabulary } from './validate-canonical-white-label-vocabulary';

const CANONICAL_BY_EXTENSION_ID = new Map(
  CANONICAL_WHITE_LABEL_SURFACES.map((surface) => [`${surface.moduleId}/whiteLabel/${surface.localId}`, surface]),
);

const CANONICAL_SURFACE_IDS = new Set(CANONICAL_WHITE_LABEL_SURFACES.map((surface) => surface.surfaceId));

const VALID_FEATURE_IDS = new Set<string>(CANONICAL_WHITE_LABEL_FEATURE_IDS);

const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;

const VALID_SURFACES = new Set(CANONICAL_WHITE_LABEL_SURFACES.map((surface) => surface.surface));

export function validateBuiltinWhiteLabelIntegrity(manifests: ModuleManifest[]): string[] {
  const errors: string[] = [...validateCanonicalWhiteLabelVocabulary()];

  const seenExtensionIds = new Map<string, string>();
  const seenSurfaceIds = new Map<string, string>();
  const seenLocalIds = new Map<string, string>();
  const seenDeepLinks = new Map<string, string>();
  const seenRoutes = new Map<string, string>();

  let manifestWhiteLabelCount = 0;

  for (const manifest of manifests) {
    const whiteLabel = manifest.extensions.whiteLabel ?? [];
    manifestWhiteLabelCount += whiteLabel.length;

    for (const contribution of whiteLabel) {
      const owner = contribution.extensionId;

      const priorExt = seenExtensionIds.get(contribution.extensionId);
      if (priorExt) {
        errors.push(`Duplicate whiteLabel extensionId "${contribution.extensionId}" (${priorExt} and ${owner})`);
      } else {
        seenExtensionIds.set(contribution.extensionId, owner);
      }

      if (contribution.surfaceId) {
        const priorSurface = seenSurfaceIds.get(contribution.surfaceId);
        if (priorSurface) {
          errors.push(`Duplicate surfaceId "${contribution.surfaceId}" (${priorSurface} and ${owner})`);
        } else {
          seenSurfaceIds.set(contribution.surfaceId, owner);
        }
      }

      if (contribution.localId) {
        const localKey = `${manifest.moduleId}/${contribution.localId}`;
        const priorLocal = seenLocalIds.get(localKey);
        if (priorLocal) {
          errors.push(`Duplicate whiteLabel localId "${contribution.localId}" (${priorLocal} and ${owner})`);
        } else {
          seenLocalIds.set(localKey, owner);
        }
      }

      if (!contribution.extensionId.startsWith(`${manifest.moduleId}/whiteLabel/`)) {
        errors.push(
          `WhiteLabel extensionId "${contribution.extensionId}" must be prefixed with ${manifest.moduleId}/whiteLabel/`,
        );
      }

      if (!contribution.surface || !VALID_SURFACES.has(contribution.surface)) {
        errors.push(`WhiteLabel contribution ${owner} has invalid surface "${String(contribution.surface)}"`);
      }

      if (!contribution.requiredFeature || !VALID_FEATURE_IDS.has(contribution.requiredFeature)) {
        errors.push(`WhiteLabel contribution ${owner} has invalid requiredFeature "${String(contribution.requiredFeature)}"`);
      }

      if (!contribution.providerKey) {
        errors.push(`WhiteLabel contribution ${owner} missing providerKey`);
      } else if (!PROVIDER_KEY_PATTERN.test(contribution.providerKey)) {
        errors.push(`WhiteLabel contribution ${owner} has invalid providerKey "${contribution.providerKey}"`);
      }

      if (!contribution.deepLinkTemplate) {
        errors.push(`WhiteLabel contribution ${owner} missing deepLinkTemplate`);
      } else {
        if (!contribution.deepLinkTemplate.startsWith('/')) {
          errors.push(`WhiteLabel contribution ${owner} deepLinkTemplate must start with "/"`);
        }
        const priorDeepLink = seenDeepLinks.get(contribution.deepLinkTemplate);
        if (priorDeepLink) {
          errors.push(`Duplicate deepLinkTemplate "${contribution.deepLinkTemplate}" (${priorDeepLink} and ${owner})`);
        } else {
          seenDeepLinks.set(contribution.deepLinkTemplate, owner);
        }
      }

      if (contribution.settingsPath) {
        const routeBase = contribution.settingsPath.split('#')[0] ?? contribution.settingsPath;
        const priorRoute = seenRoutes.get(routeBase);
        if (priorRoute && priorRoute !== owner) {
          // multiple surfaces may share /settings/branding with different hash anchors — allowed
        } else if (!priorRoute) {
          seenRoutes.set(routeBase, owner);
        }
      }

      if (contribution.schemaVersion !== 1) {
        errors.push(`WhiteLabel contribution ${owner} must have schemaVersion 1`);
      }

      const canonical = CANONICAL_BY_EXTENSION_ID.get(contribution.extensionId);
      if (!canonical) {
        errors.push(`Orphan whiteLabel contribution "${contribution.extensionId}" (no canonical entry)`);
        continue;
      }

      if (manifest.moduleId !== canonical.moduleId) {
        errors.push(
          `WhiteLabel "${contribution.surfaceId}" ownership mismatch: manifest=${manifest.moduleId} canonical=${canonical.moduleId}`,
        );
      }

      if (contribution.surfaceId !== canonical.surfaceId) {
        errors.push(
          `WhiteLabel "${contribution.extensionId}" surfaceId mismatch: manifest=${contribution.surfaceId} canonical=${canonical.surfaceId}`,
        );
      }

      if (contribution.surface !== canonical.surface) {
        errors.push(
          `WhiteLabel "${contribution.surfaceId}" surface kind mismatch: manifest=${contribution.surface} canonical=${canonical.surface}`,
        );
      }

      if (contribution.requiredFeature !== canonical.requiredFeature) {
        errors.push(
          `WhiteLabel "${contribution.surfaceId}" requiredFeature mismatch: manifest=${contribution.requiredFeature} canonical=${canonical.requiredFeature}`,
        );
      }

      if (contribution.deepLinkTemplate !== canonical.deepLinkTemplate) {
        errors.push(
          `WhiteLabel "${contribution.surfaceId}" deepLinkTemplate mismatch: manifest=${contribution.deepLinkTemplate} canonical=${canonical.deepLinkTemplate}`,
        );
      }

      if ((contribution.providerKey ?? null) !== canonical.providerKey) {
        errors.push(
          `WhiteLabel "${contribution.surfaceId}" providerKey mismatch: manifest=${String(contribution.providerKey)} canonical=${canonical.providerKey}`,
        );
      }
    }
  }

  for (const surfaceId of CANONICAL_SURFACE_IDS) {
    if (!seenSurfaceIds.has(surfaceId)) {
      errors.push(`Missing whiteLabel contribution for canonical surface "${surfaceId}"`);
    }
  }

  if (manifestWhiteLabelCount !== CANONICAL_WHITE_LABEL_SURFACE_COUNT) {
    errors.push(
      `WhiteLabel contribution count mismatch: manifests=${manifestWhiteLabelCount} expected=${CANONICAL_WHITE_LABEL_SURFACE_COUNT}`,
    );
  }

  return errors;
}

export function collectManifestWhiteLabelContributions(manifests: ModuleManifest[]): WhiteLabelContribution[] {
  return manifests.flatMap((manifest) => manifest.extensions.whiteLabel ?? []);
}
