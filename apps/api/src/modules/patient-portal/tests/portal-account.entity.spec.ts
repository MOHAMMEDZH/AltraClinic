import { PortalAccount } from '../domain/entities/portal-account.entity';
import { PortalValidationError } from '../domain/exceptions/portal-domain.exception';
import { PortalPreferencesVO } from '../domain/value-objects/portal-preferences.vo';

describe('PortalAccount aggregate', () => {
  const baseInvite = {
    tenantId: 'tenant-1',
    branchId: 'branch-1',
    patientId: 'patient-1',
    invitedBy: 'staff-1',
  };

  it('invites an account in the invited state with default preferences', () => {
    const account = PortalAccount.invite(baseInvite);
    expect(account.status.value).toBe('invited');
    expect(account.userId).toBeNull();
    expect(account.preferences.locale).toBe('en');
    expect(account.preferences.channels).toEqual({ email: true, sms: true, push: false });
    expect(account.activeCaregiverGrants()).toHaveLength(0);
  });

  it('honours the requested locale on invitation', () => {
    const account = PortalAccount.invite({ ...baseInvite, locale: 'ar' });
    expect(account.preferences.locale).toBe('ar');
  });

  it.each([
    ['tenantId', 'Tenant identifier is required to invite a portal account'],
    ['patientId', 'Patient identifier is required to invite a portal account'],
    ['invitedBy', 'InvitedBy is required to invite a portal account'],
  ])('rejects invitation when %s is blank', (field, message) => {
    expect(() => PortalAccount.invite({ ...baseInvite, [field]: '   ' } as never)).toThrow(message);
  });

  it('activates an invited account and binds the user', () => {
    const account = PortalAccount.invite(baseInvite);
    account.activate('user-9');
    expect(account.status.value).toBe('active');
    expect(account.userId).toBe('user-9');
    expect(account.activatedAt).not.toBeNull();
  });

  it('requires a linked user to activate', () => {
    const account = PortalAccount.invite(baseInvite);
    expect(() => account.activate('  ')).toThrow(PortalValidationError);
  });

  it('cannot activate an already active account', () => {
    const account = PortalAccount.invite(baseInvite);
    account.activate('user-9');
    expect(() => account.activate('user-9')).toThrow('Portal account is already active');
  });

  it('suspends an active account with a reason and reactivates it', () => {
    const account = PortalAccount.invite(baseInvite);
    account.activate('user-9');
    account.suspend('payment hold');
    expect(account.status.value).toBe('suspended');
    expect(account.suspensionReason).toBe('payment hold');

    account.reactivate();
    expect(account.status.value).toBe('active');
    expect(account.suspensionReason).toBeNull();
  });

  it('requires a reason to suspend', () => {
    const account = PortalAccount.invite(baseInvite);
    account.activate('user-9');
    expect(() => account.suspend('   ')).toThrow('A reason is required to suspend a portal account');
  });

  it('only allows suspending an active account', () => {
    const account = PortalAccount.invite(baseInvite);
    expect(() => account.suspend('reason')).toThrow('Only an active portal account can be suspended');
  });

  it('only allows reactivating a suspended account', () => {
    const account = PortalAccount.invite(baseInvite);
    account.activate('user-9');
    expect(() => account.reactivate()).toThrow('Only a suspended portal account can be reactivated');
  });

  it('cannot activate a deactivated account (terminal state)', () => {
    const account = PortalAccount.invite(baseInvite);
    account.activate('user-9');
    account.deactivate('left clinic');
    expect(() => account.activate('user-9')).toThrow(
      'A deactivated portal account cannot be reactivated; issue a new invitation',
    );
  });

  it('deactivation cascades revocation to active caregiver grants', () => {
    const account = PortalAccount.invite(baseInvite);
    account.activate('user-9');
    const grant = account.grantCaregiverAccess({
      caregiverContact: 'mum@example.com',
      caregiverName: 'Mum',
      scopes: ['appointments'],
      grantedBy: 'user-9',
      expiresAt: null,
    });
    expect(grant.isActive()).toBe(true);

    account.deactivate('closed');
    expect(account.status.value).toBe('deactivated');
    expect(account.findGrant(grant.grantId)?.isActive()).toBe(false);
    expect(account.activeCaregiverGrants()).toHaveLength(0);
  });

  it('cannot deactivate twice', () => {
    const account = PortalAccount.invite(baseInvite);
    account.activate('user-9');
    account.deactivate(null);
    expect(() => account.deactivate(null)).toThrow('Portal account is already deactivated');
  });

  it('updatePreferences returns false when unchanged and true when changed', () => {
    const account = PortalAccount.invite(baseInvite);
    account.activate('user-9');

    const same = PortalPreferencesVO.default('en');
    expect(account.updatePreferences(same)).toBe(false);

    const changed = new PortalPreferencesVO('ar', { email: false, sms: true, push: true });
    expect(account.updatePreferences(changed)).toBe(true);
    expect(account.preferences.locale).toBe('ar');
    expect(account.preferences.channels.push).toBe(true);
  });

  it('cannot update preferences on a deactivated account', () => {
    const account = PortalAccount.invite(baseInvite);
    account.activate('user-9');
    account.deactivate(null);
    expect(() => account.updatePreferences(PortalPreferencesVO.default('ar'))).toThrow(
      'A deactivated portal account cannot update preferences',
    );
  });

  it('requires an active account to grant caregiver access', () => {
    const account = PortalAccount.invite(baseInvite);
    expect(() =>
      account.grantCaregiverAccess({
        caregiverContact: 'mum@example.com',
        caregiverName: 'Mum',
        scopes: ['appointments'],
        grantedBy: 'user-9',
        expiresAt: null,
      }),
    ).toThrow('Portal account must be active to grant caregiver access');
  });

  it('rejects a duplicate active caregiver by contact (case-insensitive)', () => {
    const account = PortalAccount.invite(baseInvite);
    account.activate('user-9');
    account.grantCaregiverAccess({
      caregiverContact: 'Mum@Example.com',
      caregiverName: 'Mum',
      scopes: ['appointments'],
      grantedBy: 'user-9',
      expiresAt: null,
    });
    expect(() =>
      account.grantCaregiverAccess({
        caregiverContact: 'mum@example.com',
        caregiverName: 'Mum Again',
        scopes: ['billing'],
        grantedBy: 'user-9',
        expiresAt: null,
      }),
    ).toThrow('This caregiver already has an active access grant');
  });

  it('enforces the maximum number of active caregiver grants', () => {
    const account = PortalAccount.invite(baseInvite);
    account.activate('user-9');
    for (let i = 0; i < PortalAccount.MAX_ACTIVE_CAREGIVER_GRANTS; i++) {
      account.grantCaregiverAccess({
        caregiverContact: `caregiver-${i}@example.com`,
        caregiverName: `Caregiver ${i}`,
        scopes: ['appointments'],
        grantedBy: 'user-9',
        expiresAt: null,
      });
    }
    expect(() =>
      account.grantCaregiverAccess({
        caregiverContact: 'one-too-many@example.com',
        caregiverName: 'Overflow',
        scopes: ['appointments'],
        grantedBy: 'user-9',
        expiresAt: null,
      }),
    ).toThrow(/cannot have more than/);
  });

  it('revokes a caregiver grant by id', () => {
    const account = PortalAccount.invite(baseInvite);
    account.activate('user-9');
    const grant = account.grantCaregiverAccess({
      caregiverContact: 'mum@example.com',
      caregiverName: 'Mum',
      scopes: ['appointments'],
      grantedBy: 'user-9',
      expiresAt: null,
    });

    account.revokeCaregiverAccess(grant.grantId, 'no longer needed');
    expect(account.findGrant(grant.grantId)?.isActive()).toBe(false);
  });

  it('throws when revoking an unknown grant', () => {
    const account = PortalAccount.invite(baseInvite);
    account.activate('user-9');
    expect(() => account.revokeCaregiverAccess('missing', null)).toThrow(
      'Caregiver access grant missing not found',
    );
  });

  it('frees a slot after revocation so a new grant can be created', () => {
    const account = PortalAccount.invite(baseInvite);
    account.activate('user-9');
    const grant = account.grantCaregiverAccess({
      caregiverContact: 'mum@example.com',
      caregiverName: 'Mum',
      scopes: ['appointments'],
      grantedBy: 'user-9',
      expiresAt: null,
    });
    account.revokeCaregiverAccess(grant.grantId, null);

    // Same contact can be re-granted once the previous grant is no longer active.
    const next = account.grantCaregiverAccess({
      caregiverContact: 'mum@example.com',
      caregiverName: 'Mum',
      scopes: ['billing'],
      grantedBy: 'user-9',
      expiresAt: null,
    });
    expect(next.isActive()).toBe(true);
  });

  it('round-trips through toPrimitives / restore', () => {
    const account = PortalAccount.invite({ ...baseInvite, locale: 'ar' });
    account.activate('user-9');
    account.grantCaregiverAccess({
      caregiverContact: 'mum@example.com',
      caregiverName: 'Mum',
      scopes: ['appointments', 'billing'],
      grantedBy: 'user-9',
      expiresAt: null,
    });

    const primitives = account.toPrimitives();
    expect(primitives.status).toBe('active');
    expect(primitives.preferences.locale).toBe('ar');
    expect(primitives.caregiverGrants).toHaveLength(1);
    expect(primitives.caregiverGrants[0].active).toBe(true);
    expect(primitives.hasEnrollmentToken).toBe(false);
  });

  it('issues and consumes enrollment tokens with consent', () => {
    const account = PortalAccount.invite(baseInvite);
    const raw = account.issueEnrollmentToken();
    expect(account.enrollmentTokenHash).toBeTruthy();
    account.assertEnrollmentTokenValid(raw);
    account.completeEnrollment({ userId: 'user-patient-1' });
    expect(account.status.value).toBe('active');
    expect(account.isEnrollmentComplete).toBe(true);
    expect(account.enrollmentTokenHash).toBeNull();
    expect(account.enrollmentConsentAt).toBeTruthy();
  });
});
