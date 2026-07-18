import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { IS_PUBLIC_KEY } from '../../../auth/api/decorators/public.decorator';
import { ApiRateLimitService } from '../../application/services/api-rate-limit.service';

/**
 * HTTP edge rate limiting — runs after JWT auth, before controller handlers.
 * Skips health/metrics paths.
 */
@Injectable()
export class ApiRateLimitGuard implements CanActivate {
  private readonly skipPaths = new Set(['/health', '/metrics', '/']);

  constructor(
    private readonly rateLimit: ApiRateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const path = (request.path ?? request.url ?? '').split('?')[0];

    if (this.skipPaths.has(path)) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic && !path.startsWith('/auth')) {
      return true;
    }

    const result = await this.rateLimit.enforce(request);
    this.rateLimit.applyHeaders(response, result);
    return true;
  }
}
