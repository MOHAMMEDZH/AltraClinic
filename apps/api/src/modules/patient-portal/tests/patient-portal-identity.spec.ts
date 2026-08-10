import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { JwtTokenService } from '../../auth/infrastructure/services/jwt-token.service';
import { JwtService } from '@nestjs/jwt';
import { PortalAccount } from '../domain/entities/portal-account.entity';
import { PatientPortalSessionGuard } from '../api/patient-portal-session.guard';
import { UnauthorizedException } from '@nestjs/common';
import { isPatientPortalCenterEnabled } from '../config/patient-portal-config';

describe('Phase 46b — Patient identity & session security', () => {
  const previous = process.env.PATIENT_PORTAL_CENTER_ENABLED;

  afterEach(() => {
    if (previous === undefined) delete process.env.PATIENT_PORTAL_CENTER_ENABLED;
    else process.env.PATIENT_PORTAL_CENTER_ENABLED = previous;
  });

  it('issues patient sessionClass tokens distinct from staff', () => {
    const jwt = new JwtTokenService(new JwtService(), {
      accessSecret: 'test-access-secret-32chars-minimum!!',
      refreshSecret: 'test-refresh-secret-32chars-minimum!',
      accessExpiresIn: 900,
      refreshExpiresIn: 86400,
      mfaChallengeExpiresIn: 300,
    });

    const staff = jwt.issueTokenPair({
      userId: 'u-staff',
      tenantId: 't1',
      branchId: null,
      roles: ['owner'],
      sessionId: 's-staff',
      sessionClass: 'staff',
    });
    const patient = jwt.issueTokenPair({
      userId: 'u-patient',
      tenantId: 't1',
      branchId: null,
      roles: ['patient'],
      sessionId: 's-patient',
      sessionClass: 'patient',
    });

    const staffClaims = jwt.verifyAccessToken(staff.accessToken)!;
    const patientClaims = jwt.verifyAccessToken(patient.accessToken)!;
    expect(staffClaims.sessionClass).toBe('staff');
    expect(patientClaims.sessionClass).toBe('patient');
    expect(staffClaims.isStaffSession()).toBe(true);
    expect(patientClaims.isPatientSession()).toBe(true);

    const refresh = jwt.verifyRefreshToken(patient.refreshToken)!;
    expect(refresh.sessionClass).toBe('patient');
  });

  it('defaults missing sessionClass to staff for backward compatibility', () => {
    const claims = new JwtClaimsVO({
      sub: 'u1',
      tenantId: 't1',
      branchId: null,
      roles: ['owner'],
      sessionId: 's1',
    });
    expect(claims.sessionClass).toBe('staff');
  });

  it('PatientPortalSessionGuard rejects staff sessions', () => {
    const guard = new PatientPortalSessionGuard();
    const staff = new JwtClaimsVO({
      sub: 'u1',
      tenantId: 't1',
      branchId: null,
      roles: ['owner'],
      sessionId: 's1',
      sessionClass: 'staff',
    });
    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => ({ user: staff }) }),
      } as never),
    ).toThrow(UnauthorizedException);

    const patient = new JwtClaimsVO({
      sub: 'u2',
      tenantId: 't1',
      branchId: null,
      roles: ['patient'],
      sessionId: 's2',
      sessionClass: 'patient',
    });
    expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => ({ user: patient }) }),
      } as never),
    ).toBe(true);
  });

  it('enrollment completion requires invited state and consent timestamp', () => {
    const account = PortalAccount.invite({
      tenantId: 't1',
      patientId: 'p1',
      invitedBy: 'staff-1',
    });
    const token = account.issueEnrollmentToken();
    account.assertEnrollmentTokenValid(token);
    account.completeEnrollment({ userId: 'u-patient' });
    expect(account.isEnrollmentComplete).toBe(true);
    expect(account.status.value).toBe('active');
  });

  it('rejects expired enrollment tokens', () => {
    const account = PortalAccount.invite({
      tenantId: 't1',
      patientId: 'p1',
      invitedBy: 'staff-1',
    });
    const token = account.issueEnrollmentToken(new Date(), -1000);
    expect(() => account.assertEnrollmentTokenValid(token)).toThrow();
  });

  it('master feature flag remains OFF by default', () => {
    delete process.env.PATIENT_PORTAL_CENTER_ENABLED;
    expect(isPatientPortalCenterEnabled()).toBe(false);
  });

  it('MFA challenge preserves patient sessionClass', () => {
    const jwt = new JwtTokenService(new JwtService(), {
      accessSecret: 'test-access-secret-32chars-minimum!!',
      refreshSecret: 'test-refresh-secret-32chars-minimum!',
      accessExpiresIn: 900,
      refreshExpiresIn: 86400,
      mfaChallengeExpiresIn: 300,
    });
    const { token } = jwt.issueMfaChallenge({
      userId: 'u1',
      tenantId: 't1',
      sessionId: 's1',
      ipAddress: '127.0.0.1',
      userAgent: 'test',
      deviceName: null,
      sessionClass: 'patient',
    });
    const claims = jwt.verifyMfaChallenge(token)!;
    expect(claims.sessionClass).toBe('patient');
  });
});
