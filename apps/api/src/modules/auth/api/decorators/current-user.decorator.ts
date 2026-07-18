import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';

/**
 * Extracts the verified JWT claims from the request.
 * Usage: @CurrentUser() user: JwtClaimsVO
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtClaimsVO => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtClaimsVO;
  },
);
