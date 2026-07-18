/**
 * COMPETING ARCHITECT CHALLENGE:
 *   Challenger: "Hard-coded policy is inflexible — tenants need custom rules."
 *   Decision: Phase 1 ships a sensible default. The VO is a value object (not a
 *   static function) so a tenant-specific policy can be loaded from DB and injected
 *   later without changing call sites. Phase 2 adds TenantPasswordPolicy to schema.
 */
export class PasswordPolicyVO {
  readonly minLength: number;
  readonly requireUppercase: boolean;
  readonly requireLowercase: boolean;
  readonly requireDigit: boolean;
  readonly requireSpecial: boolean;
  readonly maxLength: number;

  constructor(overrides?: Partial<{
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireDigit: boolean;
    requireSpecial: boolean;
    maxLength: number;
  }>) {
    this.minLength = overrides?.minLength ?? 8;
    this.maxLength = overrides?.maxLength ?? 128;
    this.requireUppercase = overrides?.requireUppercase ?? true;
    this.requireLowercase = overrides?.requireLowercase ?? true;
    this.requireDigit = overrides?.requireDigit ?? true;
    this.requireSpecial = overrides?.requireSpecial ?? true;
  }

  validate(password: string): string[] {
    const errors: string[] = [];
    if (password.length < this.minLength) errors.push(`Password must be at least ${this.minLength} characters.`);
    if (password.length > this.maxLength) errors.push(`Password must not exceed ${this.maxLength} characters.`);
    if (this.requireUppercase && !/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter.');
    if (this.requireLowercase && !/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter.');
    if (this.requireDigit && !/\d/.test(password)) errors.push('Password must contain at least one digit.');
    if (this.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
      errors.push('Password must contain at least one special character.');
    }
    return errors;
  }

  isValid(password: string): boolean {
    return this.validate(password).length === 0;
  }

  static default(): PasswordPolicyVO {
    return new PasswordPolicyVO();
  }

  static fromTenantPolicy(policy: {
    minPasswordLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSymbols?: boolean;
  }): PasswordPolicyVO {
    return new PasswordPolicyVO({
      minLength: policy.minPasswordLength ?? 8,
      requireUppercase: policy.requireUppercase ?? true,
      requireLowercase: policy.requireLowercase ?? true,
      requireDigit: policy.requireNumbers ?? true,
      requireSpecial: policy.requireSymbols ?? true,
    });
  }
}
