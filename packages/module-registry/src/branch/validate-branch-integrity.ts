import type { ModuleManifest, BranchContribution } from '../types';
import { CANONICAL_BRANCH_SURFACE_COUNT, CANONICAL_BRANCH_SURFACES } from './canonical-branch-surfaces';
import { CANONICAL_BRANCH_CATEGORY_ID_SET } from './canonical-branch-categories';
import { CANONICAL_BRANCH_FEATURE_IDS } from './branch-types';
import { validateCanonicalBranchVocabulary } from './validate-canonical-branch-vocabulary';

const CANONICAL_BY_EXTENSION_ID = new Map(
  CANONICAL_BRANCH_SURFACES.map((surface) => [`${surface.moduleId}/branch/${surface.localId}`, surface]),
);

const CANONICAL_SURFACE_IDS = new Set(CANONICAL_BRANCH_SURFACES.map((surface) => surface.surfaceId));

const VALID_FEATURE_IDS = new Set<string>(CANONICAL_BRANCH_FEATURE_IDS);

const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;

const VALID_INHERITANCE_MODES = new Set(['tenant-default', 'branch-override', 'branch-only']);

const VALID_ADMIN_ACTIONS = new Set(['view', 'update', 'manage']);

export function validateBuiltinBranchIntegrity(manifests: ModuleManifest[]): string[] {
  const errors: string[] = [...validateCanonicalBranchVocabulary()];

  const seenExtensionIds = new Map<string, string>();
  const seenSurfaceIds = new Map<string, string>();
  const seenLocalIds = new Map<string, string>();
  const seenDeepLinks = new Map<string, string>();
  const seenSettingsPaths = new Map<string, string>();
  const seenProviderKeys = new Set<string>();

  let manifestBranchCount = 0;

  for (const manifest of manifests) {
    const branch = manifest.extensions.branch ?? [];
    manifestBranchCount += branch.length;

    for (const contribution of branch) {
      const owner = contribution.extensionId;

      const priorExt = seenExtensionIds.get(contribution.extensionId);
      if (priorExt) {
        errors.push(`Duplicate branch extensionId "${contribution.extensionId}" (${priorExt} and ${owner})`);
      } else {
        seenExtensionIds.set(contribution.extensionId, owner);
      }

      if (contribution.surfaceId) {
        const priorSurface = seenSurfaceIds.get(contribution.surfaceId);
        if (priorSurface) {
          errors.push(`Duplicate branchSurfaceId "${contribution.surfaceId}" (${priorSurface} and ${owner})`);
        } else {
          seenSurfaceIds.set(contribution.surfaceId, owner);
        }
      }

      if (contribution.localId) {
        const localKey = `${manifest.moduleId}/${contribution.localId}`;
        const priorLocal = seenLocalIds.get(localKey);
        if (priorLocal) {
          errors.push(`Duplicate branch localId "${contribution.localId}" (${priorLocal} and ${owner})`);
        } else {
          seenLocalIds.set(localKey, owner);
        }
      }

      if (!contribution.extensionId.startsWith(`${manifest.moduleId}/branch/`)) {
        errors.push(
          `Branch extensionId "${contribution.extensionId}" must be prefixed with ${manifest.moduleId}/branch/`,
        );
      }

      if (!contribution.moduleId) {
        errors.push(`Branch contribution ${owner} missing owning moduleId`);
      }

      if (manifest.moduleId !== contribution.moduleId) {
        errors.push(
          `Branch contribution ${owner} moduleId mismatch: manifest=${manifest.moduleId} contribution=${contribution.moduleId}`,
        );
      }

      if (!contribution.categoryId || !CANONICAL_BRANCH_CATEGORY_ID_SET.has(contribution.categoryId)) {
        errors.push(`Branch contribution ${owner} has invalid categoryId "${String(contribution.categoryId)}"`);
      }

      if (
        !contribution.configurationCategory ||
        !CANONICAL_BRANCH_CATEGORY_ID_SET.has(contribution.configurationCategory)
      ) {
        errors.push(
          `Branch contribution ${owner} has invalid configurationCategory "${String(contribution.configurationCategory)}"`,
        );
      }

      if (!contribution.inheritanceMode || !VALID_INHERITANCE_MODES.has(contribution.inheritanceMode)) {
        errors.push(
          `Branch contribution ${owner} has invalid inheritanceMode "${String(contribution.inheritanceMode)}"`,
        );
      }

      if (typeof contribution.branchScoped !== 'boolean') {
        errors.push(`Branch contribution ${owner} missing branchScoped boolean`);
      }

      if (typeof contribution.crossBranchAllowed !== 'boolean') {
        errors.push(`Branch contribution ${owner} missing crossBranchAllowed boolean`);
      }

      if (!contribution.adminAction || !VALID_ADMIN_ACTIONS.has(contribution.adminAction)) {
        errors.push(`Branch contribution ${owner} has invalid adminAction "${String(contribution.adminAction)}"`);
      }

      if (contribution.requiredFeature && !VALID_FEATURE_IDS.has(contribution.requiredFeature)) {
        errors.push(`Branch contribution ${owner} has invalid requiredFeature "${contribution.requiredFeature}"`);
      }

      if (!contribution.providerKey) {
        errors.push(`Branch contribution ${owner} missing providerKey`);
      } else {
        if (!PROVIDER_KEY_PATTERN.test(contribution.providerKey)) {
          errors.push(`Branch contribution ${owner} has invalid providerKey "${contribution.providerKey}"`);
        }
        if (contribution.providerKey !== 'branch.builtin') {
          errors.push(`Branch contribution ${owner} must use provider ownership "branch.builtin"`);
        }
        seenProviderKeys.add(contribution.providerKey);
      }

      if (!contribution.settingsPath) {
        errors.push(`Branch contribution ${owner} missing settingsPath`);
      } else {
        const priorSettingsPath = seenSettingsPaths.get(contribution.settingsPath);
        if (priorSettingsPath) {
          errors.push(`Duplicate branch settingsPath "${contribution.settingsPath}" (${priorSettingsPath} and ${owner})`);
        } else {
          seenSettingsPaths.set(contribution.settingsPath, owner);
        }
      }

      if (!contribution.deepLinkTemplate) {
        errors.push(`Branch contribution ${owner} missing deepLinkTemplate`);
      } else {
        if (!contribution.deepLinkTemplate.startsWith('/')) {
          errors.push(`Branch contribution ${owner} deepLinkTemplate must start with "/"`);
        }
        const priorDeepLink = seenDeepLinks.get(contribution.deepLinkTemplate);
        if (priorDeepLink) {
          errors.push(`Duplicate deepLinkTemplate "${contribution.deepLinkTemplate}" (${priorDeepLink} and ${owner})`);
        } else {
          seenDeepLinks.set(contribution.deepLinkTemplate, owner);
        }
      }

      if (contribution.schemaVersion !== 1) {
        errors.push(`Branch contribution ${owner} must have schemaVersion 1`);
      }

      const canonical = CANONICAL_BY_EXTENSION_ID.get(contribution.extensionId);
      if (!canonical) {
        errors.push(`Orphan branch contribution "${contribution.extensionId}" (no canonical entry)`);
        continue;
      }

      if (manifest.moduleId !== canonical.moduleId) {
        errors.push(
          `Branch "${contribution.surfaceId}" ownership mismatch: manifest=${manifest.moduleId} canonical=${canonical.moduleId}`,
        );
      }

      if (contribution.surfaceId !== canonical.surfaceId) {
        errors.push(
          `Branch "${contribution.extensionId}" surfaceId mismatch: manifest=${contribution.surfaceId} canonical=${canonical.surfaceId}`,
        );
      }

      if (contribution.surface !== canonical.surface) {
        errors.push(
          `Branch "${contribution.surfaceId}" surface kind mismatch: manifest=${contribution.surface} canonical=${canonical.surface}`,
        );
      }

      if (contribution.categoryId !== canonical.categoryId) {
        errors.push(
          `Branch "${contribution.surfaceId}" categoryId mismatch: manifest=${contribution.categoryId} canonical=${canonical.categoryId}`,
        );
      }

      if (contribution.configurationCategory !== canonical.configurationCategory) {
        errors.push(
          `Branch "${contribution.surfaceId}" configurationCategory mismatch: manifest=${contribution.configurationCategory} canonical=${canonical.configurationCategory}`,
        );
      }

      if (contribution.branchScoped !== canonical.branchScoped) {
        errors.push(
          `Branch "${contribution.surfaceId}" branchScoped mismatch: manifest=${contribution.branchScoped} canonical=${canonical.branchScoped}`,
        );
      }

      if (contribution.crossBranchAllowed !== canonical.crossBranchAllowed) {
        errors.push(
          `Branch "${contribution.surfaceId}" crossBranchAllowed mismatch: manifest=${contribution.crossBranchAllowed} canonical=${canonical.crossBranchAllowed}`,
        );
      }

      if (contribution.inheritanceMode !== canonical.inheritanceMode) {
        errors.push(
          `Branch "${contribution.surfaceId}" inheritanceMode mismatch: manifest=${contribution.inheritanceMode} canonical=${canonical.inheritanceMode}`,
        );
      }

      if (contribution.deepLinkTemplate !== canonical.deepLinkTemplate) {
        errors.push(
          `Branch "${contribution.surfaceId}" deepLinkTemplate mismatch: manifest=${contribution.deepLinkTemplate} canonical=${canonical.deepLinkTemplate}`,
        );
      }

      if ((contribution.providerKey ?? null) !== canonical.providerKey) {
        errors.push(
          `Branch "${contribution.surfaceId}" providerKey mismatch: manifest=${String(contribution.providerKey)} canonical=${canonical.providerKey}`,
        );
      }

      if ((contribution.requiredFeature ?? undefined) !== (canonical.requiredFeature ?? undefined)) {
        errors.push(
          `Branch "${contribution.surfaceId}" requiredFeature mismatch: manifest=${String(contribution.requiredFeature)} canonical=${String(canonical.requiredFeature)}`,
        );
      }
    }
  }

  if (seenProviderKeys.size !== 1 || !seenProviderKeys.has('branch.builtin')) {
    errors.push('Manifest branch contributions must use exactly one provider ownership key "branch.builtin"');
  }

  for (const surfaceId of CANONICAL_SURFACE_IDS) {
    if (!seenSurfaceIds.has(surfaceId)) {
      errors.push(`Missing branch contribution for canonical surface "${surfaceId}"`);
    }
  }

  if (manifestBranchCount !== CANONICAL_BRANCH_SURFACE_COUNT) {
    errors.push(
      `Branch contribution count mismatch: manifests=${manifestBranchCount} expected=${CANONICAL_BRANCH_SURFACE_COUNT}`,
    );
  }

  return errors;
}

export function collectManifestBranchContributions(manifests: ModuleManifest[]): BranchContribution[] {
  return manifests.flatMap((manifest) => manifest.extensions.branch ?? []);
}
