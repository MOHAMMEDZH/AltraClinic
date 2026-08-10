import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../auth/api/decorators/public.decorator';
import { PatientPortalCenterEnabledGuard } from './patient-portal-center.guard';
import { PatientPortalSessionGuard } from './patient-portal-session.guard';
import { PortalDomainExceptionFilter } from './patient-portal-domain-exception.filter';
import { PatientPortalIdentityService } from '../application/services/patient-portal-identity.service';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';

interface AuthenticatedRequest {
  user?: JwtClaimsVO;
  headers?: Record<string, unknown>;
  ip?: string;
}

class PortalEnrollDto {
  tenantId!: string;
  enrollmentToken!: string;
  email!: string;
  password!: string;
  firstName?: string;
  lastName?: string;
  consentAccepted!: boolean;
}

class PortalLoginDto {
  tenantId!: string;
  email!: string;
  password!: string;
  deviceName?: string;
}

class PortalMfaVerifyDto {
  mfaChallengeToken!: string;
  code!: string;
}

class PortalRefreshDto {
  refreshToken!: string;
}

class PortalForgotPasswordDto {
  tenantId!: string;
  email!: string;
}

class PortalResetPasswordDto {
  tenantId!: string;
  token!: string;
  newPassword!: string;
}

class PortalChangePasswordDto {
  currentPassword!: string;
  newPassword!: string;
}

class PortalMfaConfirmDto {
  code!: string;
}

class PortalEnrollmentStatusDto {
  tenantId!: string;
  enrollmentToken!: string;
}

/**
 * Phase 46b — Patient portal identity / enrollment / session APIs.
 * No appointments, caregiver PHI, or clinical surfaces.
 */
@Controller('patient-portal/auth')
@UseGuards(PatientPortalCenterEnabledGuard)
@UseFilters(PortalDomainExceptionFilter)
export class PatientPortalAuthController {
  constructor(private readonly identity: PatientPortalIdentityService) {}

  private correlationId(request: AuthenticatedRequest): string | null {
    const header = request.headers?.['x-correlation-id'];
    return typeof header === 'string' && header.trim() ? header.trim() : null;
  }

  private clientIp(request: AuthenticatedRequest): string {
    return request.ip || '0.0.0.0';
  }

  private userAgent(request: AuthenticatedRequest): string {
    const ua = request.headers?.['user-agent'];
    return typeof ua === 'string' ? ua : '';
  }

  @Public()
  @Post('enroll')
  async enroll(@Body() body: PortalEnrollDto, @Req() request: AuthenticatedRequest) {
    const result = await this.identity.completeEnrollment({
      tenantId: body.tenantId,
      enrollmentToken: body.enrollmentToken,
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      consentAccepted: body.consentAccepted === true,
      ipAddress: this.clientIp(request),
      userAgent: this.userAgent(request),
      correlationId: this.correlationId(request),
    });
    return {
      portalAccountId: result.portalAccountId,
      userId: result.userId,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      accessExpiresIn: result.tokens.accessExpiresIn,
      sessionId: result.tokens.sessionId,
      sessionClass: 'patient',
    };
  }

  @Public()
  @Post('enrollment-status')
  async enrollmentStatus(@Body() body: PortalEnrollmentStatusDto) {
    return this.identity.getEnrollmentStatus({
      tenantId: body.tenantId,
      enrollmentToken: body.enrollmentToken,
    });
  }

  @Public()
  @Post('login')
  async login(@Body() body: PortalLoginDto, @Req() request: AuthenticatedRequest) {
    const result = await this.identity.login({
      tenantId: body.tenantId,
      email: body.email,
      password: body.password,
      ipAddress: this.clientIp(request),
      userAgent: this.userAgent(request),
      deviceName: body.deviceName ?? null,
      correlationId: this.correlationId(request),
    });
    if (result.kind === 'mfa_required') {
      return {
        kind: 'mfa_required',
        mfaChallengeToken: result.mfaChallengeToken,
        mfaExpiresIn: result.mfaExpiresIn,
      };
    }
    return {
      kind: 'tokens',
      portalAccountId: result.portalAccountId,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      accessExpiresIn: result.tokens.accessExpiresIn,
      sessionId: result.tokens.sessionId,
      sessionClass: 'patient',
    };
  }

  @Public()
  @Post('mfa/verify')
  async verifyMfa(@Body() body: PortalMfaVerifyDto, @Req() request: AuthenticatedRequest) {
    const result = await this.identity.verifyMfa({
      mfaChallengeToken: body.mfaChallengeToken,
      code: body.code,
      ipAddress: this.clientIp(request),
      userAgent: this.userAgent(request),
      correlationId: this.correlationId(request),
    });
    return {
      portalAccountId: result.portalAccountId,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      accessExpiresIn: result.tokens.accessExpiresIn,
      sessionId: result.tokens.sessionId,
      sessionClass: 'patient',
    };
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() body: PortalRefreshDto, @Req() request: AuthenticatedRequest) {
    const tokens = await this.identity.refresh({
      refreshToken: body.refreshToken,
      ipAddress: this.clientIp(request),
      userAgent: this.userAgent(request),
    });
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessExpiresIn: tokens.accessExpiresIn,
      sessionId: tokens.sessionId,
      sessionClass: 'patient',
    };
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() body: PortalForgotPasswordDto, @Req() request: AuthenticatedRequest) {
    const result = await this.identity.forgotPassword({
      tenantId: body.tenantId,
      email: body.email,
      ipAddress: this.clientIp(request),
    });
    // Always 200 — enumeration resistant. resetToken only present in non-prod test paths.
    return { accepted: true, ...(result.resetToken ? { resetToken: result.resetToken } : {}) };
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() body: PortalResetPasswordDto) {
    await this.identity.resetPassword({
      tenantId: body.tenantId,
      token: body.token,
      newPassword: body.newPassword,
    });
    return { ok: true };
  }

  @Post('logout')
  @UseGuards(PatientPortalSessionGuard)
  async logout(@Req() request: AuthenticatedRequest) {
    const user = request.user!;
    await this.identity.logout({
      userId: user.sub,
      tenantId: user.tenantId,
      sessionId: user.sessionId,
      correlationId: this.correlationId(request),
    });
    return { ok: true };
  }

  @Post('logout-all')
  @UseGuards(PatientPortalSessionGuard)
  async logoutAll(@Req() request: AuthenticatedRequest) {
    const user = request.user!;
    await this.identity.logoutAll({
      userId: user.sub,
      tenantId: user.tenantId,
      correlationId: this.correlationId(request),
    });
    return { ok: true };
  }

  @Post('change-password')
  @UseGuards(PatientPortalSessionGuard)
  async changePassword(@Body() body: PortalChangePasswordDto, @Req() request: AuthenticatedRequest) {
    const user = request.user!;
    await this.identity.changePassword({
      userId: user.sub,
      tenantId: user.tenantId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
    return { ok: true };
  }

  @Post('mfa/setup')
  @UseGuards(PatientPortalSessionGuard)
  async setupMfa(@Req() request: AuthenticatedRequest) {
    const user = request.user!;
    return this.identity.setupMfa({ userId: user.sub, tenantId: user.tenantId });
  }

  @Post('mfa/confirm')
  @UseGuards(PatientPortalSessionGuard)
  async confirmMfa(@Body() body: PortalMfaConfirmDto, @Req() request: AuthenticatedRequest) {
    const user = request.user!;
    return this.identity.confirmMfa({
      userId: user.sub,
      tenantId: user.tenantId,
      code: body.code,
    });
  }

  @Get('me')
  @UseGuards(PatientPortalSessionGuard)
  async me(@Req() request: AuthenticatedRequest) {
    const user = request.user!;
    return this.identity.getMe({ userId: user.sub, tenantId: user.tenantId });
  }
}
