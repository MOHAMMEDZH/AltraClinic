import { ForbiddenException } from '@nestjs/common';
import { CaregiverAccessGrant } from '../domain/entities/caregiver-access-grant.entity';
import { PortalAccount } from '../domain/entities/portal-account.entity';
import { CaregiverAccessDomainService } from '../domain/services/caregiver-access.domain-service';
import { isPatientPortalCaregiverEnabled } from '../config/patient-portal-config';
import { PatientPortalCaregiverEnabledGuard } from '../api/patient-portal-caregiver.guard';
import { PatientPortalResultReleaseGate } from '../application/services/patient-portal-result-release.gate';
import { PatientPortalObservabilityContracts } from '../application/patient-portal-observability.contracts';
import { PatientPortalActingContextService } from '../application/services/patient-portal-acting-context.service';
import { GetPortalSafeProfileHandler } from '../application/handlers/portal-safe-profile.handler';
import { PATIENT_PORTAL_ERROR_CODES } from '../patient-portal.constants';
import { CAREGIVER_ACCESS_SCOPES, CAREGIVER_MVP_SCOPES } from '../domain/value-objects/caregiver-access-scope';
import { FakePortalAuditLog } from './support/fake-portal-audit-log';
import { PatientPortalActivityEmitter } from '../application/services/patient-portal-activity.emitter';

function activeAccount(overrides?: {
  portalAccountId?: string;
  patientId?: string;
  userId?: string;
}) {
  const invited = PortalAccount.invite({
    tenantId: 'tenant-1',
    branchId: 'branch-1',
    patientId: overrides?.patientId ?? 'patient-1',
    invitedBy: 'staff-1',
    locale: 'en',
  });
  // restore with fixed id if needed via invite then we can't set portalAccountId easily —
  // invite generates id; for tests we use patientId/userId primarily.
  invited.activate(overrides?.userId ?? 'user-1');
  return invited;
}

describe('Phase 46d — caregiver & patient-safe access', () => {
  const previous: Record<string, string | undefined> = {};
  const flagKeys = ['PATIENT_PORTAL_CENTER_ENABLED', 'PATIENT_PORTAL_CAREGIVER_ENABLED'];

  beforeEach(() => {
    for (const key of flagKeys) {
      previous[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of flagKeys) {
      const prev = previous[key];
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  });

  it('defaults caregiver flag OFF and requires center ON', () => {
    expect(isPatientPortalCaregiverEnabled()).toBe(false);
    process.env.PATIENT_PORTAL_CAREGIVER_ENABLED = 'true';
    expect(isPatientPortalCaregiverEnabled()).toBe(false);
    process.env.PATIENT_PORTAL_CENTER_ENABLED = 'true';
    expect(isPatientPortalCaregiverEnabled()).toBe(true);
  });

  it('registers profile + appointments MVP scopes', () => {
    expect(CAREGIVER_MVP_SCOPES).toEqual(['profile', 'appointments']);
    expect(CAREGIVER_ACCESS_SCOPES).toContain('profile');
  });

  it('CaregiverEnabledGuard fails closed when OFF', () => {
    const guard = new PatientPortalCaregiverEnabledGuard();
    expect(() => guard.canActivate({} as never)).toThrow();
  });

  it('supports invite → accept → revoke lifecycle on grant entity', () => {
    const grant = CaregiverAccessGrant.create({
      grantId: 'g1',
      caregiverContact: 'mum@example.com',
      caregiverName: 'Mum',
      scopes: ['profile', 'appointments'],
      grantedBy: 'user-1',
      expiresAt: null,
      now: new Date(),
      status: 'invited',
      invitationTokenHash: 'hash',
      invitationExpiresAt: new Date(Date.now() + 60_000),
    });
    expect(grant.isActive()).toBe(false);
    expect(grant.status).toBe('invited');
    grant.accept('caregiver-user');
    expect(grant.isActive()).toBe(true);
    expect(grant.caregiverUserId).toBe('caregiver-user');
    grant.revoke('done');
    expect(grant.isActive()).toBe(false);
    expect(grant.status).toBe('revoked');
  });

  it('supports decline and expiry semantics', () => {
    const grant = CaregiverAccessGrant.create({
      grantId: 'g2',
      caregiverContact: 'dad@example.com',
      caregiverName: 'Dad',
      scopes: ['appointments'],
      grantedBy: 'user-1',
      expiresAt: null,
      now: new Date(),
      status: 'invited',
      invitationTokenHash: 'h',
      invitationExpiresAt: new Date(Date.now() + 60_000),
    });
    grant.decline();
    expect(grant.status).toBe('declined');
    expect(grant.isActive()).toBe(false);

    const expired = CaregiverAccessGrant.create({
      grantId: 'g3',
      caregiverContact: 'x@example.com',
      caregiverName: 'X',
      scopes: ['profile'],
      grantedBy: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      now: new Date(),
      status: 'active',
    });
    expect(expired.isActive(new Date(Date.now() + 120_000))).toBe(false);
  });

  it('domain service denies missing/wrong scope and allows matching grant', () => {
    const account = activeAccount();
    account.grantCaregiverAccess({
      caregiverContact: 'mum@example.com',
      caregiverName: 'Mum',
      scopes: ['appointments'],
      grantedBy: 'user-1',
      expiresAt: null,
    });
    const domain = new CaregiverAccessDomainService();
    expect(domain.decide(account, 'mum@example.com', 'appointments').allowed).toBe(true);
    expect(domain.decide(account, 'mum@example.com', 'profile').reason).toBe('scope_not_granted');
    expect(domain.decide(account, 'other@example.com', 'appointments').reason).toBe('no_active_grant');
  });

  it('result-release gate plumbing denies product exposure', () => {
    const gate = new PatientPortalResultReleaseGate(new PatientPortalObservabilityContracts());
    const decision = gate.evaluate({
      tenantId: 't1',
      subjectPatientId: 'p1',
    });
    expect(decision.allowed).toBe(false);
    expect(() =>
      gate.assertReadable({ tenantId: 't1', subjectPatientId: 'p1' }),
    ).toThrow(ForbiddenException);
  });

  it('acting context self resolves subject from portal account', async () => {
    const account = activeAccount();
    const portalRepo = {
      findByUserId: jest.fn().mockResolvedValue(account),
      findByPatientId: jest.fn(),
    };
    const service = new PatientPortalActingContextService(
      { user: { findFirst: jest.fn() } } as never,
      { resolve: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }) } as never,
      portalRepo as never,
      new PatientPortalObservabilityContracts(),
      new FakePortalAuditLog(),
      { enforceFeature: jest.fn() } as never,
    );
    const ctx = await service.resolve({
      actorUserId: 'user-1',
      actorRoles: ['patient'],
      actingContextHeader: 'self',
    });
    expect(ctx.mode).toBe('self');
    expect(ctx.subjectPatientId).toBe('patient-1');
  });

  it('acting context caregiver denies without grant and audits', async () => {
    const actor = activeAccount({ patientId: 'patient-caregiver', userId: 'user-c' });
    const subject = activeAccount({ patientId: 'patient-subject', userId: 'user-s' });
    const audit = new FakePortalAuditLog();
    const portalRepo = {
      findByUserId: jest.fn().mockResolvedValue(actor),
      findByPatientId: jest.fn().mockResolvedValue(subject),
    };
    process.env.PATIENT_PORTAL_CENTER_ENABLED = 'true';
    process.env.PATIENT_PORTAL_CAREGIVER_ENABLED = 'true';
    const service = new PatientPortalActingContextService(
      { user: { findFirst: jest.fn().mockResolvedValue({ email: 'mum@example.com' }) } } as never,
      { resolve: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }) } as never,
      portalRepo as never,
      new PatientPortalObservabilityContracts(),
      audit,
      { enforceFeature: jest.fn().mockResolvedValue(undefined) } as never,
    );
    await expect(
      service.resolve({
        actorUserId: 'user-c',
        actorRoles: ['patient'],
        actingContextHeader: 'caregiver',
        subjectPatientIdHeader: 'patient-subject',
        requiredScope: 'profile',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(audit.records.some((r) => r.action.includes('denied'))).toBe(true);
  });

  it('acting context caregiver allows with active scoped grant', async () => {
    const actorAccount = activeAccount({ patientId: 'patient-caregiver', userId: 'user-c' });
    const subject = activeAccount({ patientId: 'patient-subject', userId: 'user-s' });
    const grant = subject.grantCaregiverAccess({
      caregiverContact: 'mum@example.com',
      caregiverName: 'Mum',
      scopes: ['profile', 'appointments'],
      grantedBy: 'user-s',
      expiresAt: null,
      status: 'invited',
      invitationTokenHash: 'tok',
      invitationExpiresAt: new Date(Date.now() + 60_000),
    });
    subject.acceptCaregiverInvitation(grant.grantId, 'user-c');

    process.env.PATIENT_PORTAL_CENTER_ENABLED = 'true';
    process.env.PATIENT_PORTAL_CAREGIVER_ENABLED = 'true';
    const portalRepo = {
      findByUserId: jest.fn().mockResolvedValue(actorAccount),
      findByPatientId: jest.fn().mockResolvedValue(subject),
    };
    const service = new PatientPortalActingContextService(
      { user: { findFirst: jest.fn().mockResolvedValue({ email: 'mum@example.com' }) } } as never,
      { resolve: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }) } as never,
      portalRepo as never,
      new PatientPortalObservabilityContracts(),
      new FakePortalAuditLog(),
      { enforceFeature: jest.fn().mockResolvedValue(undefined) } as never,
    );
    const ctx = await service.resolve({
      actorUserId: 'user-c',
      actorRoles: ['patient'],
      actingContextHeader: 'caregiver',
      subjectPatientIdHeader: 'patient-subject',
      requiredScope: 'profile',
    });
    expect(ctx.mode).toBe('caregiver');
    expect(ctx.subjectPatientId).toBe('patient-subject');
    expect(ctx.scopes).toContain('profile');
  });

  it('profile facade returns minimized Patients SoR fields', async () => {
    const acting = {
      resolve: jest.fn().mockResolvedValue({
        mode: 'self',
        actorUserId: 'user-1',
        actorRoles: ['patient'],
        subjectPatientId: 'patient-1',
        subjectPortalAccountId: 'portal-1',
        grantId: null,
        scopes: [],
      }),
    };
    const patients = {
      findDetailById: jest.fn().mockResolvedValue({
        id: 'patient-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        dateOfBirth: '1815-12-10',
        gender: 'female',
        branchId: 'branch-1',
        phone: 'secret',
        email: 'secret@example.com',
        nationalId: 'secret',
        notes: 'clinical',
        bloodGroup: 'A+',
      }),
    };
    const observability = new PatientPortalObservabilityContracts();
    const handler = new GetPortalSafeProfileHandler(
      patients as never,
      { resolve: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }) } as never,
      acting as never,
      observability,
      new PatientPortalActivityEmitter(observability),
      new FakePortalAuditLog(),
    );
    const dto = await handler.execute({
      actorUserId: 'user-1',
      actorRoles: ['patient'],
      actingContextHeader: 'self',
    });
    expect(dto).toEqual({
      patientId: 'patient-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      dateOfBirth: '1815-12-10',
      gender: 'female',
      localeHint: null,
      actingContext: 'self',
    });
    expect(dto).not.toHaveProperty('phone');
    expect(dto).not.toHaveProperty('nationalId');
    expect(dto).not.toHaveProperty('notes');
  });

  it('rejects ambiguous acting context values', async () => {
    const service = new PatientPortalActingContextService(
      {} as never,
      { resolve: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }) } as never,
      { findByUserId: jest.fn() } as never,
      new PatientPortalObservabilityContracts(),
      new FakePortalAuditLog(),
      { enforceFeature: jest.fn() } as never,
    );
    await expect(
      service.resolve({
        actorUserId: 'u1',
        actorRoles: ['patient'],
        actingContextHeader: 'staff',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: PATIENT_PORTAL_ERROR_CODES.ACTING_CONTEXT_INVALID }),
    });
  });
});
