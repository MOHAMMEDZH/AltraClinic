import { PortalLocale } from '../../domain/value-objects/portal-preferences.vo';
import { CaregiverAccessScope } from '../../domain/value-objects/caregiver-access-scope';
import { PortalAccountStatus } from '../../domain/value-objects/portal-account-status';

export interface CaregiverAccessGrantDto {
  grantId: string;
  /** Caregiver contact PII — redacted (null) for non-owner (staff) viewers. */
  caregiverContact: string | null;
  /** Caregiver name PII — redacted (null) for non-owner (staff) viewers. */
  caregiverName: string | null;
  scopes: CaregiverAccessScope[];
  grantedBy: string;
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  status: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  caregiverUserId: string | null;
  active: boolean;
}

export interface PortalAccountDto {
  portalAccountId: string;
  tenantId: string;
  branchId: string | null;
  patientId: string;
  userId: string | null;
  status: PortalAccountStatus;
  preferences: {
    locale: PortalLocale;
    channels: { email: boolean; sms: boolean; push: boolean };
  };
  caregiverGrants: CaregiverAccessGrantDto[];
  invitedBy: string;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  deactivatedAt: string | null;
}

export interface PortalAccountPageDto {
  items: PortalAccountDto[];
  total: number;
  limit: number;
  offset: number;
}
