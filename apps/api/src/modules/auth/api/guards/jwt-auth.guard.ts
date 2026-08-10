import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_PLATFORM_AUTH_ROUTE_KEY } from '../decorators/platform-auth-route.decorator';
import {
  INTEGRATIONS_AUTHENTICATED_REQUEST_KEY,
} from '../../../integrations/domain/gateway/gateway.types';
import { parseApiKeyFromHeaders } from '../../../integrations/domain/gateway/api-key-header.parser';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';

/**
 * Global JWT authentication guard.
 * - Skips routes decorated with @Public()
 * - Skips when Integrations API-key auth already succeeded (Phase 44d OD-AUTHN)
 * - Enforces platform vs tenant/patient audience boundary (Phase 47 Step 06)
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
      [key: string]: unknown;
    }>();

    if (req[INTEGRATIONS_AUTHENTICATED_REQUEST_KEY] === true) {
      return true;
    }

    const parsed = parseApiKeyFromHeaders({
      authorization: req.headers?.authorization,
      apiKey: req.headers?.['x-api-key'] ?? req.headers?.['X-Api-Key'],
    });
    if (parsed.kind === 'parsed' || parsed.kind === 'reject') {
      throw new UnauthorizedException(
        'API key authentication required. Provide a valid Integrations API key.',
      );
    }

    return super.canActivate(context);
  }

  handleRequest<T>(err: Error | null, user: T, _info: unknown, context: ExecutionContext): T {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Authentication required. Provide a valid Bearer token.');
    }

    const claims = user as unknown as JwtClaimsVO;
    const isPlatformRoute = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM_AUTH_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (claims.isPlatformSession()) {
      if (!isPlatformRoute) {
        throw new UnauthorizedException({
          code: 'PLATFORM_TOKEN_REJECTED_ON_TENANT_API',
          message: 'Platform tokens cannot access tenant or patient APIs.',
        });
      }
    } else if (isPlatformRoute) {
      throw new UnauthorizedException({
        code: 'PLATFORM_PRINCIPAL_REQUIRED',
        message: 'Platform authentication required.',
      });
    }

    return user;
  }
}
