import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma.service';
import { requireAuthenticatedPrincipal } from './authenticated-principal.util';

const REGION_BYPASS_ROLES = new Set(['super_admin', 'owner', 'general_manager']);

interface RegionScopedRequest {
  headers?: Record<string, unknown>;
  user?: { id?: unknown; sub?: unknown; roles?: unknown };
}

export async function requireRegionScope(
  prisma: PrismaService,
  request: RegionScopedRequest,
  tenantId: string,
  branchId?: string,
): Promise<void> {
  if (!branchId) return;

  const principal = requireAuthenticatedPrincipal(request);
  if (principal.roles.some((role) => REGION_BYPASS_ROLES.has(role))) return;

  const [branch, user, grants] = await Promise.all([
    prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { regionId: true },
    }),
    prisma.user.findFirst({
      where: { id: principal.id, tenantId },
      select: { branchAccessMode: true },
    }),
    prisma.userRegionAccess.findMany({
      where: { userId: principal.id, tenantId },
      select: { regionId: true },
    }),
  ]);

  if (user?.branchAccessMode === 'GLOBAL') return;
  if (!branch?.regionId) return;
  if (grants.length === 0) return;

  const allowed = new Set(grants.map((g) => g.regionId));
  if (!allowed.has(branch.regionId)) {
    throw new ForbiddenException('You do not have access to resources in this region.');
  }
}
