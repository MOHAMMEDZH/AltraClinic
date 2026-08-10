/**
 * Phase 44d — Global Integrations API-key auth guard (OD-AUTHN).
 * Runs before JwtAuthGuard when registered first. Passes through when no API-key shape.
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../auth/api/decorators/public.decorator';
import { INTEGRATIONS_REQUIRED_SCOPES_KEY } from '../decorators/api-key-auth.decorator';
import { parseApiKeyFromHeaders } from '../../domain/gateway/api-key-header.parser';
import {
  INTEGRATIONS_AUTHENTICATED_REQUEST_KEY,
  INTEGRATIONS_PRINCIPAL_REQUEST_KEY,
} from '../../domain/gateway/gateway.types';
import { IntegrationsGatewayService } from '../../application/gateway/integrations-gateway.service';
import { redactCredentialSecrets } from '../../domain/credential-hashing';

@Injectable()
export class IntegrationsApiKeyAuthGuard implements CanActivate {
  private readonly logger = new Logger(IntegrationsApiKeyAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly gateway: IntegrationsGatewayService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      method?: string;
      route?: { path?: string };
      path?: string;
      url?: string;
      [key: string]: unknown;
    }>();

    const parsed = parseApiKeyFromHeaders({
      authorization: req.headers?.authorization,
      apiKey:
        req.headers?.['x-api-key'] ??
        req.headers?.['X-Api-Key'],
    });

    if (parsed.kind === 'none') {
      return true;
    }

    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(
        INTEGRATIONS_REQUIRED_SCOPES_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    const endpoint =
      req.route?.path ?? req.path ?? req.url ?? 'unknown';
    const operation = `${(req.method ?? 'GET').toUpperCase()} ${endpoint}`;
    const tenantHint =
      firstHeader(req.headers?.['x-tenant-id']) ??
      firstHeader(req.headers?.['x-tenantid']) ??
      null;
    const correlationId =
      firstHeader(req.headers?.['x-correlation-id']) ?? null;

    try {
      const principal = await this.gateway.authenticateOrThrow({
        authorization: req.headers?.authorization,
        apiKey:
          req.headers?.['x-api-key'] ?? req.headers?.['X-Api-Key'],
        tenantIdHint: tenantHint,
        requiredScopes,
        endpoint,
        operation,
        correlationId,
      });

      req[INTEGRATIONS_PRINCIPAL_REQUEST_KEY] = principal;
      req[INTEGRATIONS_AUTHENTICATED_REQUEST_KEY] = true;
      // Shape compatible with downstream tenant-aware code (not a human JWT user).
      req.user = {
        id: principal.ownerId,
        tenantId: principal.tenantId,
        roles: ['integrations_api_key'],
        integrationsPrincipal: principal,
      };
      return true;
    } catch (error) {
      this.logger.warn({
        kind: 'integrations',
        component: 'gateway_guard',
        event: 'rejected',
        message: redactCredentialSecrets(
          error instanceof Error ? error.message : 'auth failed',
        ),
      });
      throw error;
    }
  }
}

function firstHeader(
  value: string | string[] | null | undefined,
): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}
