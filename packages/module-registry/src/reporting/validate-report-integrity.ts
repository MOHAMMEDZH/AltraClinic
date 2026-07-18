import type { ModuleManifest, ReportingContribution } from '../types';

import { CANONICAL_REPORT_CATEGORY_IDS } from './canonical-report-categories';

import { CANONICAL_REPORT_HUBS, CANONICAL_REPORT_HUB_COUNT } from './canonical-report-hubs';

import { CANONICAL_REPORT_TEMPLATE_COUNT, CANONICAL_REPORT_TEMPLATES } from './canonical-report-templates';

import {

  CANONICAL_REPORT_FEATURE_IDS,

  type CanonicalReportExportFormat,

  type CanonicalReportPermissionAction,

} from './reporting-types';

import { validateCanonicalReportVocabulary } from './validate-canonical-report-vocabulary';



const CATEGORY_IDS = new Set(CANONICAL_REPORT_CATEGORY_IDS);

const CANONICAL_BY_EXTENSION_ID = new Map(

  [...CANONICAL_REPORT_TEMPLATES, ...CANONICAL_REPORT_HUBS].map((t) => [

    `${t.moduleId}/reporting/${t.reportId}`,

    t,

  ]),

);

const CANONICAL_REPORT_IDS = new Set(

  [...CANONICAL_REPORT_TEMPLATES, ...CANONICAL_REPORT_HUBS].map((t) => t.reportId),

);

const HUB_REPORT_IDS = new Set(CANONICAL_REPORT_HUBS.map((hub) => hub.reportId));



const VALID_ACTIONS = new Set<CanonicalReportPermissionAction>(['view', 'create', 'export']);

const VALID_EXPORT_FORMATS = new Set<CanonicalReportExportFormat>(['pdf', 'csv', 'xlsx']);

const VALID_FEATURE_IDS = new Set<string>(CANONICAL_REPORT_FEATURE_IDS);

const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;



function normalizePermissionResources(contrib: ReportingContribution): string[] {

  if (contrib.permissionResources?.length) return [...contrib.permissionResources];

  if (contrib.permissionResource) return [contrib.permissionResource];

  if (contrib.resourceId) return [contrib.resourceId];

  return [];

}



export function validateBuiltinReportIntegrity(manifests: ModuleManifest[]): string[] {

  const errors: string[] = [...validateCanonicalReportVocabulary()];



  const seenExtensionIds = new Map<string, string>();

  const seenReportIds = new Map<string, string>();

  const seenDeepLinks = new Map<string, string>();



  let manifestReportCount = 0;



  for (const manifest of manifests) {

    const reporting = manifest.extensions.reporting ?? [];

    manifestReportCount += reporting.length;



    for (const contribution of reporting) {

      const owner = contribution.extensionId;



      const priorExt = seenExtensionIds.get(contribution.extensionId);

      if (priorExt) {

        errors.push(`Duplicate reporting extensionId "${contribution.extensionId}" (${priorExt} and ${owner})`);

      } else {

        seenExtensionIds.set(contribution.extensionId, owner);

      }



      const priorReport = seenReportIds.get(contribution.reportId);

      if (priorReport) {

        errors.push(`Duplicate reportId "${contribution.reportId}" (${priorReport} and ${owner})`);

      } else {

        seenReportIds.set(contribution.reportId, owner);

      }



      if (!contribution.extensionId.startsWith(`${manifest.moduleId}/reporting/`)) {

        errors.push(

          `Reporting extensionId "${contribution.extensionId}" must be prefixed with ${manifest.moduleId}/reporting/`,

        );

      }



      if (HUB_REPORT_IDS.has(contribution.reportId) && manifest.moduleId !== 'reporting') {

        errors.push(`Hub "${contribution.reportId}" must be declared on reporting module (found on ${manifest.moduleId})`);

      }



      if (!contribution.categoryKey) {

        errors.push(`Reporting contribution ${owner} missing categoryKey`);

      }



      const action = contribution.permissionAction;

      if (!action || !VALID_ACTIONS.has(action)) {

        errors.push(`Reporting contribution ${owner} has invalid permissionAction "${String(action)}"`);

      }



      const resources = normalizePermissionResources(contribution);

      if (!resources.length) {

        errors.push(`Reporting contribution ${owner} missing permissionResource(s)`);

      } else {

        for (const r of resources) {

          if (!r.startsWith('api.')) {

            errors.push(`Reporting contribution ${owner} has invalid permission resource "${r}" (must start with api.)`);

          }

        }

      }



      if (contribution.featureId && !VALID_FEATURE_IDS.has(contribution.featureId)) {

        errors.push(`Reporting contribution ${owner} has invalid featureId "${contribution.featureId}"`);

      }



      if (!contribution.delivery) {

        errors.push(`Reporting contribution ${owner} missing delivery`);

      } else if (contribution.delivery === 'generate' && !contribution.analyticsType && !contribution.operationalType) {

        errors.push(`Reporting contribution ${owner} with delivery "generate" requires analyticsType or operationalType`);

      }



      if (!contribution.deepLinkTemplate) {

        errors.push(`Reporting contribution ${owner} missing deepLinkTemplate`);

      } else {

        if (!contribution.deepLinkTemplate.startsWith('/')) {

          errors.push(`Reporting contribution ${owner} deepLinkTemplate must start with "/"`);

        }

        const prior = seenDeepLinks.get(contribution.deepLinkTemplate);

        if (prior) {

          errors.push(`Duplicate deepLinkTemplate "${contribution.deepLinkTemplate}" (${prior} and ${owner})`);

        } else {

          seenDeepLinks.set(contribution.deepLinkTemplate, owner);

        }

      }



      if (contribution.route && !contribution.route.startsWith('/')) {

        errors.push(`Reporting contribution ${owner} has invalid route "${contribution.route}" (must start with "/")`);

      }



      if (!contribution.providerKey) {

        errors.push(`Reporting contribution ${owner} missing providerKey`);

      } else if (!PROVIDER_KEY_PATTERN.test(contribution.providerKey)) {

        errors.push(`Reporting contribution ${owner} has invalid providerKey "${contribution.providerKey}"`);

      }



      if (contribution.exportFormats?.length) {

        for (const f of contribution.exportFormats) {

          if (!VALID_EXPORT_FORMATS.has(f)) {

            errors.push(`Reporting contribution ${owner} has invalid exportFormat "${String(f)}"`);

          }

        }

      }



      const canonical = CANONICAL_BY_EXTENSION_ID.get(contribution.extensionId);

      if (!canonical) {

        errors.push(`Orphan reporting contribution "${contribution.extensionId}" (no canonical entry)`);

        continue;

      }



      if (manifest.moduleId !== canonical.moduleId) {

        errors.push(

          `Report "${contribution.reportId}" ownership mismatch: manifest=${manifest.moduleId} canonical=${canonical.moduleId}`,

        );

      }



      if (!CATEGORY_IDS.has(canonical.categoryId)) {

        errors.push(`Report "${contribution.reportId}" references invalid canonical categoryId "${canonical.categoryId}"`);

      }



      if (contribution.categoryKey !== canonical.categoryKey) {

        errors.push(

          `Report "${contribution.reportId}" categoryKey mismatch: manifest=${contribution.categoryKey} canonical=${canonical.categoryKey}`,

        );

      }

      if (contribution.dataDomain !== canonical.dataDomain) {

        errors.push(

          `Report "${contribution.reportId}" dataDomain mismatch: manifest=${contribution.dataDomain} canonical=${canonical.dataDomain}`,

        );

      }

      if (contribution.permissionAction !== canonical.permissionAction) {

        errors.push(

          `Report "${contribution.reportId}" permissionAction mismatch: manifest=${contribution.permissionAction} canonical=${canonical.permissionAction}`,

        );

      }

      if (contribution.permissionResource !== canonical.permissionResource && contribution.resourceId !== canonical.permissionResource) {

        errors.push(

          `Report "${contribution.reportId}" permissionResource mismatch: manifest=${contribution.permissionResource ?? contribution.resourceId} canonical=${canonical.permissionResource}`,

        );

      }

      if (contribution.deepLinkTemplate !== canonical.deepLinkTemplate) {

        errors.push(

          `Report "${contribution.reportId}" deepLinkTemplate mismatch: manifest=${contribution.deepLinkTemplate} canonical=${canonical.deepLinkTemplate}`,

        );

      }

      if ((contribution.route ?? null) !== (canonical.route ?? null)) {

        errors.push(

          `Report "${contribution.reportId}" route mismatch: manifest=${contribution.route ?? 'null'} canonical=${canonical.route ?? 'null'}`,

        );

      }

      if ((contribution.delivery ?? null) !== (canonical.delivery ?? null)) {

        errors.push(

          `Report "${contribution.reportId}" delivery mismatch: manifest=${contribution.delivery ?? 'null'} canonical=${canonical.delivery ?? 'null'}`,

        );

      }

      if ((contribution.analyticsType ?? null) !== (canonical.analyticsType ?? null)) {

        errors.push(

          `Report "${contribution.reportId}" analyticsType mismatch: manifest=${contribution.analyticsType ?? 'null'} canonical=${canonical.analyticsType ?? 'null'}`,

        );

      }

      if ((contribution.featureId ?? null) !== (canonical.featureId ?? null)) {

        errors.push(

          `Report "${contribution.reportId}" featureId mismatch: manifest=${contribution.featureId ?? 'null'} canonical=${canonical.featureId ?? 'null'}`,

        );

      }

      if ((contribution.providerKey ?? null) !== (canonical.providerKey ?? null)) {

        errors.push(

          `Report "${contribution.reportId}" providerKey mismatch: manifest=${contribution.providerKey ?? 'null'} canonical=${canonical.providerKey ?? 'null'}`,

        );

      }

    }

  }



  for (const reportId of CANONICAL_REPORT_IDS) {

    if (!seenReportIds.has(reportId)) {

      errors.push(`Missing reporting contribution for canonical report "${reportId}"`);

    }

  }



  if (CATEGORY_IDS.size !== CANONICAL_REPORT_CATEGORY_IDS.length) {

    errors.push('Canonical report category IDs contain duplicates');

  }



  const expectedCount = CANONICAL_REPORT_TEMPLATE_COUNT + CANONICAL_REPORT_HUB_COUNT;

  if (manifestReportCount !== expectedCount) {

    errors.push(`Reporting contribution count mismatch: manifests=${manifestReportCount} expected=${expectedCount}`);

  }



  return errors;

}


