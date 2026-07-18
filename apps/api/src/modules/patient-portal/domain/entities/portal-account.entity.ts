import { randomUUID } from 'crypto';
import { PortalAccountStatusVO } from '../value-objects/portal-account-status.vo';
import { PortalLocale, PortalPreferencesVO } from '../value-objects/portal-preferences.vo';
import { CaregiverAccessScope } from '../value-objects/caregiver-access-scope';
import { CaregiverAccessGrant, CaregiverAccessGrantPrimitives } from './caregiver-access-grant.entity';
import { PortalStateError, PortalValidationError } from '../exceptions/portal-domain.exception';

export interface PortalAccountProps {
  portalAccountId: string;
  tenantId: string;
  branchId: string | null;
  patientId: string;
  userId: string | null;
  status: PortalAccountStatusVO;
  preferences: PortalPreferencesVO;
  caregiverGrants: CaregiverAccessGrant[];
  invitedBy: string;
  createdAt: Date;
  updatedAt: Date;
  activatedAt: Date | null;
  suspendedAt: Date | null;
  suspensionReason: string | null;
  deactivatedAt: Date | null;
}

export interface PortalAccountPrimitives {
  portalAccountId: string;
  tenantId: string;
  branchId: string | null;
  patientId: string;
  userId: string | null;
  status: string;
  preferences: {
    locale: PortalLocale;
    channels: { email: boolean; sms: boolean; push: boolean };
  };
  caregiverGrants: CaregiverAccessGrantPrimitives[];
  invitedBy: string;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  deactivatedAt: string | null;
}

/**
 * Aggregate root of the Patient Portal bounded context.
 *
 * It owns a patient's enrollment in the self-service portal: the access
 * lifecycle (`invited → active → suspended → deactivated`), the patient's
 * locale/notification preferences, and the consent-based caregiver access
 * grants. All caregiver grants are entities local to this aggregate; the
 * aggregate is the only consistency boundary for them.
 */
export class PortalAccount {
  /** Defence-in-depth cap on simultaneous caregiver delegations per account. */
  static readonly MAX_ACTIVE_CAREGIVER_GRANTS = 5;

  private readonly props: PortalAccountProps;

  private constructor(props: PortalAccountProps) {
    this.props = props;
  }

  static invite(params: {
    tenantId: string;
    branchId?: string | null;
    patientId: string;
    invitedBy: string;
    locale?: PortalLocale;
    now?: Date;
  }): PortalAccount {
    if (!params.tenantId?.trim()) {
      throw new PortalValidationError('Tenant identifier is required to invite a portal account');
    }
    if (!params.patientId?.trim()) {
      throw new PortalValidationError('Patient identifier is required to invite a portal account');
    }
    if (!params.invitedBy?.trim()) {
      throw new PortalValidationError('InvitedBy is required to invite a portal account');
    }

    const now = params.now ?? new Date();

    return new PortalAccount({
      portalAccountId: randomUUID(),
      tenantId: params.tenantId.trim(),
      branchId: params.branchId ?? null,
      patientId: params.patientId.trim(),
      userId: null,
      status: new PortalAccountStatusVO('invited'),
      preferences: PortalPreferencesVO.default(params.locale ?? 'en'),
      caregiverGrants: [],
      invitedBy: params.invitedBy.trim(),
      createdAt: now,
      updatedAt: now,
      activatedAt: null,
      suspendedAt: null,
      suspensionReason: null,
      deactivatedAt: null,
    });
  }

  static restore(props: PortalAccountProps): PortalAccount {
    return new PortalAccount(props);
  }

  // --- Identity / read accessors -------------------------------------------

  get id(): string {
    return this.props.portalAccountId;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get branchId(): string | null {
    return this.props.branchId;
  }

  get patientId(): string {
    return this.props.patientId;
  }

  get userId(): string | null {
    return this.props.userId;
  }

  get status(): PortalAccountStatusVO {
    return this.props.status;
  }

  get preferences(): PortalPreferencesVO {
    return this.props.preferences;
  }

  get invitedBy(): string {
    return this.props.invitedBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get activatedAt(): Date | null {
    return this.props.activatedAt;
  }

  get suspendedAt(): Date | null {
    return this.props.suspendedAt;
  }

  get suspensionReason(): string | null {
    return this.props.suspensionReason;
  }

  get deactivatedAt(): Date | null {
    return this.props.deactivatedAt;
  }

  /** Returns copies so callers cannot mutate aggregate-internal entities. */
  get caregiverGrants(): CaregiverAccessGrant[] {
    return [...this.props.caregiverGrants];
  }

  activeCaregiverGrants(at: Date = new Date()): CaregiverAccessGrant[] {
    return this.props.caregiverGrants.filter((grant) => grant.isActive(at));
  }

  findGrant(grantId: string): CaregiverAccessGrant | null {
    return this.props.caregiverGrants.find((grant) => grant.grantId === grantId) ?? null;
  }

  // --- Lifecycle behaviour --------------------------------------------------

  activate(userId: string, now: Date = new Date()): void {
    if (!userId?.trim()) {
      throw new PortalValidationError('A linked user identifier is required to activate a portal account');
    }
    if (this.props.status.value === 'deactivated') {
      throw new PortalStateError('A deactivated portal account cannot be reactivated; issue a new invitation');
    }
    if (this.props.status.value === 'active') {
      throw new PortalStateError('Portal account is already active');
    }
    if (this.props.status.value === 'suspended') {
      throw new PortalStateError('A suspended portal account must be reactivated, not activated');
    }

    this.props.status = new PortalAccountStatusVO('active');
    this.props.userId = userId.trim();
    this.props.activatedAt = now;
    this.touch(now);
  }

  suspend(reason: string, now: Date = new Date()): void {
    if (!reason?.trim()) {
      throw new PortalValidationError('A reason is required to suspend a portal account');
    }
    if (this.props.status.value !== 'active') {
      throw new PortalStateError('Only an active portal account can be suspended');
    }

    this.props.status = new PortalAccountStatusVO('suspended');
    this.props.suspendedAt = now;
    this.props.suspensionReason = reason.trim();
    this.touch(now);
  }

  reactivate(now: Date = new Date()): void {
    if (this.props.status.value !== 'suspended') {
      throw new PortalStateError('Only a suspended portal account can be reactivated');
    }

    this.props.status = new PortalAccountStatusVO('active');
    this.props.suspendedAt = null;
    this.props.suspensionReason = null;
    this.touch(now);
  }

  deactivate(reason: string | null, now: Date = new Date()): void {
    if (this.props.status.value === 'deactivated') {
      throw new PortalStateError('Portal account is already deactivated');
    }

    // Deactivation is terminal: revoke every still-active caregiver delegation
    // so no residual access survives the account closure.
    for (const grant of this.props.caregiverGrants) {
      if (grant.isActive(now)) {
        grant.revoke(reason ?? 'portal_account_deactivated', now);
      }
    }

    this.props.status = new PortalAccountStatusVO('deactivated');
    this.props.deactivatedAt = now;
    this.touch(now);
  }

  // --- Preferences ----------------------------------------------------------

  updatePreferences(preferences: PortalPreferencesVO, now: Date = new Date()): boolean {
    this.assertModifiable('preferences');
    if (this.props.preferences.equals(preferences)) {
      return false;
    }
    this.props.preferences = preferences;
    this.touch(now);
    return true;
  }

  // --- Caregiver access -----------------------------------------------------

  grantCaregiverAccess(params: {
    caregiverContact: string;
    caregiverName: string;
    scopes: CaregiverAccessScope[];
    grantedBy: string;
    expiresAt: Date | null;
    now?: Date;
  }): CaregiverAccessGrant {
    const now = params.now ?? new Date();
    this.assertActive('grant caregiver access');

    const contact = params.caregiverContact?.trim().toLowerCase();
    if (contact) {
      const duplicate = this.props.caregiverGrants.some(
        (grant) => grant.isActive(now) && grant.caregiverContact.toLowerCase() === contact,
      );
      if (duplicate) {
        throw new PortalStateError('This caregiver already has an active access grant');
      }
    }

    if (this.activeCaregiverGrants(now).length >= PortalAccount.MAX_ACTIVE_CAREGIVER_GRANTS) {
      throw new PortalStateError(
        `A portal account cannot have more than ${PortalAccount.MAX_ACTIVE_CAREGIVER_GRANTS} active caregiver grants`,
      );
    }

    const grant = CaregiverAccessGrant.create({
      grantId: randomUUID(),
      caregiverContact: params.caregiverContact,
      caregiverName: params.caregiverName,
      scopes: params.scopes,
      grantedBy: params.grantedBy,
      expiresAt: params.expiresAt,
      now,
    });

    this.props.caregiverGrants.push(grant);
    this.touch(now);
    return grant;
  }

  revokeCaregiverAccess(grantId: string, reason: string | null, now: Date = new Date()): CaregiverAccessGrant {
    const grant = this.findGrant(grantId);
    if (!grant) {
      throw new PortalValidationError(`Caregiver access grant ${grantId} not found`);
    }
    grant.revoke(reason, now);
    this.touch(now);
    return grant;
  }

  // --- Guards ---------------------------------------------------------------

  private assertActive(action: string): void {
    if (this.props.status.value !== 'active') {
      throw new PortalStateError(`Portal account must be active to ${action}`);
    }
  }

  private assertModifiable(what: string): void {
    if (this.props.status.value === 'deactivated') {
      throw new PortalStateError(`A deactivated portal account cannot update ${what}`);
    }
  }

  private touch(now: Date): void {
    this.props.updatedAt = now;
  }

  toPrimitives(at: Date = new Date()): PortalAccountPrimitives {
    return {
      portalAccountId: this.props.portalAccountId,
      tenantId: this.props.tenantId,
      branchId: this.props.branchId,
      patientId: this.props.patientId,
      userId: this.props.userId,
      status: this.props.status.value,
      preferences: {
        locale: this.props.preferences.locale,
        channels: { ...this.props.preferences.channels },
      },
      caregiverGrants: this.props.caregiverGrants.map((grant) => grant.toPrimitives(at)),
      invitedBy: this.props.invitedBy,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
      activatedAt: this.props.activatedAt?.toISOString() ?? null,
      suspendedAt: this.props.suspendedAt?.toISOString() ?? null,
      suspensionReason: this.props.suspensionReason,
      deactivatedAt: this.props.deactivatedAt?.toISOString() ?? null,
    };
  }
}
