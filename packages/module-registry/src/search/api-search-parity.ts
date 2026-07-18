/**
 * API search.types.ts parity reference — used by integrity tests only in Phase 32a/32c.
 * Backend `SEARCH_ENTITY_URLS` remains authoritative for API response `url` fields.
 * Client navigation uses registry/catalog `deepLinkTemplate` via `deepLinkByEntityType`.
 * Full URL codegen sync is deferred to Phase 33 (requires coordinated API + client release).
 */
import {
  CANONICAL_SEARCH_ENTITIES,
  listCanonicalPermissionResources,
  type CanonicalSearchEntityType,
} from './canonical-search-entities';

export const API_SEARCH_ENTITY_PARITY: Record<
  CanonicalSearchEntityType,
  { permissionResources: string[]; deepLinkTemplate: string }
> = Object.fromEntries(
  CANONICAL_SEARCH_ENTITIES.map((entity) => [
    entity.entityType,
    {
      permissionResources: listCanonicalPermissionResources(entity.entityType),
      deepLinkTemplate: entity.deepLinkTemplate,
    },
  ]),
) as Record<
  CanonicalSearchEntityType,
  { permissionResources: string[]; deepLinkTemplate: string }
>;

/** Expected API permission resources from apps/api search.types.ts (read-only parity). */
const API_EXPECTED_PERMISSIONS: Record<string, string | string[]> = {
  user: 'api.identity',
  patient: 'api.patients',
  appointment: 'api.scheduling',
  diagnosis: 'api.emr',
  treatment: ['api.dental', 'api.beauty'],
  invoice: 'api.billing',
  inventory: 'api.inventory',
  report: 'api.reporting',
  lab_result: 'api.emr',
  care_plan: 'api.emr',
  note_template: 'api.emr',
  problem: 'api.emr',
  encounter: 'api.emr',
  dental_plan: 'api.dental',
  dental_ortho: 'api.dental',
  dental_implant: 'api.dental',
  dental_note: 'api.dental',
  dental_image: 'api.media',
  beauty_plan: 'api.beauty',
  beauty_session: 'api.beauty',
  beauty_consultation: 'api.beauty',
  beauty_image: 'api.media',
  notification: 'api.notifications',
  workflow: 'api.workflow',
  workflow_task: 'api.workflow',
  workflow_template: 'api.workflow',
};

function normalizeResources(value: string | string[]): string[] {
  return (Array.isArray(value) ? value : [value]).slice().sort();
}

export function assertApiSearchEntityParity(): string[] {
  const errors: string[] = [];

  for (const entity of CANONICAL_SEARCH_ENTITIES) {
    const expected = API_EXPECTED_PERMISSIONS[entity.entityType];
    if (!expected) {
      errors.push(`Missing API permission parity entry for ${entity.entityType}`);
      continue;
    }

    const canonical = normalizeResources(entity.resourceId).join(',');
    const api = normalizeResources(expected).join(',');
    if (canonical !== api) {
      errors.push(
        `Permission mismatch for ${entity.entityType}: canonical=[${canonical}] api=[${api}]`,
      );
    }
  }

  return errors;
}
