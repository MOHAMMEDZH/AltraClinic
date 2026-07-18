export interface SearchHitNavigationInput {
  type: string;
  id: string;
  url?: string;
  metadata?: Record<string, string>;
}

const TEMPLATE_PLACEHOLDER = /\{([a-zA-Z]+)\}/g;

/** Substitutes `{id}`, `{patientId}`, etc. from hit id segments and API metadata. */
export function applyDeepLinkTemplate(
  template: string,
  hit: Pick<SearchHitNavigationInput, 'id' | 'metadata'>,
): string {
  const tokens: Record<string, string> = { id: hit.id };

  if (hit.id.includes(':')) {
    const [patientId, secondaryId] = hit.id.split(':');
    if (patientId) tokens.patientId = patientId;
    if (secondaryId) {
      tokens.planId = secondaryId;
      tokens.sessionId = secondaryId;
    }
  }

  if (hit.metadata) {
    for (const [key, value] of Object.entries(hit.metadata)) {
      if (value) tokens[key] = value;
    }
  }

  return template.replace(TEMPLATE_PLACEHOLDER, (_, name: string) => tokens[name] ?? '');
}

/**
 * Resolves navigation URL for a search hit.
 * Prefers API-provided `url`, then registry/catalog `deepLinkByEntityType` templates.
 */
export function resolveSearchHitUrl(
  hit: SearchHitNavigationInput,
  deepLinkByEntityType: Record<string, string>,
): string | null {
  if (hit.url) return hit.url;

  const template = deepLinkByEntityType[hit.type];
  if (!template) return null;

  return applyDeepLinkTemplate(template, hit);
}
