import { PortalStateError, PortalValidationError } from '../exceptions/portal-domain.exception';
import {
  CaregiverAccessScope,
  isCaregiverAccessScope,
} from '../value-objects/caregiver-access-scope';
import {
  CaregiverGrantStatus,
  isCaregiverGrantStatus,
} from '../value-objects/caregiver-grant-status';

export interface CaregiverAccessGrantProps {
  grantId: string;
  caregiverContact: string;
  caregiverName: string;
  scopes: CaregiverAccessScope[];
  grantedBy: string;
  grantedAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
  status: CaregiverGrantStatus;
  invitationTokenHash: string | null;
  invitationExpiresAt: Date | null;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  caregiverUserId: string | null;
}

export interface CaregiverAccessGrantPrimitives {
  grantId: string;
  caregiverContact: string;
  caregiverName: string;
  scopes: CaregiverAccessScope[];
  grantedBy: string;
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  status: CaregiverGrantStatus;
  invitationTokenHash: string | null;
  invitationExpiresAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  caregiverUserId: string | null;
  active: boolean;
}

/**
 * Consent-based, read-only delegation of portal access from a patient to a caregiver.
 * Local to the PortalAccount aggregate (portal SoR for grants only).
 */
export class CaregiverAccessGrant {
  private readonly props: CaregiverAccessGrantProps;

  private constructor(props: CaregiverAccessGrantProps) {
    this.props = props;
  }

  static create(params: {
    grantId: string;
    caregiverContact: string;
    caregiverName: string;
    scopes: CaregiverAccessScope[];
    grantedBy: string;
    expiresAt: Date | null;
    now: Date;
    status?: CaregiverGrantStatus;
    invitationTokenHash?: string | null;
    invitationExpiresAt?: Date | null;
  }): CaregiverAccessGrant {
    const contact = params.caregiverContact?.trim();
    if (!contact) {
      throw new PortalValidationError('Caregiver contact is required to grant access');
    }
    const name = params.caregiverName?.trim();
    if (!name) {
      throw new PortalValidationError('Caregiver name is required to grant access');
    }
    if (!params.grantedBy?.trim()) {
      throw new PortalValidationError('GrantedBy is required to grant caregiver access');
    }
    if (!Array.isArray(params.scopes) || params.scopes.length === 0) {
      throw new PortalValidationError('At least one access scope is required to grant caregiver access');
    }
    const uniqueScopes = Array.from(new Set(params.scopes));
    for (const scope of uniqueScopes) {
      if (!isCaregiverAccessScope(scope)) {
        throw new PortalValidationError(`Invalid caregiver access scope: ${scope}`);
      }
    }
    if (params.expiresAt && params.expiresAt.getTime() <= params.now.getTime()) {
      throw new PortalValidationError('Caregiver access expiry must be in the future');
    }

    const status = params.status ?? 'active';
    if (!isCaregiverGrantStatus(status)) {
      throw new PortalValidationError(`Invalid caregiver grant status: ${status}`);
    }

    return new CaregiverAccessGrant({
      grantId: params.grantId,
      caregiverContact: contact,
      caregiverName: name,
      scopes: uniqueScopes,
      grantedBy: params.grantedBy.trim(),
      grantedAt: params.now,
      expiresAt: params.expiresAt,
      revokedAt: null,
      revokedReason: null,
      status,
      invitationTokenHash: params.invitationTokenHash ?? null,
      invitationExpiresAt: params.invitationExpiresAt ?? null,
      acceptedAt: status === 'active' ? params.now : null,
      declinedAt: null,
      caregiverUserId: null,
    });
  }

  static restore(props: CaregiverAccessGrantProps): CaregiverAccessGrant {
    return new CaregiverAccessGrant({
      ...props,
      status: props.status ?? (props.revokedAt ? 'revoked' : 'active'),
      invitationTokenHash: props.invitationTokenHash ?? null,
      invitationExpiresAt: props.invitationExpiresAt ?? null,
      acceptedAt: props.acceptedAt ?? null,
      declinedAt: props.declinedAt ?? null,
      caregiverUserId: props.caregiverUserId ?? null,
    });
  }

  get grantId(): string {
    return this.props.grantId;
  }

  get caregiverContact(): string {
    return this.props.caregiverContact;
  }

  get caregiverName(): string {
    return this.props.caregiverName;
  }

  get scopes(): CaregiverAccessScope[] {
    return [...this.props.scopes];
  }

  get grantedBy(): string {
    return this.props.grantedBy;
  }

  get expiresAt(): Date | null {
    return this.props.expiresAt;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }

  get status(): CaregiverGrantStatus {
    return this.props.status;
  }

  get invitationTokenHash(): string | null {
    return this.props.invitationTokenHash;
  }

  get invitationExpiresAt(): Date | null {
    return this.props.invitationExpiresAt;
  }

  get caregiverUserId(): string | null {
    return this.props.caregiverUserId;
  }

  isExpired(at: Date = new Date()): boolean {
    return Boolean(this.props.expiresAt && this.props.expiresAt.getTime() <= at.getTime());
  }

  isInvitationExpired(at: Date = new Date()): boolean {
    return Boolean(
      this.props.invitationExpiresAt && this.props.invitationExpiresAt.getTime() <= at.getTime(),
    );
  }

  isActive(at: Date = new Date()): boolean {
    if (this.props.status !== 'active') {
      return false;
    }
    if (this.props.revokedAt) {
      return false;
    }
    if (this.isExpired(at)) {
      return false;
    }
    return true;
  }

  hasScope(scope: CaregiverAccessScope): boolean {
    return this.props.scopes.includes(scope);
  }

  accept(caregiverUserId: string, at: Date = new Date()): void {
    if (this.props.status === 'revoked' || this.props.revokedAt) {
      throw new PortalStateError('Caregiver invitation has been revoked');
    }
    if (this.props.status === 'declined') {
      throw new PortalStateError('Caregiver invitation was declined');
    }
    if (this.props.status === 'active') {
      throw new PortalStateError('Caregiver grant is already active');
    }
    if (this.props.status !== 'invited') {
      throw new PortalStateError('Caregiver invitation cannot be accepted in the current state');
    }
    if (this.isInvitationExpired(at)) {
      throw new PortalStateError('Caregiver invitation has expired');
    }
    if (!caregiverUserId?.trim()) {
      throw new PortalValidationError('Caregiver user id is required to accept invitation');
    }
    this.props.status = 'active';
    this.props.acceptedAt = at;
    this.props.caregiverUserId = caregiverUserId.trim();
    this.props.invitationTokenHash = null;
  }

  decline(at: Date = new Date()): void {
    if (this.props.status !== 'invited') {
      throw new PortalStateError('Only invited caregiver grants can be declined');
    }
    if (this.isInvitationExpired(at)) {
      throw new PortalStateError('Caregiver invitation has expired');
    }
    this.props.status = 'declined';
    this.props.declinedAt = at;
    this.props.invitationTokenHash = null;
  }

  revoke(reason: string | null, at: Date = new Date()): void {
    if (this.props.revokedAt || this.props.status === 'revoked') {
      throw new PortalStateError('Caregiver access has already been revoked');
    }
    this.props.status = 'revoked';
    this.props.revokedAt = at;
    this.props.revokedReason = reason?.trim() || null;
    this.props.invitationTokenHash = null;
  }

  toPrimitives(at: Date = new Date()): CaregiverAccessGrantPrimitives {
    return {
      grantId: this.props.grantId,
      caregiverContact: this.props.caregiverContact,
      caregiverName: this.props.caregiverName,
      scopes: [...this.props.scopes],
      grantedBy: this.props.grantedBy,
      grantedAt: this.props.grantedAt.toISOString(),
      expiresAt: this.props.expiresAt?.toISOString() ?? null,
      revokedAt: this.props.revokedAt?.toISOString() ?? null,
      revokedReason: this.props.revokedReason,
      status: this.props.status,
      invitationTokenHash: this.props.invitationTokenHash,
      invitationExpiresAt: this.props.invitationExpiresAt?.toISOString() ?? null,
      acceptedAt: this.props.acceptedAt?.toISOString() ?? null,
      declinedAt: this.props.declinedAt?.toISOString() ?? null,
      caregiverUserId: this.props.caregiverUserId,
      active: this.isActive(at),
    };
  }
}
