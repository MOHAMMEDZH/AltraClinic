import { Injectable } from '@nestjs/common';
import { PortalAccountStatus as PrismaPortalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PortalAccount } from '../domain/entities/portal-account.entity';
import { CaregiverAccessGrant } from '../domain/entities/caregiver-access-grant.entity';
import {
  PortalAccountFilter,
  PortalAccountPage,
  PortalAccountRepository,
} from '../domain/repositories/portal-account.repository.interface';
import { PortalAccountStatusVO } from '../domain/value-objects/portal-account-status.vo';
import { PortalAccountStatus } from '../domain/value-objects/portal-account-status';
import { PortalPreferencesVO } from '../domain/value-objects/portal-preferences.vo';
import { CaregiverAccessScope } from '../domain/value-objects/caregiver-access-scope';

type PrismaPortalAccountRow = Prisma.PortalAccountGetPayload<{
  include: { caregiverGrants: true };
}>;

const DOMAIN_STATUS_TO_PRISMA: Record<PortalAccountStatus, PrismaPortalStatus> = {
  invited: 'INVITED',
  active: 'ACTIVE',
  suspended: 'SUSPENDED',
  deactivated: 'DEACTIVATED',
};

const PRISMA_STATUS_TO_DOMAIN: Record<PrismaPortalStatus, PortalAccountStatus> = {
  INVITED: 'invited',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DEACTIVATED: 'deactivated',
};

@Injectable()
export class PrismaPortalAccountRepository implements PortalAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(account: PortalAccount): Promise<void> {
    const prefs = account.preferences;

    await this.prisma.$transaction(async (tx) => {
      await tx.portalAccount.upsert({
        where: { id: account.id },
        create: {
          id: account.id,
          tenantId: account.tenantId,
          branchId: account.branchId,
          patientId: account.patientId,
          userId: account.userId,
          status: DOMAIN_STATUS_TO_PRISMA[account.status.value],
          locale: prefs.locale,
          notifyEmail: prefs.channels.email,
          notifySms: prefs.channels.sms,
          notifyPush: prefs.channels.push,
          invitedBy: account.invitedBy,
          enrollmentTokenHash: account.enrollmentTokenHash,
          enrollmentTokenExpiresAt: account.enrollmentTokenExpiresAt,
          enrollmentConsentAt: account.enrollmentConsentAt,
          activatedAt: account.activatedAt,
          suspendedAt: account.suspendedAt,
          suspensionReason: account.suspensionReason,
          deactivatedAt: account.deactivatedAt,
          createdAt: account.createdAt,
        },
        update: {
          userId: account.userId,
          status: DOMAIN_STATUS_TO_PRISMA[account.status.value],
          locale: prefs.locale,
          notifyEmail: prefs.channels.email,
          notifySms: prefs.channels.sms,
          notifyPush: prefs.channels.push,
          enrollmentTokenHash: account.enrollmentTokenHash,
          enrollmentTokenExpiresAt: account.enrollmentTokenExpiresAt,
          enrollmentConsentAt: account.enrollmentConsentAt,
          activatedAt: account.activatedAt,
          suspendedAt: account.suspendedAt,
          suspensionReason: account.suspensionReason,
          deactivatedAt: account.deactivatedAt,
          updatedAt: account.updatedAt,
        },
      });

      for (const grant of account.caregiverGrants) {
        const p = grant.toPrimitives();
        await tx.caregiverAccessGrant.upsert({
          where: { id: grant.grantId },
          create: {
            id: grant.grantId,
            portalAccountId: account.id,
            caregiverContact: grant.caregiverContact,
            caregiverName: grant.caregiverName,
            scopes: grant.scopes,
            grantedBy: p.grantedBy,
            grantedAt: new Date(p.grantedAt),
            expiresAt: p.expiresAt ? new Date(p.expiresAt) : null,
            revokedAt: p.revokedAt ? new Date(p.revokedAt) : null,
            revokedReason: p.revokedReason ?? null,
            status: p.status,
            invitationTokenHash: p.invitationTokenHash,
            invitationExpiresAt: p.invitationExpiresAt ? new Date(p.invitationExpiresAt) : null,
            acceptedAt: p.acceptedAt ? new Date(p.acceptedAt) : null,
            declinedAt: p.declinedAt ? new Date(p.declinedAt) : null,
            caregiverUserId: p.caregiverUserId,
          },
          update: {
            revokedAt: p.revokedAt ? new Date(p.revokedAt) : null,
            revokedReason: p.revokedReason ?? null,
            status: p.status,
            invitationTokenHash: p.invitationTokenHash,
            invitationExpiresAt: p.invitationExpiresAt ? new Date(p.invitationExpiresAt) : null,
            acceptedAt: p.acceptedAt ? new Date(p.acceptedAt) : null,
            declinedAt: p.declinedAt ? new Date(p.declinedAt) : null,
            caregiverUserId: p.caregiverUserId,
            scopes: grant.scopes,
          },
        });
      }
    });
  }

  async findById(portalAccountId: string, tenantId: string): Promise<PortalAccount | null> {
    const row = await this.prisma.portalAccount.findFirst({
      where: { id: portalAccountId, tenantId },
      include: { caregiverGrants: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByPatientId(patientId: string, tenantId: string): Promise<PortalAccount | null> {
    const row = await this.prisma.portalAccount.findFirst({
      where: { patientId, tenantId },
      include: { caregiverGrants: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByUserId(userId: string, tenantId: string): Promise<PortalAccount | null> {
    const row = await this.prisma.portalAccount.findFirst({
      where: { userId, tenantId },
      include: { caregiverGrants: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByEnrollmentTokenHash(
    tokenHash: string,
    tenantId: string,
  ): Promise<PortalAccount | null> {
    const row = await this.prisma.portalAccount.findFirst({
      where: { enrollmentTokenHash: tokenHash, tenantId },
      include: { caregiverGrants: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(filter: PortalAccountFilter): Promise<PortalAccountPage> {
    const where: Prisma.PortalAccountWhereInput = {
      tenantId: filter.tenantId,
      ...(filter.branchId ? { branchId: filter.branchId } : {}),
      ...(filter.patientId ? { patientId: filter.patientId } : {}),
      ...(filter.status
        ? { status: DOMAIN_STATUS_TO_PRISMA[filter.status as PortalAccountStatus] }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.portalAccount.findMany({
        where,
        include: { caregiverGrants: true },
        orderBy: { createdAt: 'desc' },
        skip: filter.offset,
        take: filter.limit,
      }),
      this.prisma.portalAccount.count({ where }),
    ]);

    return {
      items: items.map((r) => this.toDomain(r)),
      total,
      limit: filter.limit,
      offset: filter.offset,
    };
  }

  private toDomain(row: PrismaPortalAccountRow): PortalAccount {
    const caregiverGrants = row.caregiverGrants.map((g) =>
      CaregiverAccessGrant.restore({
        grantId: g.id,
        caregiverContact: g.caregiverContact,
        caregiverName: g.caregiverName,
        scopes: g.scopes as CaregiverAccessScope[],
        grantedBy: g.grantedBy,
        grantedAt: g.grantedAt,
        expiresAt: g.expiresAt,
        revokedAt: g.revokedAt,
        revokedReason: g.revokedReason,
        status: ((g as { status?: string }).status as 'invited' | 'active' | 'declined' | 'revoked') ??
          (g.revokedAt ? 'revoked' : 'active'),
        invitationTokenHash: (g as { invitationTokenHash?: string | null }).invitationTokenHash ?? null,
        invitationExpiresAt: (g as { invitationExpiresAt?: Date | null }).invitationExpiresAt ?? null,
        acceptedAt: (g as { acceptedAt?: Date | null }).acceptedAt ?? null,
        declinedAt: (g as { declinedAt?: Date | null }).declinedAt ?? null,
        caregiverUserId: (g as { caregiverUserId?: string | null }).caregiverUserId ?? null,
      }),
    );

    const preferences = new PortalPreferencesVO(row.locale, {
      email: row.notifyEmail,
      sms: row.notifySms,
      push: row.notifyPush,
    });

    return PortalAccount.restore({
      portalAccountId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      patientId: row.patientId,
      userId: row.userId,
      status: new PortalAccountStatusVO(PRISMA_STATUS_TO_DOMAIN[row.status]),
      preferences,
      caregiverGrants,
      invitedBy: row.invitedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      activatedAt: row.activatedAt,
      suspendedAt: row.suspendedAt,
      suspensionReason: row.suspensionReason,
      deactivatedAt: row.deactivatedAt,
      enrollmentTokenHash: row.enrollmentTokenHash ?? null,
      enrollmentTokenExpiresAt: row.enrollmentTokenExpiresAt ?? null,
      enrollmentConsentAt: row.enrollmentConsentAt ?? null,
    });
  }
}
