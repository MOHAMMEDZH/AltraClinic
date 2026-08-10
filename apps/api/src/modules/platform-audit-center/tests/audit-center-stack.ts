/**
 * Flexible Step 21 — Audit Center service stack factory (kept separate from harness
 * to avoid Jest CJS circular TDZ on re-exported harness bindings).
 */
import { ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import { createSubscriptionsPrismaWrapper } from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import { AuditCenterQueryService } from '../application/audit-center-query.service';
import { AuditCenterEvidenceService } from '../application/audit-center-evidence.service';
import { AuditCenterExportService } from '../application/audit-center-export.service';
import { AuditCenterRateLimitService } from '../application/audit-center-rate-limit.service';
import { AUDIT_CENTER_PERMISSIONS } from '../platform-audit-center.constants';

const DEFAULT_PERMS = [
  AUDIT_CENTER_PERMISSIONS.view,
  AUDIT_CENTER_PERMISSIONS.export,
  AUDIT_CENTER_PERMISSIONS.sensitiveView,
  AUDIT_CENTER_PERMISSIONS.networkMetadataView,
];

export type AuditStack = {
  query: AuditCenterQueryService;
  evidence: AuditCenterEvidenceService;
  exports: AuditCenterExportService;
  perms: Set<string>;
  setStepUpFresh: (fresh: boolean) => void;
};

function createHybridPrisma(prisma: PrismaClient): PrismaService {
  return Object.assign(prisma, createSubscriptionsPrismaWrapper(prisma)) as unknown as PrismaService;
}

export function createAuditStack(
  prisma: PrismaClient,
  opts: { permissions?: string[]; exportRateLimit?: number } = {},
): AuditStack {
  const wrapped = createHybridPrisma(prisma);
  const perms = new Set(opts.permissions ?? DEFAULT_PERMS);
  let stepUpFresh = true;
  const assurance = {
    requireStepUp: () => {
      if (!stepUpFresh) {
        throw new ForbiddenException({
          code: 'PLATFORM_STEP_UP_REQUIRED',
          message: 'Step-up verification is required for this action.',
        });
      }
    },
  } as unknown as PlatformAssuranceService;
  const platformSessions = {
    findBySessionId: async (sessionId: string) =>
      sessionId ? { sessionId, stepUpVerifiedAt: stepUpFresh ? new Date() : null } : null,
  };
  const rateLimit = new AuditCenterRateLimitService();
  if (opts.exportRateLimit != null) rateLimit.setExportLimit(opts.exportRateLimit);
  const query = new AuditCenterQueryService(wrapped);
  const evidence = new AuditCenterEvidenceService(wrapped);
  const exports = new AuditCenterExportService(
    wrapped,
    query,
    rateLimit,
    assurance,
    platformSessions as never,
  );
  return {
    query,
    evidence,
    exports,
    perms,
    setStepUpFresh: (fresh: boolean) => {
      stepUpFresh = fresh;
    },
  };
}
