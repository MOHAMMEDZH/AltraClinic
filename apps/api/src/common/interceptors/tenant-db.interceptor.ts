import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom } from 'rxjs';
import { IS_PUBLIC_KEY } from '../../modules/auth/api/decorators/public.decorator';
import { PrismaService } from '../../infrastructure/prisma.service';
import { TenantDbContextService } from '../../infrastructure/tenant-db-context.service';
import { requireTenantScope } from '../tenant-scope.util';

/**
 * Establishes trusted tenant DB context for the request lifecycle.
 * Wraps the handler in a Prisma transaction with PostgreSQL RLS session variables set.
 */
@Injectable()
export class TenantDbInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDbContext: TenantDbContextService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, unknown>;
      path?: string;
      url?: string;
    }>();

    const path = String(request.path ?? request.url ?? '');
    if (path.startsWith('/platform-admin') || path.startsWith('/auth')) {
      return next.handle();
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!request?.headers) {
      return next.handle();
    }

    const hasTenantHeader = Boolean(
      String(request.headers['x-tenant-id'] ?? request.headers['tenant-id'] ?? '').trim(),
    );

    if (isPublic && !hasTenantHeader) {
      return next.handle();
    }

    try {
      const { tenantId } = requireTenantScope(request);

      return from(
        this.prisma.withTenantContext(tenantId, async (tx) =>
          this.tenantDbContext.runWithTransactionAsync(tenantId, tx as never, () =>
            lastValueFrom(next.handle()),
          ),
        ),
      );
    } catch (err) {
      if (err instanceof ForbiddenException) {
        throw err;
      }
      return next.handle();
    }
  }
}
