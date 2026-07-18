import { PasswordPolicyVO } from '../domain/value-objects/password-policy.vo';

describe('PasswordPolicyVO', () => {
  const policy = PasswordPolicyVO.default();

  it('accepts a strong password', () => {
    expect(policy.validate('SecurePass1!')).toHaveLength(0);
  });

  it('rejects passwords shorter than minimum', () => {
    const violations = policy.validate('Ab1!');
    expect(violations.some((v) => v.includes('at least 8'))).toBe(true);
  });

  it('rejects passwords without uppercase', () => {
    const violations = policy.validate('password1!');
    expect(violations.some((v) => v.includes('uppercase'))).toBe(true);
  });

  it('rejects passwords without digits', () => {
    const violations = policy.validate('Password!');
    expect(violations.some((v) => v.includes('digit'))).toBe(true);
  });

  it('rejects passwords without special characters', () => {
    const violations = policy.validate('Password1');
    expect(violations.some((v) => v.includes('special'))).toBe(true);
  });

  it('rejects passwords exceeding max length', () => {
    const longPass = 'A1!' + 'a'.repeat(130);
    const violations = policy.validate(longPass);
    expect(violations.some((v) => v.includes('not exceed'))).toBe(true);
  });

  it('collects all violations at once', () => {
    const violations = policy.validate('short');
    expect(violations.length).toBeGreaterThan(1);
  });
});
