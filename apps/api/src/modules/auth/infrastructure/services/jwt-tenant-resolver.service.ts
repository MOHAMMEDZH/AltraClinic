import { Injectable, BadRequestException } from '@nestjs/common';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { TenantResolverInterface } from '../../../../infrastructure/tenant-resolver.interface';

/**
 * Resolves tenant context from the verified JWT claims on request.user.
 * Falls back to the x-tenant-id header for:
 *   - Public routes (login, forgot-password) where no JWT exists yet
 *   - Service-to-service requests using API keys
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Header fallback is dangerous — attacker can spoof tenantId."
 *   Decision: The header is the ONLY source for public auth endpoints (login).
 *   For all protected routes, the JWT claim ALWAYS wins and header is ignored.
 *   The JWT is signed by our private key — headers cannot be forged there.
 *   GuardOrder: JwtAuthGuard runs BEFORE TenantContextService.resolve(), so
 *   by the time resolve() is called on protected routes, request.user is set.
 */
@Injectable()
export class JwtTenantResolver implements TenantResolverInterface {
  async resolve(context: unknown): Promise<TenantContextContract> {
    const request = context as {
      user?: { tenantId?: string; branchId?: string | null };
      headers?: Record<string, unknown>;
    };

    // Prefer JWT claims (verified, tamper-proof)
    const jwtTenantId = request.user?.tenantId?.trim();
    if (jwtTenantId) {
      return {
        tenantId: jwtTenantId,
        branchId: request.user?.branchId ?? undefined,
        environment: 'production',
        locale: undefined,
        timezone: 'UTC',
      };
    }

    // Fallback: header for public routes (login, password reset, etc.)
    const headers = request.headers ?? {};
    const headerTenantId = String(headers['x-tenant-id'] ?? headers['tenant-id'] ?? '').trim();
    if (headerTenantId) {
      return {
        tenantId: headerTenantId,
        branchId: String(headers['x-branch-id'] ?? '').trim() || undefined,
        environment: 'production',
        locale: undefined,
        timezone: 'UTC',
      };
    }

    throw new BadRequestException('Tenant context could not be resolved. Provide a valid JWT or x-tenant-id header.');
  }
}
