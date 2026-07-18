import { PortalStateError, PortalValidationError } from '../exceptions/portal-domain.exception';
import {
  CaregiverAccessScope,
  isCaregiverAccessScope,
} from '../value-objects/caregiver-access-scope';

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
  active: boolean;
}

/**
 * A consent-based, read-only delegation of portal access from a patient to a
 * caregiver (family member). It is an entity local to the {@link PortalAccount}
 * aggregate — it has identity and lifecycle but is never persisted or mutated
 * independently of its aggregate root.
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
    });
  }

  static restore(props: CaregiverAccessGrantProps): CaregiverAccessGrant {
    return new CaregiverAccessGrant(props);
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

  isActive(at: Date = new Date()): boolean {
    if (this.props.revokedAt) {
      return false;
    }
    if (this.props.expiresAt && this.props.expiresAt.getTime() <= at.getTime()) {
      return false;
    }
    return true;
  }

  hasScope(scope: CaregiverAccessScope): boolean {
    return this.props.scopes.includes(scope);
  }

  revoke(reason: string | null, at: Date = new Date()): void {
    if (this.props.revokedAt) {
      throw new PortalStateError('Caregiver access has already been revoked');
    }
    this.props.revokedAt = at;
    this.props.revokedReason = reason?.trim() || null;
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
      active: this.isActive(at),
    };
  }
}
