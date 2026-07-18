import { CaregiverAccessGrant } from '../domain/entities/caregiver-access-grant.entity';

describe('CaregiverAccessGrant entity', () => {
  const now = new Date('2025-01-01T00:00:00.000Z');
  const baseParams = {
    grantId: 'grant-1',
    caregiverContact: 'mum@example.com',
    caregiverName: 'Mum',
    scopes: ['appointments' as const],
    grantedBy: 'user-9',
    expiresAt: null,
    now,
  };

  it('creates an active grant and trims inputs', () => {
    const grant = CaregiverAccessGrant.create({
      ...baseParams,
      caregiverContact: '  mum@example.com  ',
      caregiverName: '  Mum  ',
    });
    expect(grant.caregiverContact).toBe('mum@example.com');
    expect(grant.caregiverName).toBe('Mum');
    expect(grant.isActive(now)).toBe(true);
  });

  it('deduplicates scopes', () => {
    const grant = CaregiverAccessGrant.create({
      ...baseParams,
      scopes: ['appointments', 'appointments', 'billing'],
    });
    expect(grant.scopes).toEqual(['appointments', 'billing']);
  });

  it.each([
    ['caregiverContact', 'Caregiver contact is required to grant access'],
    ['caregiverName', 'Caregiver name is required to grant access'],
    ['grantedBy', 'GrantedBy is required to grant caregiver access'],
  ])('rejects when %s is blank', (field, message) => {
    expect(() => CaregiverAccessGrant.create({ ...baseParams, [field]: '   ' } as never)).toThrow(message);
  });

  it('requires at least one scope', () => {
    expect(() => CaregiverAccessGrant.create({ ...baseParams, scopes: [] })).toThrow(
      'At least one access scope is required to grant caregiver access',
    );
  });

  it('rejects an invalid scope', () => {
    expect(() =>
      CaregiverAccessGrant.create({ ...baseParams, scopes: ['hacking' as never] }),
    ).toThrow(/Invalid caregiver access scope/);
  });

  it('rejects a non-future expiry', () => {
    expect(() =>
      CaregiverAccessGrant.create({ ...baseParams, expiresAt: new Date(now.getTime() - 1) }),
    ).toThrow('Caregiver access expiry must be in the future');
  });

  it('is inactive once expired', () => {
    const grant = CaregiverAccessGrant.create({
      ...baseParams,
      expiresAt: new Date(now.getTime() + 1000),
    });
    expect(grant.isActive(new Date(now.getTime() + 500))).toBe(true);
    expect(grant.isActive(new Date(now.getTime() + 2000))).toBe(false);
  });

  it('is inactive once revoked and cannot be revoked twice', () => {
    const grant = CaregiverAccessGrant.create(baseParams);
    grant.revoke('done', now);
    expect(grant.isActive(now)).toBe(false);
    expect(() => grant.revoke('again', now)).toThrow('Caregiver access has already been revoked');
  });

  it('reports scope membership', () => {
    const grant = CaregiverAccessGrant.create({ ...baseParams, scopes: ['appointments', 'billing'] });
    expect(grant.hasScope('appointments')).toBe(true);
    expect(grant.hasScope('prescriptions')).toBe(false);
  });

  it('projects to primitives including the active flag', () => {
    const grant = CaregiverAccessGrant.create(baseParams);
    const primitives = grant.toPrimitives(now);
    expect(primitives).toMatchObject({
      grantId: 'grant-1',
      caregiverContact: 'mum@example.com',
      caregiverName: 'Mum',
      active: true,
      revokedAt: null,
    });
  });
});
