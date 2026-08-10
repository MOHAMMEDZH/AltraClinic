import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PREVIEW_TTL_MS } from '../tenant-lifecycle.constants';
import type { LifecycleAction, PlatformTenantLifecycleStatus } from '../domain/tenant-lifecycle.types';

export type LifecycleImpactPreview = {
  tenantId: string;
  platformTenantId: string;
  displayName: string;
  currentStatus: PlatformTenantLifecycleStatus;
  proposedAction: LifecycleAction;
  proposedStatus: string | null;
  commercialLifecycleSummary: string | null;
  eerProvenanceCode: string | null;
  activeSessionCount: number;
  activeUserCount: number;
  moduleCount: number | null;
  featureCount: number | null;
  jobPolicySummary: string;
  integrationSummary: string;
  retentionBackupWarnings: string[];
  blockers: string[];
  requiredApprovals: boolean;
  reversible: boolean;
  irreversibleClassification: 'reversible' | 'soft_terminal' | 'handoff_only';
  previewFingerprint: string;
  expiresAt: string;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

@Injectable()
export class TenantLifecyclePreviewService {
  constructor(private readonly prisma: PrismaService) {}

  async build(input: {
    tenantId: string;
    action: LifecycleAction;
  }): Promise<LifecycleImpactPreview> {
    const pt = await this.prisma.withPlatformBypass((c) =>
      c.platformTenant.findUnique({ where: { tenantId: input.tenantId } }),
    );
    if (!pt) {
      throw Object.assign(new Error('Tenant not found'), { code: 'tenant_not_found' });
    }

    const [sessionCount, userCount, pendingArchive, pendingDelete, openProv] =
      await this.prisma.withPlatformBypass(async (c) => {
        const sessions = await c.refreshToken.count({
          where: { tenantId: input.tenantId, revokedAt: null, expiresAt: { gt: new Date() } },
        });
        const users = await c.user.count({
          where: { tenantId: input.tenantId, deletedAt: null, isActive: true },
        });
        const archive = await c.platformTenantLifecycleRequest.findFirst({
          where: { tenantId: input.tenantId, type: 'ARCHIVE', status: 'PENDING' },
        });
        const del = await c.platformTenantLifecycleRequest.findFirst({
          where: { tenantId: input.tenantId, type: 'DELETE', status: 'PENDING' },
        });
        const prov = await c.platformTenantProvisioningRequest.findFirst({
          where: {
            tenantId: input.tenantId,
            status: { notIn: ['COMPLETED', 'COMPENSATED', 'CANCELLED_BEFORE_ACTIVATION', 'FAILED_TERMINAL'] },
          },
        });
        return [sessions, users, archive, del, prov] as const;
      });

    const blockers: string[] = [];
    const status = pt.status as PlatformTenantLifecycleStatus;
    let proposedStatus: string | null = null;
    let requiredApprovals = false;
    let reversible = true;
    let irreversibleClassification: LifecycleImpactPreview['irreversibleClassification'] =
      'reversible';

    if (input.action === 'activate') {
      proposedStatus = 'ACTIVE';
      if (status !== 'PROVISIONING') blockers.push('status_not_provisioning');
      if (openProv) blockers.push('step17_workflow_incomplete');
      if (pendingDelete) blockers.push('deletion_request_active');
    } else if (input.action === 'suspend') {
      proposedStatus = 'SUSPENDED';
      if (status !== 'ACTIVE') blockers.push('status_not_active');
      if (pendingArchive) blockers.push('archive_request_active');
    } else if (input.action === 'reactivate') {
      proposedStatus = 'ACTIVE';
      if (status !== 'SUSPENDED') blockers.push('status_not_suspended');
      if (pendingArchive) blockers.push('archive_request_active');
      if (pendingDelete) blockers.push('deletion_request_active');
    } else if (input.action === 'archive_request') {
      proposedStatus = null;
      requiredApprovals = true;
      reversible = true;
      irreversibleClassification = 'soft_terminal';
      if (status === 'ARCHIVED') blockers.push('already_archived');
      if (status === 'PROVISIONING' && openProv) blockers.push('step17_workflow_incomplete');
      if (pendingArchive) blockers.push('archive_request_already_pending');
      if (pendingDelete) blockers.push('deletion_request_active');
    } else if (input.action === 'deletion_request') {
      proposedStatus = null;
      requiredApprovals = true;
      reversible = true;
      irreversibleClassification = 'handoff_only';
      if (status !== 'ARCHIVED') blockers.push('must_be_archived');
      if (pendingDelete) blockers.push('deletion_request_already_pending');
    }

    const body = {
      tenantId: input.tenantId,
      platformTenantId: pt.id,
      currentStatus: status,
      proposedAction: input.action,
      proposedStatus,
      rowVersion: pt.rowVersion,
      sessionCount,
      userCount,
      blockers,
    };
    const previewFingerprint = createHash('sha256').update(stableStringify(body)).digest('hex');

    return {
      tenantId: input.tenantId,
      platformTenantId: pt.id,
      displayName: pt.displayName,
      currentStatus: status,
      proposedAction: input.action,
      proposedStatus,
      commercialLifecycleSummary: null,
      eerProvenanceCode: null,
      activeSessionCount: sessionCount,
      activeUserCount: userCount,
      moduleCount: null,
      featureCount: null,
      jobPolicySummary: 'workers_deny_when_license_suspended',
      integrationSummary: 'licensing_gate_unchanged',
      retentionBackupWarnings: [
        'No backup deletion occurs.',
        'Audit and commercial history are retained.',
      ],
      blockers,
      requiredApprovals,
      reversible,
      irreversibleClassification,
      previewFingerprint,
      expiresAt: new Date(Date.now() + PREVIEW_TTL_MS).toISOString(),
    };
  }
}

