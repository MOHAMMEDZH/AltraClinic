import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { PlatformAuthRoute } from './decorators/platform-auth-route.decorator';
import { RequirePlatformPermission } from './decorators/require-platform-permission.decorator';
import { PlatformPermissionGuard } from './guards/platform-permission.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtClaimsVO } from '../domain/value-objects/jwt-claims.vo';
import { PlatformMfaResetRepository } from '../infrastructure/repositories/prisma-platform-rbac.repositories';
import { PlatformAssuranceService } from '../application/services/platform-assurance.service';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../platform-auth.tokens';
import { PlatformRefreshTokenRepository } from '../domain/repositories/platform-refresh-token.repository.interface';
import { PlatformMfaResetDecisionService } from '../application/services/platform-mfa-reset-decision.service';
import { mapPlatformMfaResetRequest } from '../platform-rbac/platform-response.mappers';

@Controller('platform/mfa-reset-requests')
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class PlatformMfaResetController {
  constructor(
    private readonly resets: PlatformMfaResetRepository,
    private readonly decisions: PlatformMfaResetDecisionService,
    private readonly assurance: PlatformAssuranceService,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY) private readonly refreshes: PlatformRefreshTokenRepository,
  ) {}

  private async stepUp(c: JwtClaimsVO) {
    const s = await this.refreshes.findBySessionId(c.sessionId);
    if (!s) throw new ForbiddenException();
    this.assurance.requireStepUp(s);
  }

  @Post(':requestId/approve')
  @RequirePlatformPermission('platform-user.mfa.reset-approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @CurrentUser() c: JwtClaimsVO,
    @Param('requestId') id: string,
    @Body() b: { reason?: string },
  ) {
    await this.stepUp(c);
    const updated = await this.decisions.approve(id, c.sub, b.reason);
    return mapPlatformMfaResetRequest(updated);
  }

  @Post(':requestId/reject')
  @RequirePlatformPermission('platform-user.mfa.reset-approve')
  @HttpCode(HttpStatus.OK)
  async reject(
    @CurrentUser() c: JwtClaimsVO,
    @Param('requestId') id: string,
    @Body() b: { reason?: string },
  ) {
    await this.stepUp(c);
    const updated = await this.decisions.reject(id, c.sub, b.reason);
    return mapPlatformMfaResetRequest(updated);
  }
}
