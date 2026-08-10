import { PrismaClient } from '@prisma/client';

export function settled(results: PromiseSettledResult<unknown>[]) {
  const ok = results.filter((r) => r.status === 'fulfilled');
  const bad = results.filter((r) => r.status === 'rejected');
  return { ok, bad };
}

export function errCode(err: unknown): string {
  if (!err || typeof err !== 'object') return String(err);
  const e = err as {
    code?: string;
    response?: { code?: string; message?: string };
    message?: string;
  };
  return e.code ?? e.response?.code ?? e.message ?? String(err);
}

export async function raceEvidence(prisma: PrismaClient, requestId?: string) {
  const requests = await prisma.platformTenantProvisioningRequest.findMany({
    where: requestId ? { id: requestId } : undefined,
  });
  const tenantIds = requests.map((r) => r.tenantId).filter(Boolean) as string[];
  const configIds = requests.map((r) => r.commercialConfigId).filter(Boolean) as string[];
  const invitationIds = requests.map((r) => r.invitationId).filter(Boolean) as string[];
  const [tenantCount, commercialCount, snapshotCount, idempotencyCompleted, owned, auditCount] =
    await Promise.all([
      tenantIds.length
        ? prisma.tenant.count({ where: { id: { in: tenantIds } } })
        : Promise.resolve(0),
      configIds.length
        ? prisma.platformSubscriptionCommercialConfig.count({ where: { id: { in: configIds } } })
        : Promise.resolve(0),
      configIds.length
        ? prisma.platformSubscriptionCommercialSnapshot.count({
            where: { configId: { in: configIds } },
          })
        : Promise.resolve(0),
      prisma.platformTenantProvisioningIdempotencyRecord.count({
        where: {
          status: 'COMPLETED',
          ...(requestId ? { resultResourceId: requestId } : {}),
        },
      }),
      requestId
        ? prisma.platformTenantProvisioningOwnedResource.count({ where: { requestId } })
        : prisma.platformTenantProvisioningOwnedResource.count(),
      prisma.auditEntry.count({
        where: {
          resourceType: 'tenant_provisioning',
          ...(requestId ? { resourceId: requestId } : {}),
        },
      }),
    ]);
  const row = requestId
    ? await prisma.platformTenantProvisioningRequest.findUnique({ where: { id: requestId } })
    : null;
  let tenantAccessible = false;
  if (row?.tenantId) {
    const t = await prisma.tenant.findUnique({ where: { id: row.tenantId } });
    const pt = row.platformTenantId
      ? await prisma.platformTenant.findUnique({ where: { id: row.platformTenantId } })
      : null;
    tenantAccessible = t?.status === 'ACTIVE' && pt?.status === 'ACTIVE';
  }
  return {
    requests,
    row,
    tenantCount,
    commercialCount,
    snapshotCount,
    invitationCount: invitationIds.length,
    idempotencyCompleted,
    owned,
    auditCount,
    tenantAccessible,
    status: row?.status ?? null,
    rowVersion: row?.rowVersion ?? null,
  };
}
