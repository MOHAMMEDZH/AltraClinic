import {
  Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UnauthorizedException,
} from '@nestjs/common';
import { LoginDto, LoginResponseDto } from '../application/dto/login.dto';
import { RefreshTokenDto } from '../application/dto/refresh-token.dto';
import { ForgotPasswordDto } from '../application/dto/forgot-password.dto';
import { ResetPasswordDto } from '../application/dto/reset-password.dto';
import { VerifyEmailDto } from '../application/dto/verify-email.dto';
import { ChangePasswordDto } from '../application/dto/change-password.dto';
import { LoginHandler } from '../application/handlers/login.handler';
import { LogoutHandler } from '../application/handlers/logout.handler';
import { LogoutAllHandler } from '../application/handlers/logout-all.handler';
import { RefreshTokenHandler } from '../application/handlers/refresh-token.handler';
import { ForgotPasswordHandler } from '../application/handlers/forgot-password.handler';
import { ResetPasswordHandler } from '../application/handlers/reset-password.handler';
import { VerifyEmailHandler } from '../application/handlers/verify-email.handler';
import { SendVerificationEmailHandler } from '../application/handlers/send-verification-email.handler';
import { ListSessionsHandler } from '../application/handlers/list-sessions.handler';
import { ChangePasswordHandler } from '../application/handlers/change-password.handler';
import { GetMeHandler } from '../application/handlers/get-me.handler';
import { VerifyMfaHandler } from '../application/handlers/verify-mfa.handler';
import { SetupMfaHandler } from '../application/handlers/setup-mfa.handler';
import { ConfirmMfaHandler } from '../application/handlers/confirm-mfa.handler';
import { DisableMfaHandler } from '../application/handlers/disable-mfa.handler';
import { RevokeSessionHandler } from '../application/handlers/revoke-session.handler';
import { RegenerateMfaBackupCodesHandler } from '../application/handlers/regenerate-mfa-backup-codes.handler';
import { LoginCompletionService } from '../application/services/login-completion.service';
import { TotpService } from '../infrastructure/services/totp.service';
import { ConfirmMfaDto, DisableMfaDto, RegenerateMfaBackupCodesDto, VerifyMfaDto } from '../application/dto/mfa.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtClaimsVO } from '../domain/value-objects/jwt-claims.vo';

/**
 * Extract the client IP address.
 *
 * SECURITY: X-Forwarded-For can be spoofed by clients to bypass IP rate limiting.
 * We only read it when TRUSTED_PROXY_IPS is configured (i.e., the app is behind
 * a known reverse-proxy that sets this header reliably). Without that config,
 * we fall back to the socket IP which cannot be forged.
 *
 * Production: set TRUSTED_PROXY_IPS=<comma-separated proxy IPs> in .env and
 * configure NestJS/Express `app.set('trust proxy', ...)` accordingly.
 */
const TRUSTED_PROXY_IPS = new Set(
  (process.env['TRUSTED_PROXY_IPS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean),
);

function extractIp(req: Record<string, unknown>): string {
  const socketIp = String(req['ip'] ?? '');
  const headers = req['headers'] as Record<string, unknown>;

  if (TRUSTED_PROXY_IPS.size > 0 && TRUSTED_PROXY_IPS.has(socketIp)) {
    // Request arrived from a trusted proxy — use the first non-proxy IP in XFF
    const xff = String(headers?.['x-forwarded-for'] ?? '').split(',');
    const clientIp = xff[0]?.trim();
    if (clientIp) return clientIp;
  }

  return socketIp || '0.0.0.0';
}

function extractUserAgent(req: Record<string, unknown>): string {
  const headers = req['headers'] as Record<string, unknown>;
  return String(headers?.['user-agent'] ?? '');
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginHandler: LoginHandler,
    private readonly logoutHandler: LogoutHandler,
    private readonly logoutAllHandler: LogoutAllHandler,
    private readonly refreshHandler: RefreshTokenHandler,
    private readonly forgotHandler: ForgotPasswordHandler,
    private readonly resetHandler: ResetPasswordHandler,
    private readonly verifyEmailHandler: VerifyEmailHandler,
    private readonly sendVerificationHandler: SendVerificationEmailHandler,
    private readonly listSessionsHandler: ListSessionsHandler,
    private readonly changePasswordHandler: ChangePasswordHandler,
    private readonly getMeHandler: GetMeHandler,
    private readonly verifyMfaHandler: VerifyMfaHandler,
    private readonly setupMfaHandler: SetupMfaHandler,
    private readonly confirmMfaHandler: ConfirmMfaHandler,
    private readonly disableMfaHandler: DisableMfaHandler,
    private readonly revokeSessionHandler: RevokeSessionHandler,
    private readonly regenerateMfaBackupCodesHandler: RegenerateMfaBackupCodesHandler,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() req: Record<string, unknown>,
  ): Promise<LoginResponseDto> {
    const result = await this.loginHandler.execute({
      email: body.email,
      password: body.password,
      tenantId: body.tenantId,
      ipAddress: extractIp(req),
      userAgent: extractUserAgent(req),
      deviceName: body.deviceName,
      deviceTrustToken: body.deviceTrustToken,
    });

    const response = new LoginResponseDto();
    if (result.kind === 'mfa_required') {
      response.mfaRequired = true;
      response.mfaChallengeToken = result.mfaChallengeToken;
      response.mfaExpiresIn = result.mfaExpiresIn;
      return response;
    }

    response.accessToken = result.tokens.accessToken;
    response.refreshToken = result.tokens.refreshToken;
    response.accessExpiresIn = result.tokens.accessExpiresIn;
    response.sessionId = result.tokens.sessionId;
    return response;
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(
    @Body() body: VerifyMfaDto,
    @Req() req: Record<string, unknown>,
  ): Promise<LoginResponseDto> {
    const pair = await this.verifyMfaHandler.execute({
      mfaChallengeToken: body.mfaChallengeToken,
      code: body.code,
      ipAddress: extractIp(req),
      userAgent: extractUserAgent(req),
      trustDevice: body.trustDevice,
    });

    const response = new LoginResponseDto();
    response.accessToken = pair.accessToken;
    response.refreshToken = pair.refreshToken;
    response.accessExpiresIn = pair.accessExpiresIn;
    response.sessionId = pair.sessionId;
    response.deviceTrustToken = pair.deviceTrustToken;
    response.deviceTrustExpiresIn = pair.deviceTrustExpiresIn;
    return response;
  }

  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  async setupMfa(@CurrentUser() user: JwtClaimsVO) {
    return this.setupMfaHandler.execute(user.sub, user.tenantId);
  }

  @Post('mfa/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmMfa(@CurrentUser() user: JwtClaimsVO, @Body() body: ConfirmMfaDto) {
    return this.confirmMfaHandler.execute(user.sub, user.tenantId, body.code);
  }

  @Post('mfa/disable')
  @HttpCode(HttpStatus.OK)
  async disableMfa(@CurrentUser() user: JwtClaimsVO, @Body() body: DisableMfaDto) {
    return this.disableMfaHandler.execute(user.sub, user.tenantId, body.password, body.code);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() req: Record<string, unknown>,
  ): Promise<LoginResponseDto> {
    const pair = await this.refreshHandler.execute(
      body.refreshToken,
      extractIp(req),
      extractUserAgent(req),
    );

    const response = new LoginResponseDto();
    response.accessToken = pair.accessToken;
    response.refreshToken = pair.refreshToken;
    response.accessExpiresIn = pair.accessExpiresIn;
    response.sessionId = pair.sessionId;
    return response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: JwtClaimsVO): Promise<void> {
    if (!user.tenantId) {
      throw new UnauthorizedException('Tenant session required.');
    }
    await this.logoutHandler.execute(user.sessionId, user.sub, user.tenantId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser() user: JwtClaimsVO): Promise<{ revokedCount: number }> {
    if (!user.tenantId) {
      throw new UnauthorizedException('Tenant session required.');
    }
    return this.logoutAllHandler.execute(user.sub, user.tenantId, user.sessionId);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() body: ForgotPasswordDto,
    @Req() req: Record<string, unknown>,
  ): Promise<{ message: string }> {
    await this.forgotHandler.execute({
      email: body.email,
      tenantId: body.tenantId,
      ipAddress: extractIp(req),
    });
    return { message: 'If your email is registered, a reset link has been sent.' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: ResetPasswordDto): Promise<{ message: string }> {
    await this.resetHandler.execute({
      rawToken: body.token,
      newPassword: body.newPassword,
      tenantId: body.tenantId,
    });
    return { message: 'Password has been reset. Please log in with your new password.' };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() body: VerifyEmailDto): Promise<{ message: string }> {
    await this.verifyEmailHandler.execute(body.token, body.tenantId);
    return { message: 'Email verified successfully.' };
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@CurrentUser() user: JwtClaimsVO): Promise<{ message: string }> {
    await this.sendVerificationHandler.execute(user.sub, user.tenantId);
    return { message: 'Verification email sent.' };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: ChangePasswordDto,
  ): Promise<{ message: string; revokedOtherSessions: number }> {
    const result = await this.changePasswordHandler.execute({
      userId: user.sub,
      tenantId: user.tenantId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      currentSessionId: user.sessionId,
    });
    return {
      message: 'Password changed successfully.',
      revokedOtherSessions: result.revokedOtherSessions,
    };
  }

  @Get('sessions')
  async getSessions(@CurrentUser() user: JwtClaimsVO) {
    return this.listSessionsHandler.execute(user.sub, user.tenantId);
  }

  @Post('sessions/:sessionId/revoke')
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @CurrentUser() user: JwtClaimsVO,
    @Param('sessionId') sessionId: string,
  ): Promise<{ revoked: boolean; wasCurrent: boolean }> {
    return this.revokeSessionHandler.execute({
      userId: user.sub,
      tenantId: user.tenantId,
      sessionId,
      currentSessionId: user.sessionId,
    });
  }

  @Post('mfa/backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  async regenerateMfaBackupCodes(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: RegenerateMfaBackupCodesDto,
  ) {
    return this.regenerateMfaBackupCodesHandler.execute(
      user.sub,
      user.tenantId,
      body.password,
      body.code,
    );
  }

  @Get('me')
  async me(@CurrentUser() user: JwtClaimsVO) {
    return this.getMeHandler.execute(user.sub, user.tenantId, user.sessionId);
  }
}
