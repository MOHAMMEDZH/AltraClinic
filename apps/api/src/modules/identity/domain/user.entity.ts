import { randomUUID } from 'crypto';

export type UserRole =
  | 'super_admin'
  | 'owner'
  | 'general_manager'
  | 'branch_manager'
  | 'doctor'
  | 'dentist'
  | 'specialist'
  | 'nurse'
  | 'assistant'
  | 'receptionist'
  | 'accountant'
  | 'inventory_manager'
  | 'lab_technician'
  | 'radiologist'
  | 'cashier'
  | 'hr'
  | 'marketing'
  | 'patient';

export const ALL_ROLES: UserRole[] = [
  'super_admin', 'owner', 'general_manager', 'branch_manager', 'doctor', 'dentist',
  'specialist', 'nurse', 'assistant', 'receptionist', 'accountant',
  'inventory_manager', 'lab_technician', 'radiologist', 'cashier', 'hr', 'marketing', 'patient',
];

export type EmploymentStatus = 'active' | 'suspended' | 'on_leave' | 'archived' | 'terminated';

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  roles: UserRole[];
  tenantId: string;
  branchId: string | null;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  phone: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  managerId: string | null;
  startDate: Date | null;
  employmentStatus: EmploymentStatus;
  timezone: string | null;
  languages: string[];
  avatarUrl: string | null;
  notes: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  suspendedAt: Date | null;
  archivedAt: Date | null;
  isActive: boolean;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  lockedUntil: Date | null;
  failedLoginCount: number;
  passwordChangedAt: Date;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  public readonly id: string;
  public readonly email: string;
  public readonly passwordHash: string;
  public readonly roles: UserRole[];
  public readonly tenantId: string;
  public readonly branchId: string | null;
  public readonly firstName: string;
  public readonly lastName: string;
  public readonly firstNameAr: string | null;
  public readonly lastNameAr: string | null;
  public readonly phone: string | null;
  public readonly jobTitle: string | null;
  public readonly departmentId: string | null;
  public readonly managerId: string | null;
  public readonly startDate: Date | null;
  public readonly employmentStatus: EmploymentStatus;
  public readonly timezone: string | null;
  public readonly languages: string[];
  public readonly avatarUrl: string | null;
  public readonly notes: string | null;
  public readonly emergencyContactName: string | null;
  public readonly emergencyContactPhone: string | null;
  public readonly suspendedAt: Date | null;
  public readonly archivedAt: Date | null;
  public readonly isActive: boolean;
  public readonly emailVerified: boolean;
  public readonly emailVerifiedAt: Date | null;
  public readonly mfaEnabled: boolean;
  public readonly mfaSecret: string | null;
  public readonly lockedUntil: Date | null;
  public readonly failedLoginCount: number;
  public readonly passwordChangedAt: Date;
  public readonly lastLoginAt: Date | null;
  public readonly lastLoginIp: string | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.roles = props.roles;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.firstNameAr = props.firstNameAr;
    this.lastNameAr = props.lastNameAr;
    this.phone = props.phone;
    this.jobTitle = props.jobTitle;
    this.departmentId = props.departmentId;
    this.managerId = props.managerId;
    this.startDate = props.startDate;
    this.employmentStatus = props.employmentStatus;
    this.timezone = props.timezone;
    this.languages = props.languages;
    this.avatarUrl = props.avatarUrl;
    this.notes = props.notes;
    this.emergencyContactName = props.emergencyContactName;
    this.emergencyContactPhone = props.emergencyContactPhone;
    this.suspendedAt = props.suspendedAt;
    this.archivedAt = props.archivedAt;
    this.isActive = props.isActive;
    this.emailVerified = props.emailVerified;
    this.emailVerifiedAt = props.emailVerifiedAt;
    this.mfaEnabled = props.mfaEnabled;
    this.mfaSecret = props.mfaSecret;
    this.lockedUntil = props.lockedUntil;
    this.failedLoginCount = props.failedLoginCount;
    this.passwordChangedAt = props.passwordChangedAt;
    this.lastLoginAt = props.lastLoginAt;
    this.lastLoginIp = props.lastLoginIp;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input: {
    email: string;
    passwordHash: string;
    roles: UserRole[];
    tenantId: string;
    branchId?: string | null;
    firstName: string;
    lastName: string;
    firstNameAr?: string | null;
    lastNameAr?: string | null;
    phone?: string | null;
    jobTitle?: string | null;
    departmentId?: string | null;
    managerId?: string | null;
    startDate?: Date | null;
    employmentStatus?: EmploymentStatus;
    timezone?: string | null;
    languages?: string[];
    avatarUrl?: string | null;
    notes?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
  }): User {
    const now = new Date();
    return new User({
      id: randomUUID(),
      email: input.email.toLowerCase().trim(),
      passwordHash: input.passwordHash,
      roles: input.roles,
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      firstName: input.firstName,
      lastName: input.lastName,
      firstNameAr: input.firstNameAr ?? null,
      lastNameAr: input.lastNameAr ?? null,
      phone: input.phone ?? null,
      jobTitle: input.jobTitle ?? null,
      departmentId: input.departmentId ?? null,
      managerId: input.managerId ?? null,
      startDate: input.startDate ?? null,
      employmentStatus: input.employmentStatus ?? 'active',
      timezone: input.timezone ?? null,
      languages: input.languages ?? [],
      avatarUrl: input.avatarUrl ?? null,
      notes: input.notes ?? null,
      emergencyContactName: input.emergencyContactName ?? null,
      emergencyContactPhone: input.emergencyContactPhone ?? null,
      suspendedAt: null,
      archivedAt: null,
      isActive: true,
      emailVerified: false,
      emailVerifiedAt: null,
      mfaEnabled: false,
      mfaSecret: null,
      lockedUntil: null,
      failedLoginCount: 0,
      passwordChangedAt: now,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: UserProps): User {
    return new User(props);
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  /** True if the account lockout window has not yet expired */
  isLocked(): boolean {
    return this.lockedUntil !== null && this.lockedUntil > new Date();
  }

  recordSuccessfulLogin(ipAddress: string): User {
    return User.restore({
      ...this.toProps(),
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
      updatedAt: new Date(),
    });
  }

  recordFailedLogin(lockThreshold: number, lockDurationMinutes: number): User {
    const newCount = this.failedLoginCount + 1;
    const lockedUntil =
      newCount >= lockThreshold
        ? new Date(Date.now() + lockDurationMinutes * 60_000)
        : this.lockedUntil;

    return User.restore({
      ...this.toProps(),
      failedLoginCount: newCount,
      lockedUntil,
      updatedAt: new Date(),
    });
  }

  verifyEmail(): User {
    return User.restore({
      ...this.toProps(),
      emailVerified: true,
      emailVerifiedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  changePassword(newHash: string): User {
    return User.restore({
      ...this.toProps(),
      passwordHash: newHash,
      passwordChangedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    });
  }

  enableMfa(secret: string): User {
    return User.restore({ ...this.toProps(), mfaEnabled: true, mfaSecret: secret, updatedAt: new Date() });
  }

  disableMfa(): User {
    return User.restore({ ...this.toProps(), mfaEnabled: false, mfaSecret: null, updatedAt: new Date() });
  }

  beginMfaEnrollment(secret: string): User {
    return User.restore({
      ...this.toProps(),
      mfaSecret: secret,
      mfaEnabled: false,
      updatedAt: new Date(),
    });
  }

  confirmMfaEnrollment(): User {
    if (!this.mfaSecret) {
      throw new Error('MFA secret is not configured');
    }
    return User.restore({ ...this.toProps(), mfaEnabled: true, updatedAt: new Date() });
  }

  deactivate(): User {
    return User.restore({ ...this.toProps(), isActive: false, updatedAt: new Date() });
  }

  softDelete(): User {
    return User.restore({ ...this.toProps(), isActive: false, updatedAt: new Date() });
  }

  activate(): User {
    return User.restore({ ...this.toProps(), isActive: true, updatedAt: new Date() });
  }

  unlock(): User {
    return User.restore({
      ...this.toProps(),
      lockedUntil: null,
      failedLoginCount: 0,
      updatedAt: new Date(),
    });
  }

  adminLock(lockedUntil: Date): User {
    return User.restore({
      ...this.toProps(),
      lockedUntil,
      updatedAt: new Date(),
    });
  }

  suspend(): User {
    const now = new Date();
    return User.restore({
      ...this.toProps(),
      isActive: false,
      employmentStatus: 'suspended',
      suspendedAt: now,
      updatedAt: now,
    });
  }

  archive(): User {
    const now = new Date();
    return User.restore({
      ...this.toProps(),
      isActive: false,
      employmentStatus: 'archived',
      archivedAt: now,
      updatedAt: now,
    });
  }

  restoreAccount(): User {
    return User.restore({
      ...this.toProps(),
      isActive: true,
      employmentStatus: 'active',
      suspendedAt: null,
      archivedAt: null,
      updatedAt: new Date(),
    });
  }

  updateProfile(input: {
    firstName?: string;
    lastName?: string;
    firstNameAr?: string | null;
    lastNameAr?: string | null;
    phone?: string | null;
    branchId?: string | null;
    roles?: UserRole[];
    jobTitle?: string | null;
    departmentId?: string | null;
    managerId?: string | null;
    startDate?: Date | null;
    employmentStatus?: EmploymentStatus;
    timezone?: string | null;
    languages?: string[];
    avatarUrl?: string | null;
    notes?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
  }): User {
    return User.restore({
      ...this.toProps(),
      firstName: input.firstName ?? this.firstName,
      lastName: input.lastName ?? this.lastName,
      firstNameAr: input.firstNameAr !== undefined ? input.firstNameAr : this.firstNameAr,
      lastNameAr: input.lastNameAr !== undefined ? input.lastNameAr : this.lastNameAr,
      phone: input.phone !== undefined ? input.phone : this.phone,
      branchId: input.branchId !== undefined ? input.branchId : this.branchId,
      roles: input.roles ?? this.roles,
      jobTitle: input.jobTitle !== undefined ? input.jobTitle : this.jobTitle,
      departmentId: input.departmentId !== undefined ? input.departmentId : this.departmentId,
      managerId: input.managerId !== undefined ? input.managerId : this.managerId,
      startDate: input.startDate !== undefined ? input.startDate : this.startDate,
      employmentStatus: input.employmentStatus ?? this.employmentStatus,
      timezone: input.timezone !== undefined ? input.timezone : this.timezone,
      languages: input.languages ?? this.languages,
      avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : this.avatarUrl,
      notes: input.notes !== undefined ? input.notes : this.notes,
      emergencyContactName:
        input.emergencyContactName !== undefined ? input.emergencyContactName : this.emergencyContactName,
      emergencyContactPhone:
        input.emergencyContactPhone !== undefined ? input.emergencyContactPhone : this.emergencyContactPhone,
      updatedAt: new Date(),
    });
  }

  private toProps(): UserProps {
    return {
      id: this.id,
      email: this.email,
      passwordHash: this.passwordHash,
      roles: this.roles,
      tenantId: this.tenantId,
      branchId: this.branchId,
      firstName: this.firstName,
      lastName: this.lastName,
      firstNameAr: this.firstNameAr,
      lastNameAr: this.lastNameAr,
      phone: this.phone,
      jobTitle: this.jobTitle,
      departmentId: this.departmentId,
      managerId: this.managerId,
      startDate: this.startDate,
      employmentStatus: this.employmentStatus,
      timezone: this.timezone,
      languages: this.languages,
      avatarUrl: this.avatarUrl,
      notes: this.notes,
      emergencyContactName: this.emergencyContactName,
      emergencyContactPhone: this.emergencyContactPhone,
      suspendedAt: this.suspendedAt,
      archivedAt: this.archivedAt,
      isActive: this.isActive,
      emailVerified: this.emailVerified,
      emailVerifiedAt: this.emailVerifiedAt,
      mfaEnabled: this.mfaEnabled,
      mfaSecret: this.mfaSecret,
      lockedUntil: this.lockedUntil,
      failedLoginCount: this.failedLoginCount,
      passwordChangedAt: this.passwordChangedAt,
      lastLoginAt: this.lastLoginAt,
      lastLoginIp: this.lastLoginIp,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
