import { SetMetadata } from '@nestjs/common';

/** Required API-key scopes for a route (deny unknown / missing). */
export const INTEGRATIONS_REQUIRED_SCOPES_KEY = 'integrationsRequiredScopes';

export const RequireApiKeyScopes = (...scopes: string[]) =>
  SetMetadata(INTEGRATIONS_REQUIRED_SCOPES_KEY, scopes);

/** Opt-in: route accepts Integrations API-key auth (also detected by header shape). */
export const INTEGRATIONS_API_KEY_AUTH_KEY = 'integrationsApiKeyAuth';

export const ApiKeyAuth = () => SetMetadata(INTEGRATIONS_API_KEY_AUTH_KEY, true);
