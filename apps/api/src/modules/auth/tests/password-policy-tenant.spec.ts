import { PasswordPolicyVO } from '../domain/value-objects/password-policy.vo';

describe('PasswordPolicyVO.fromTenantPolicy', () => {
  it('applies tenant minimum length', () => {
    const policy = PasswordPolicyVO.fromTenantPolicy({ minPasswordLength: 14, requireSymbols: false });
    expect(policy.isValid('Short1!')).toBe(false);
    expect(policy.isValid('LongEnoughPass1')).toBe(true);
  });
});
