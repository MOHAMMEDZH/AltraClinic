import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { PlatformAuthRoute } from './decorators/platform-auth-route.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtClaimsVO } from '../domain/value-objects/jwt-claims.vo';
import { PlatformMfaReplaceConfirmDto, PlatformStepUpVerifyDto } from './dto/platform-auth.dto';
import { PlatformMfaStatusHandler } from '../application/handlers/platform-mfa-status.handler';
import { PlatformMfaRegenerateRecoveryCodesHandler } from '../application/handlers/platform-mfa-regenerate-recovery-codes.handler';
import { PlatformMfaBeginReplaceHandler } from '../application/handlers/platform-mfa-begin-replace.handler';
import { PlatformMfaConfirmReplaceHandler } from '../application/handlers/platform-mfa-confirm-replace.handler';
import { PlatformListSessionsHandler } from '../application/handlers/platform-list-sessions.handler';
import { PlatformRevokeSessionHandler } from '../application/handlers/platform-revoke-session.handler';
import { PlatformRevokeOtherSessionsHandler } from '../application/handlers/platform-revoke-other-sessions.handler';
import { PlatformRevokeAllSessionsHandler } from '../application/handlers/platform-revoke-all-sessions.handler';
import { PlatformStepUpVerifyHandler } from '../application/handlers/platform-step-up-verify.handler';
import { PlatformStepUpStatusHandler } from '../application/handlers/platform-step-up-status.handler';
import { PlatformActivityHandler } from '../application/handlers/platform-activity.handler';
import { clearPlatformCsrfCookie, clearPlatformRefreshCookie } from './platform-auth-cookies';

/**
 * Phase 47 Step 07 — authenticated platform MFA/session/step-up management.
 * Every route requires a valid platform access token (@PlatformAuthRoute);
 * sensitive mutations additionally require a fresh step-up verification,
 * enforced inside each handler via PlatformAssuranceService.
 *
 * Passive endpoints (sessions list, step-up status, activity status reads) must
 * never extend interactive idle activity. Only POST /activity does that.
 */
@Controller('platform/auth')
export class PlatformSecurityController {
  constructor(
    private readonly mfaStatusHandler: PlatformMfaStatusHandler,
    private readonly regenerateRecoveryCodesHandler: PlatformMfaRegenerateRecoveryCodesHandler,
    private readonly mfaBeginReplaceHandler: PlatformMfaBeginReplaceHandler,
    private readonly mfaConfirmReplaceHandler: PlatformMfaConfirmReplaceHandler,
    private readonly listSessionsHandler: PlatformListSessionsHandler,
    private readonly revokeSessionHandler: PlatformRevokeSessionHandler,
    private readonly revokeOtherSessionsHandler: PlatformRevokeOtherSessionsHandler,
    private readonly revokeAllSessionsHandler: PlatformRevokeAllSessionsHandler,
    private readonly stepUpVerifyHandler: PlatformStepUpVerifyHandler,
    private readonly stepUpStatusHandler: PlatformStepUpStatusHandler,
    private readonly activityHandler: PlatformActivityHandler,
  ) {}

  /**
   * Interactive activity signal — throttled server-side.
   * Does not grant auth, permissions, or step-up; does not extend absolute expiry.
   */
  @PlatformAuthRoute()
  @Post('activity')
  @HttpCode(HttpStatus.OK)
  async recordActivity(@CurrentUser() user: JwtClaimsVO) {
    return this.activityHandler.execute(user);
  }

  @PlatformAuthRoute()
  @Get('mfa/status')
  async mfaStatus(@CurrentUser() user: JwtClaimsVO) {
    return this.mfaStatusHandler.execute(user);
  }

  @PlatformAuthRoute()
  @Post('mfa/recovery-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  async regenerateRecoveryCodes(@CurrentUser() user: JwtClaimsVO) {
    return this.regenerateRecoveryCodesHandler.execute(user);
  }

  @PlatformAuthRoute()
  @Post('mfa/replace/begin')
  @HttpCode(HttpStatus.OK)
  async beginReplace(@CurrentUser() user: JwtClaimsVO) {
    const result = await this.mfaBeginReplaceHandler.execute(user);
    return { ...result, principalType: 'platform' };
  }

  @PlatformAuthRoute()
  @Post('mfa/replace/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmReplace(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: PlatformMfaReplaceConfirmDto,
  ) {
    return this.mfaConfirmReplaceHandler.execute(user, body.code);
  }

  @PlatformAuthRoute()
  @Get('sessions')
  async listSessions(@CurrentUser() user: JwtClaimsVO) {
    return this.listSessionsHandler.execute(user);
  }

  @PlatformAuthRoute()
  @Post('sessions/:sessionId/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: JwtClaimsVO,
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    await this.revokeSessionHandler.execute(user, sessionId);
  }

  @PlatformAuthRoute()
  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  async revokeOtherSessions(@CurrentUser() user: JwtClaimsVO) {
    return this.revokeOtherSessionsHandler.execute(user);
  }

  @PlatformAuthRoute()
  @Post('sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  async revokeAllSessions(
    @CurrentUser() user: JwtClaimsVO,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.revokeAllSessionsHandler.execute(user);
    clearPlatformRefreshCookie(res);
    clearPlatformCsrfCookie(res);
    return result;
  }

  @PlatformAuthRoute()
  @Post('step-up/verify')
  @HttpCode(HttpStatus.OK)
  async verifyStepUp(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: PlatformStepUpVerifyDto,
  ) {
    return this.stepUpVerifyHandler.execute(user, body.code);
  }

  @PlatformAuthRoute()
  @Get('step-up/status')
  async stepUpStatus(@CurrentUser() user: JwtClaimsVO) {
    return this.stepUpStatusHandler.execute(user);
  }
}
