import { PortalAccount } from '../../domain/entities/portal-account.entity';
import { CaregiverAccessGrantDto, PortalAccountDto } from '../dto/portal-account.dto';

export interface PortalAccountProjectionOptions {
  /**
   * Whether the viewer owns the account. Caregiver contact details are personal
   * PII (family members' email/phone): only the owning patient sees them.
   * Staff (non-owner) viewers receive grant metadata with the contact redacted,
   * honouring data minimization (SECURITY.md).
   */
  viewerIsOwner: boolean;
  at?: Date;
}

/**
 * Maps the {@link PortalAccount} aggregate to its read DTO. Centralized so the
 * get/list query handlers never duplicate projection logic. Caregiver PII is
 * redacted for non-owner viewers.
 */
export function toPortalAccountDto(
  account: PortalAccount,
  options: PortalAccountProjectionOptions,
): PortalAccountDto {
  const primitives = account.toPrimitives(options.at ?? new Date());
  const caregiverGrants: CaregiverAccessGrantDto[] = primitives.caregiverGrants.map((grant) => ({
    ...grant,
    caregiverContact: options.viewerIsOwner ? grant.caregiverContact : null,
    caregiverName: options.viewerIsOwner ? grant.caregiverName : null,
  }));

  return {
    portalAccountId: primitives.portalAccountId,
    tenantId: primitives.tenantId,
    branchId: primitives.branchId,
    patientId: primitives.patientId,
    userId: primitives.userId,
    status: account.status.value,
    preferences: {
      locale: primitives.preferences.locale,
      channels: primitives.preferences.channels,
    },
    caregiverGrants,
    invitedBy: primitives.invitedBy,
    createdAt: primitives.createdAt,
    updatedAt: primitives.updatedAt,
    activatedAt: primitives.activatedAt,
    suspendedAt: primitives.suspendedAt,
    suspensionReason: primitives.suspensionReason,
    deactivatedAt: primitives.deactivatedAt,
  };
}
