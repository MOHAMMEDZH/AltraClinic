import { CANONICAL_REPORT_CATEGORIES, CANONICAL_REPORT_CATEGORY_IDS } from './canonical-report-categories';
import { CANONICAL_REPORT_HUBS, CANONICAL_REPORT_HUB_COUNT } from './canonical-report-hubs';
import { CANONICAL_REPORT_TEMPLATES, CANONICAL_REPORT_TEMPLATE_COUNT } from './canonical-report-templates';
import {
  CANONICAL_REPORT_FEATURE_IDS,
  type CanonicalReportExportFormat,
  type CanonicalReportPermissionAction,
} from './reporting-types';

const CATEGORY_IDS = new Set(CANONICAL_REPORT_CATEGORY_IDS);
const VALID_ACTIONS = new Set<CanonicalReportPermissionAction>(['view', 'create', 'export']);
const VALID_EXPORT_FORMATS = new Set<CanonicalReportExportFormat>(['pdf', 'csv', 'xlsx']);
const VALID_FEATURE_IDS = new Set<string>(CANONICAL_REPORT_FEATURE_IDS);
const VALID_HUB_IDS = new Set(['catalog', 'builder', 'export-center']);
const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;

const HUB_CATEGORY_KEYS = new Set(['platform.reporting']);

function expectedCategoryKey(categoryId: string, isHub: boolean): string {
  return isHub ? 'platform.reporting' : `reports.${categoryId}`;
}

/** Fail-closed validation of canonical reporting vocabulary (Phase 33a). */
export function validateCanonicalReportVocabulary(): string[] {
  const errors: string[] = [];

  if (CANONICAL_REPORT_CATEGORIES.length !== CANONICAL_REPORT_CATEGORY_IDS.length) {
    errors.push('Canonical report categories contain duplicate categoryId values');
  }

  const seenReportIds = new Set<string>();
  const seenDeepLinks = new Map<string, string>();

  for (const template of CANONICAL_REPORT_TEMPLATES) {
    const owner = `${template.moduleId}/reporting/${template.reportId}`;

    if (seenReportIds.has(template.reportId)) {
      errors.push(`Duplicate canonical reportId "${template.reportId}"`);
    } else {
      seenReportIds.add(template.reportId);
    }

    if (!CATEGORY_IDS.has(template.categoryId)) {
      errors.push(`Canonical template "${template.reportId}" has invalid categoryId "${template.categoryId}"`);
    }

    if (template.categoryKey !== expectedCategoryKey(template.categoryId, false)) {
      errors.push(
        `Canonical template "${template.reportId}" categoryKey mismatch: got "${template.categoryKey}" expected "${expectedCategoryKey(template.categoryId, false)}"`,
      );
    }

    if (!template.providerKey || !PROVIDER_KEY_PATTERN.test(template.providerKey)) {
      errors.push(`Canonical template "${template.reportId}" has invalid providerKey "${template.providerKey}"`);
    }

    if (!template.deepLinkTemplate.startsWith('/')) {
      errors.push(`Canonical template "${template.reportId}" deepLinkTemplate must start with "/"`);
    }

    if (template.route && !template.route.startsWith('/')) {
      errors.push(`Canonical template "${template.reportId}" route must start with "/"`);
    }

    if (!VALID_ACTIONS.has(template.permissionAction)) {
      errors.push(`Canonical template "${template.reportId}" has invalid permissionAction "${template.permissionAction}"`);
    }

    if (!template.permissionResource.startsWith('api.')) {
      errors.push(`Canonical template "${template.reportId}" permissionResource must start with "api."`);
    }

    if (template.featureId && !VALID_FEATURE_IDS.has(template.featureId)) {
      errors.push(`Canonical template "${template.reportId}" has invalid featureId "${template.featureId}"`);
    }

    if (template.delivery === 'generate' && !template.analyticsType && !template.operationalType) {
      errors.push(`Canonical template "${template.reportId}" with delivery "generate" requires analyticsType or operationalType`);
    }

    if (template.exportFormats?.length) {
      for (const format of template.exportFormats) {
        if (!VALID_EXPORT_FORMATS.has(format)) {
          errors.push(`Canonical template "${template.reportId}" has invalid exportFormat "${format}"`);
        }
      }
    }

    const priorDeepLink = seenDeepLinks.get(template.deepLinkTemplate);
    if (priorDeepLink) {
      errors.push(`Duplicate canonical deepLinkTemplate "${template.deepLinkTemplate}" (${priorDeepLink} and ${owner})`);
    } else {
      seenDeepLinks.set(template.deepLinkTemplate, owner);
    }
  }

  if (CANONICAL_REPORT_HUBS.length !== CANONICAL_REPORT_HUB_COUNT) {
    errors.push(`Canonical hub count mismatch: got ${CANONICAL_REPORT_HUBS.length} expected ${CANONICAL_REPORT_HUB_COUNT}`);
  }

  for (const hub of CANONICAL_REPORT_HUBS) {
    const owner = `${hub.moduleId}/reporting/${hub.reportId}`;

    if (hub.moduleId !== 'reporting') {
      errors.push(`Hub "${hub.reportId}" must be owned by reporting module (got "${hub.moduleId}")`);
    }

    if (!VALID_HUB_IDS.has(hub.reportId)) {
      errors.push(`Invalid hub reportId "${hub.reportId}"`);
    }

    if (seenReportIds.has(hub.reportId)) {
      errors.push(`Hub reportId "${hub.reportId}" collides with template reportId`);
    }
    seenReportIds.add(hub.reportId);

    if (!CATEGORY_IDS.has(hub.categoryId)) {
      errors.push(`Hub "${hub.reportId}" has invalid categoryId "${hub.categoryId}"`);
    }

    if (!HUB_CATEGORY_KEYS.has(hub.categoryKey)) {
      errors.push(`Hub "${hub.reportId}" must use categoryKey "platform.reporting" (got "${hub.categoryKey}")`);
    }

    if (!hub.providerKey || !PROVIDER_KEY_PATTERN.test(hub.providerKey)) {
      errors.push(`Hub "${hub.reportId}" has invalid providerKey "${hub.providerKey}"`);
    }

    if (!VALID_ACTIONS.has(hub.permissionAction)) {
      errors.push(`Hub "${hub.reportId}" has invalid permissionAction "${hub.permissionAction}"`);
    }

    const priorDeepLink = seenDeepLinks.get(hub.deepLinkTemplate);
    if (priorDeepLink) {
      errors.push(`Duplicate canonical deepLinkTemplate "${hub.deepLinkTemplate}" (${priorDeepLink} and ${owner})`);
    } else {
      seenDeepLinks.set(hub.deepLinkTemplate, owner);
    }
  }

  const expectedTotal = CANONICAL_REPORT_TEMPLATE_COUNT + CANONICAL_REPORT_HUB_COUNT;
  if (seenReportIds.size !== expectedTotal) {
    errors.push(`Canonical reportId count mismatch: got ${seenReportIds.size} expected ${expectedTotal}`);
  }

  return errors;
}
