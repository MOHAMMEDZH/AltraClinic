import { IdentityFieldPolicyService } from '../application/services/identity-field-policy.service';

describe('IdentityFieldPolicyService', () => {
  const service = new IdentityFieldPolicyService();

  it('allows owners to update all fields', () => {
    const input = { roles: ['doctor'], notes: 'secret' };
    const result = service.filterUpdateInput(['owner'], input, true);
    expect(result).toEqual(input);
  });

  it('strips restricted fields for receptionist', () => {
    const input = { roles: ['doctor'], notes: 'secret', firstName: 'Ada' };
    const result = service.filterUpdateInput(['receptionist'], input, false);
    expect(result.roles).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(result.firstName).toBe('Ada');
  });
});
