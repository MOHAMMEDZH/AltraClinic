import { describe, expect, it } from 'vitest';
import {
  isPasswordValid,
  passwordStrengthScore,
  passwordsMatch,
  validatePassword,
} from '@/lib/password-policy';

describe('password-policy', () => {
  it('rejects weak passwords', () => {
    expect(isPasswordValid('short')).toBe(false);
    expect(validatePassword('short')).toContain('minLength');
  });

  it('accepts policy-compliant passwords', () => {
    expect(isPasswordValid('SecureP@ss1')).toBe(true);
  });

  it('scores password strength progressively', () => {
    expect(passwordStrengthScore('')).toBe(0);
    expect(passwordStrengthScore('SecureP@ss1')).toBeGreaterThan(0);
  });

  it('matches confirmation passwords', () => {
    expect(passwordsMatch('SecureP@ss1', 'SecureP@ss1')).toBe(true);
    expect(passwordsMatch('SecureP@ss1', 'other')).toBe(false);
  });
});
