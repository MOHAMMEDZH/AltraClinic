import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';
import { PlatformAuthorizationService } from '../../platform-rbac/platform-authorization.service';
import { PLATFORM_PERMISSION_KEY } from '../decorators/require-platform-permission.decorator';

@Injectable()
export class PlatformPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly authorization: PlatformAuthorizationService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<string>(PLATFORM_PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!key) return true;
    const claims = context.switchToHttp().getRequest<{ user?: JwtClaimsVO }>().user;
    if (!claims?.isPlatformSession()) throw new UnauthorizedException('Platform authentication required.');
    await this.authorization.assertPermission(claims, key);
    return true;
  }
}
