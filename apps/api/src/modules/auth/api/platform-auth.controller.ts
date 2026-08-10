import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { randomBytes } from 'crypto';
import { Public } from '../decorators/public.decorator';
import { PlatformAuthRoute } from '../decorators/platform-auth-route.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';
import {
  PlatformMfaChallengeDto,
  PlatformMfaEnrollmentBeginDto,
  PlatformMfaEnrollmentConfirmDto,
  PlatformLoginDto,
  PlatformRefreshBodyDto,
} from './dto/platform-auth.dto';
import { PlatformMfaBeginEnrollmentHandler } from '../../application/handlers/platform-mfa-begin-enrollment.handler';
import { PlatformMfaConfirmEnrollmentHandler } from '../../application/handlers/platform-mfa-confirm-enrollment.handler';
import { PlatformMfaVerifyChallengeHandler } from '../../application/handlers/platform-mfa-verify-challenge.handler';
import { PlatformLoginHandler } from '../../application/handlers/platform-login.handler';
import { PlatformRefreshHandler } from '../../application/handlers/platform-refresh.handler';
import { PlatformLogoutHandler } from '../../application/handlers/platform-logout.handler';
import { PlatformMeHandler } from '../../application/handlers/platform-me.handler';
import { JwtTokenService } from '../../infrastructure/services/jwt-token.service';
import { PlatformInvitationRepository } from '../infrastructure/repositories/prisma-platform-rbac.repositories';
import { createHash } from 'crypto';
import { PlatformInvitationAcceptanceService } from '../application/services/platform-invitation-acceptance.service';
import {
  mapPlatformInvitationAccept,
  mapPlatformInvitationValidation,
} from '../platform-rbac/platform-response.mappers';
import {
  assertPlatformCookieCsrf,
  clearPlatformCsrfCookie,
  clearPlatformRefreshCookie,
  parseCookieHeader,
  setPlatformCsrfCookie,
  setPlatformRefreshCookie,
} from './platform-auth-cookies';
import {
  PLATFORM_CSRF_COOKIE_NAME,
  PLATFORM_CSRF_HEADER,
  PLATFORM_REFRESH_COOKIE_NAME,
} from '../../platform-auth.tokens';

const TRUSTED_PROXY_IPS = new Set(
  (process.env['TRUSTED_PROXY_IPS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean),
);

function extractIp(req: Record<string, unknown>): string {
  const socket = req['socket'] as { remoteAddress?: string } | undefined;
  const socketIp = socket?.remoteAddress ?? '0.0.0.0';
  if (TRUSTED_PROXY_IPS.size > 0 && TRUSTED_PROXY_IPS.has(socketIp)) {
    const headers = req['headers'] as Record<string, string | string[] | undefined> | undefined;
    const xff = headers?.['x-forwarded-for'];
    const first = Array.isArray(xff) ? xff[0] : xff?.split(',')[0];
    if (first?.trim()) return first.trim();
  }
  return socketIp;
}

function extractUserAgent(req: Record<string, unknown>): string {
  const headers = req['headers'] as Record<string, string | string[] | undefined> | undefined;
  const ua = headers?.['user-agent'];
  return (Array.isArray(ua) ? ua[0] : ua) ?? '';
}

function headerString(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string,
): string | undefined {
  const raw = headers?.[name] ?? headers?.[name.toLowerCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Phase 47 Step 06 — Platform authentication API.
 * Accepts only platform principals on protected routes. No tenant/PHI/RBAC.
 */
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(
    private readonly loginHandler: PlatformLoginHandler,
    private readonly refreshHandler: PlatformRefreshHandler,
    private readonly logoutHandler: PlatformLogoutHandler,
    private readonly meHandler: PlatformMeHandler,
    private readonly mfaBeginEnrollmentHandler: PlatformMfaBeginEnrollmentHandler,
    private readonly mfaConfirmEnrollmentHandler: PlatformMfaConfirmEnrollmentHandler,
    private readonly mfaVerifyChallengeHandler: PlatformMfaVerifyChallengeHandler,
    private readonly jwtTokenService: JwtTokenService,
    private readonly invitations: PlatformInvitationRepository,
    private readonly invitationAcceptance: PlatformInvitationAcceptanceService,
  ) {}

  /**
   * MFA is mandatory. Password verification alone never returns tokens —
   * the response is a preauth transaction that must be completed via
   * mfa/enrollment/* or mfa/challenge before any session is established.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: PlatformLoginDto, @Req() req: Record<string, unknown>) {
    // x-tenant-id must never establish platform authority.
    const result = await this.loginHandler.execute({
      email: body.email,
      password: body.password,
      ipAddress: extractIp(req),
      userAgent: extractUserAgent(req),
    });

    return {
      kind: result.kind,
      preauthToken: result.preauthToken,
      expiresIn: result.expiresIn,
      ...(result.kind === 'mfa_enrollment_required' ? { email: result.email } : {}),
    };
  }

  @Public()
  @Get('invitation/validate')
  async validateInvitation(@Query('token') token?: string) {
    if (!token) {
      return mapPlatformInvitationValidation({ valid: false, expired: false, canActivate: false });
    }
    const invitation = await this.invitations.findByTokenHash(
      createHash('sha256').update(token).digest('hex'),
    );
    const expired = !!invitation && invitation.expiresAt <= new Date();
    const valid = !!invitation && invitation.status === 'pending' && !expired;
    const emailHint = valid
      ? invitation!.email.replace(
          /^(.)(.*)(@.*)$/,
          (_m, first, middle, domain) => `${first}${'*'.repeat(Math.min(6, middle.length))}${domain}`,
        )
      : undefined;
    return mapPlatformInvitationValidation({
      valid,
      expired,
      canActivate: valid,
      ...(emailHint ? { emailHint } : {}),
    });
  }

  @Public()
  @Post('invitation/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(@Body() body: { token: string; password: string }) {
    const result = await this.invitationAcceptance.accept(body.token, body.password);
    return mapPlatformInvitationAccept({
      preauthToken: result.preauthToken,
      expiresIn: result.expiresIn,
    });
  }

  @Public()
  @Post('mfa/enrollment/begin')
  @HttpCode(HttpStatus.OK)
  async beginEnrollment(@Body() body: PlatformMfaEnrollmentBeginDto) {
    if (!body.preauthToken) {
      throw new UnauthorizedException('preauthToken is required.');
    }
    const result = await this.mfaBeginEnrollmentHandler.execute(body.preauthToken);
    return { ...result, principalType: 'platform' };
  }

  @Public()
  @Post('mfa/enrollment/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmEnrollment(
    @Body() body: PlatformMfaEnrollmentConfirmDto,
    @Req() req: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.mfaConfirmEnrollmentHandler.execute({
      preauthToken: body.preauthToken,
      code: body.code,
      ipAddress: extractIp(req),
      userAgent: extractUserAgent(req),
      deviceLabel: body.deviceLabel ?? null,
    });

    this.issueSessionCookies(res, result.tokens.refreshToken);

    return {
      accessToken: result.tokens.accessToken,
      accessExpiresIn: result.tokens.accessExpiresIn,
      sessionId: result.tokens.sessionId,
      tokenType: 'Bearer',
      principalType: 'platform',
      recoveryCodes: result.recoveryCodes,
    };
  }

  @Public()
  @Post('mfa/challenge')
  @HttpCode(HttpStatus.OK)
  async mfaChallenge(
    @Body() body: PlatformMfaChallengeDto,
    @Req() req: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.mfaVerifyChallengeHandler.execute({
      preauthToken: body.preauthToken,
      code: body.code,
      ipAddress: extractIp(req),
      userAgent: extractUserAgent(req),
      deviceLabel: body.deviceLabel ?? null,
    });

    this.issueSessionCookies(res, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      accessExpiresIn: tokens.accessExpiresIn,
      sessionId: tokens.sessionId,
      tokenType: 'Bearer',
      principalType: 'platform',
    };
  }

  private issueSessionCookies(res: Response, refreshToken: string): void {
    const refreshTtl = Math.floor(
      (this.jwtTokenService.getPlatformRefreshExpiresAt().getTime() - Date.now()) / 1000,
    );
    setPlatformRefreshCookie(res, refreshToken, refreshTtl);
    const csrf = randomBytes(32).toString('hex');
    setPlatformCsrfCookie(res, csrf);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: PlatformRefreshBodyDto,
    @Req() req: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const headers = req['headers'] as Record<string, string | string[] | undefined> | undefined;
    const cookies = parseCookieHeader(headerString(headers, 'cookie'));
    const cookieRefresh = cookies[PLATFORM_REFRESH_COOKIE_NAME];
    const raw = (body.refreshToken?.trim() || cookieRefresh || '').trim();

    if (!raw) {
      throw new UnauthorizedException('Refresh token required.');
    }

    // Cookie-authenticated refresh requires CSRF / origin checks.
    if (cookieRefresh && !body.refreshToken?.trim()) {
      this.enforceCookieCsrf(req, cookies);
    }

    const pair = await this.refreshHandler.execute(
      raw,
      extractIp(req),
      extractUserAgent(req),
    );

    const refreshTtl = Math.floor(
      (this.jwtTokenService.getPlatformRefreshExpiresAt().getTime() - Date.now()) / 1000,
    );
    setPlatformRefreshCookie(res, pair.refreshToken, refreshTtl);

    return {
      accessToken: pair.accessToken,
      accessExpiresIn: pair.accessExpiresIn,
      sessionId: pair.sessionId,
      tokenType: 'Bearer',
      principalType: 'platform',
    };
  }

  @PlatformAuthRoute()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: JwtClaimsVO,
    @Req() req: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const headers = req['headers'] as Record<string, string | string[] | undefined> | undefined;
    const cookies = parseCookieHeader(headerString(headers, 'cookie'));
    if (cookies[PLATFORM_REFRESH_COOKIE_NAME]) {
      this.enforceCookieCsrf(req, cookies);
    }

    await this.logoutHandler.execute({
      platformUserId: user.sub,
      sessionId: user.sessionId,
      accessJti: user.jti,
    });

    clearPlatformRefreshCookie(res);
    clearPlatformCsrfCookie(res);
  }

  @PlatformAuthRoute()
  @Get('me')
  async me(@CurrentUser() user: JwtClaimsVO) {
    return this.meHandler.execute(user);
  }

  private enforceCookieCsrf(
    req: Record<string, unknown>,
    cookies: Record<string, string>,
  ): void {
    const headers = req['headers'] as Record<string, string | string[] | undefined> | undefined;
    try {
      assertPlatformCookieCsrf({
        origin: headerString(headers, 'origin'),
        referer: headerString(headers, 'referer'),
        method: String(req['method'] ?? 'POST'),
      });
    } catch {
      throw new ForbiddenException('Invalid origin for credentialed platform auth request.');
    }

    const headerCsrf = headerString(headers, PLATFORM_CSRF_HEADER);
    const cookieCsrf = cookies[PLATFORM_CSRF_COOKIE_NAME];
    if (!headerCsrf || !cookieCsrf || headerCsrf !== cookieCsrf) {
      throw new ForbiddenException('CSRF token missing or invalid.');
    }
  }
}
