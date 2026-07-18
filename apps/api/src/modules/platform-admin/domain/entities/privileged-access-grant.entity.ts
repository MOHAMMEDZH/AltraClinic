import {
  PlatformAdminStateError,
  PlatformAdminValidationError,
} from '../exceptions/platform-admin.exception';
import {
  EffectivePrivilegedAccessGrantStatus,
  PrivilegedAccessGrantStatus,
} from '../value-objects/privileged-access-grant-status';
import {
  PrivilegedAccessScope,
  isPrivilegedAccessScope,
} from '../value-objects/privileged-access-scope';

export interface PrivilegedAccessGrantProps {
  grantId: string;
  adminId: string;
  adminName: string;
  scopes: PrivilegedAccessScope[];
  justification: string;
  breakGlass: boolean;
  status: PrivilegedAccessGrantStatus;
  requestedAt: Date;
  expiresAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedReason: string | null;
  rejectedAt: Date | null;
  revokedReason: string | null;
  revokedAt: Date | null;
}

export interface PrivilegedAccessGrantPrimitives {
  grantId: string;
  adminId: string;
  adminName: string;
  scopes: PrivilegedAccessScope[];
  justification: string;
  breakGlass: boolean;
  status: EffectivePrivilegedAccessGrantStatus;
  requestedAt: string;
  expiresAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedReason: string | null;
  rejectedAt: string | null;
  revokedReason: string | null;
  revokedAt: string | null;
  active: boolean;
}

/**
 * A just-in-time (JIT), time-boxed elevation that authorizes a platform
 * administrator to act inside a specific tenant. It is an entity local to the
 * {@link PlatformTenant} aggregate — it has identity and lifecycle but is never
 * persisted or mutated independently of its aggregate root.
 *
 * Security model (SECURITY.md §3, PERSONAS.md §13 Super Admin):
 *  - Every grant REQUIRES a justification and a future expiry (JIT, no standing
 *    access).
 *  - Standard grants follow a two-person rule: a grant is `pending_approval`
 *    until a DIFFERENT administrator approves it (separation of duties /
 *    multi-party authorization). Self-approval is rejected.
 *  - `breakGlass` grants are activated immediately for emergencies but are
 *    flagged for mandatory post-event review and audited as such.
 */
export class PrivilegedAccessGrant {
  private readonly props: PrivilegedAccessGrantProps;

  private constructor(props: PrivilegedAccessGrantProps) {
    this.props = props;
  }

  static request(params: {
    grantId: string;
    adminId: string;
    adminName: string;
    scopes: PrivilegedAccessScope[];
    justification: string;
    expiresAt: Date;
    breakGlass: boolean;
    now: Date;
    minJustificationLength: number;
  }): PrivilegedAccessGrant {
    const adminId = params.adminId?.trim();
    if (!adminId) {
      throw new PlatformAdminValidationError('Administrator identifier is required to request privileged access');
    }
    const adminName = params.adminName?.trim();
    if (!adminName) {
      throw new PlatformAdminValidationError('Administrator name is required to request privileged access');
    }
    const justification = params.justification?.trim();
    if (!justification || justification.length < params.minJustificationLength) {
      throw new PlatformAdminValidationError(
        `A justification of at least ${params.minJustificationLength} characters is required to request privileged access`,
      );
    }
    if (!Array.isArray(params.scopes) || params.scopes.length === 0) {
      throw new PlatformAdminValidationError('At least one access scope is required to request privileged access');
    }
    const uniqueScopes = Array.from(new Set(params.scopes));
    for (const scope of uniqueScopes) {
      if (!isPrivilegedAccessScope(scope)) {
        throw new PlatformAdminValidationError(`Invalid privileged access scope: ${scope}`);
      }
    }
    if (params.expiresAt.getTime() <= params.now.getTime()) {
      throw new PlatformAdminValidationError('Privileged access expiry must be in the future');
    }

    return new PrivilegedAccessGrant({
      grantId: params.grantId,
      adminId,
      adminName,
      scopes: uniqueScopes,
      justification,
      breakGlass: params.breakGlass,
      status: params.breakGlass ? 'active' : 'pending_approval',
      requestedAt: params.now,
      expiresAt: params.expiresAt,
      approvedBy: null,
      approvedAt: params.breakGlass ? params.now : null,
      rejectedBy: null,
      rejectedReason: null,
      rejectedAt: null,
      revokedReason: null,
      revokedAt: null,
    });
  }

  static restore(props: PrivilegedAccessGrantProps): PrivilegedAccessGrant {
    return new PrivilegedAccessGrant(props);
  }

  get grantId(): string {
    return this.props.grantId;
  }

  get adminId(): string {
    return this.props.adminId;
  }

  get adminName(): string {
    return this.props.adminName;
  }

  get scopes(): PrivilegedAccessScope[] {
    return [...this.props.scopes];
  }

  get justification(): string {
    return this.props.justification;
  }

  get breakGlass(): boolean {
    return this.props.breakGlass;
  }

  get status(): PrivilegedAccessGrantStatus {
    return this.props.status;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get approvedBy(): string | null {
    return this.props.approvedBy;
  }

  isExpired(at: Date = new Date()): boolean {
    return this.props.expiresAt.getTime() <= at.getTime();
  }

  /** Active means approved/break-glass AND not yet expired. */
  isActive(at: Date = new Date()): boolean {
    return this.props.status === 'active' && !this.isExpired(at);
  }

  effectiveStatus(at: Date = new Date()): EffectivePrivilegedAccessGrantStatus {
    if (this.props.status === 'active' && this.isExpired(at)) {
      return 'expired';
    }
    return this.props.status;
  }

  hasScope(scope: PrivilegedAccessScope): boolean {
    return this.props.scopes.includes(scope);
  }

  /**
   * Approve a pending grant. Enforces the two-person rule: the approver must
   * differ from the requester (separation of duties).
   */
  approve(approverId: string, at: Date = new Date()): void {
    const approver = approverId?.trim();
    if (!approver) {
      throw new PlatformAdminValidationError('Approver identifier is required to approve privileged access');
    }
    if (this.props.breakGlass) {
      throw new PlatformAdminStateError('Break-glass access is already active and cannot be approved');
    }
    if (this.props.status !== 'pending_approval') {
      throw new PlatformAdminStateError('Only a pending privileged-access request can be approved');
    }
    if (approver === this.props.adminId) {
      throw new PlatformAdminValidationError(
        'Separation of duties: privileged access must be approved by a different administrator',
      );
    }
    if (this.isExpired(at)) {
      throw new PlatformAdminStateError('This privileged-access request has expired and can no longer be approved');
    }

    this.props.status = 'active';
    this.props.approvedBy = approver;
    this.props.approvedAt = at;
  }

  /** Reject a pending grant. The approver must differ from the requester. */
  reject(approverId: string, reason: string | null, at: Date = new Date()): void {
    const approver = approverId?.trim();
    if (!approver) {
      throw new PlatformAdminValidationError('Approver identifier is required to reject privileged access');
    }
    if (this.props.breakGlass) {
      throw new PlatformAdminStateError('Break-glass access cannot be rejected; revoke it instead');
    }
    if (this.props.status !== 'pending_approval') {
      throw new PlatformAdminStateError('Only a pending privileged-access request can be rejected');
    }
    if (approver === this.props.adminId) {
      throw new PlatformAdminValidationError(
        'Separation of duties: privileged access must be reviewed by a different administrator',
      );
    }

    this.props.status = 'rejected';
    this.props.rejectedBy = approver;
    this.props.rejectedReason = reason?.trim() || null;
    this.props.rejectedAt = at;
  }

  /** Revoke an active or pending grant (cuts access immediately). */
  revoke(reason: string | null, at: Date = new Date()): void {
    if (this.props.status === 'revoked') {
      throw new PlatformAdminStateError('Privileged access has already been revoked');
    }
    if (this.props.status === 'rejected') {
      throw new PlatformAdminStateError('A rejected privileged-access request cannot be revoked');
    }

    this.props.status = 'revoked';
    this.props.revokedReason = reason?.trim() || null;
    this.props.revokedAt = at;
  }

  toPrimitives(at: Date = new Date()): PrivilegedAccessGrantPrimitives {
    return {
      grantId: this.props.grantId,
      adminId: this.props.adminId,
      adminName: this.props.adminName,
      scopes: [...this.props.scopes],
      justification: this.props.justification,
      breakGlass: this.props.breakGlass,
      status: this.effectiveStatus(at),
      requestedAt: this.props.requestedAt.toISOString(),
      expiresAt: this.props.expiresAt.toISOString(),
      approvedBy: this.props.approvedBy,
      approvedAt: this.props.approvedAt?.toISOString() ?? null,
      rejectedBy: this.props.rejectedBy,
      rejectedReason: this.props.rejectedReason,
      rejectedAt: this.props.rejectedAt?.toISOString() ?? null,
      revokedReason: this.props.revokedReason,
      revokedAt: this.props.revokedAt?.toISOString() ?? null,
      active: this.isActive(at),
    };
  }
}
