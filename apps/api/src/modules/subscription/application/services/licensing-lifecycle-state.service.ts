import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantLicense } from '../../domain/types/tenant-license.types';
import { LicensingCommercialAuditService } from './licensing-commercial-audit.service';

/**
 * Durable license lifecycle tracking — replaces in-memory status cache.
 *
 * Persists the last known license status per tenant and records commercial audit
 * events exactly once per transition via the idempotent transition ledger.
 */
@Injectable()
export class LicensingLifecycleStateService {
  private readonly logger = new Logger(LicensingLifecycleStateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commercialAudit: LicensingCommercialAuditService,
  ) {}

  /**
   * Sets persisted lifecycle status after a platform/commercial event already audited elsewhere.
   * Prevents duplicate transition detection on subsequent resolveLicense calls.
   */
  async persistKnownStatus(
    tenantId: string,
    licenseStatus: string,
    uiPlan?: string,
  ): Promise<void> {
    await this.prisma.withTenantContext(tenantId, async (tx) => {
      await tx.tenantLicenseLifecycleState.upsert({
        where: { tenantId },
        create: {
          tenantId,
          licenseStatus,
          uiPlan: uiPlan ?? null,
        },
        update: {
          licenseStatus,
          uiPlan: uiPlan ?? null,
        },
      });
    });
  }

  /**
   * Compares resolved license status to persisted state; records audit when changed.
   * Survives process restarts — uses DB as source of truth for previous status.
   */
  async syncFromResolvedLicense(
    tenantId: string,
    license: Pick<TenantLicense, 'status' | 'uiPlan'>,
  ): Promise<void> {
    // FORCE RLS: lifecycle table policies cast app.current_tenant_id to uuid —
    // must not run with empty GUC (e.g. after a nested platform bypass cleared it).
    await this.prisma.withTenantContext(tenantId, async (tx) => {
      const existing = await tx.tenantLicenseLifecycleState.findUnique({
        where: { tenantId },
      });

      if (!existing) {
        await tx.tenantLicenseLifecycleState.create({
          data: {
            tenantId,
            licenseStatus: license.status,
            uiPlan: license.uiPlan,
          },
        });
        return;
      }

      if (existing.licenseStatus === license.status) {
        if (existing.uiPlan !== license.uiPlan) {
          await tx.tenantLicenseLifecycleState.update({
            where: { tenantId },
            data: { uiPlan: license.uiPlan },
          });
        }
        return;
      }

      const previousStatus = existing.licenseStatus;
      const newStatus = license.status;

      let transitionRecorded = false;
      try {
        await tx.licenseLifecycleTransition.create({
          data: {
            tenantId,
            previousStatus,
            newStatus,
          },
        });
        transitionRecorded = true;
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          this.logger.debug(
            `Lifecycle transition already recorded tenant=${tenantId} ${previousStatus}→${newStatus}`,
          );
        } else {
          throw error;
        }
      }

      await tx.tenantLicenseLifecycleState.update({
        where: { tenantId },
        data: {
          licenseStatus: newStatus,
          uiPlan: license.uiPlan,
        },
      });

      if (transitionRecorded) {
        await this.commercialAudit.recordLicenseStatusTransition({
          tenantId,
          previousStatus,
          newStatus,
          uiPlan: license.uiPlan,
          source: 'licensing.lifecycle.sync',
        });
      }
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    );
  }
}
