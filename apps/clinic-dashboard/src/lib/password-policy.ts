export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecial: boolean;
}

export type PasswordRuleKey =
  | 'minLength'
  | 'uppercase'
  | 'lowercase'
  | 'digit'
  | 'special';

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
};

const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function validatePassword(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): PasswordRuleKey[] {
  const failed: PasswordRuleKey[] = [];
  if (password.length < policy.minLength) failed.push('minLength');
  if (password.length > policy.maxLength) failed.push('minLength');
  if (policy.requireUppercase && !/[A-Z]/.test(password)) failed.push('uppercase');
  if (policy.requireLowercase && !/[a-z]/.test(password)) failed.push('lowercase');
  if (policy.requireDigit && !/\d/.test(password)) failed.push('digit');
  if (policy.requireSpecial && !SPECIAL_RE.test(password)) failed.push('special');
  return failed;
}

export function isPasswordValid(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): boolean {
  return validatePassword(password, policy).length === 0;
}

export function passwordStrengthScore(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && SPECIAL_RE.test(password)) score += 1;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}

export function passwordsMatch(a: string, b: string): boolean {
  return a.length > 0 && a === b;
}
