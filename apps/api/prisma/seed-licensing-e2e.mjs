/**
 * Deterministic licensing E2E tenants — one per commercial lifecycle state.
 * Imported from prisma/seed.mjs after demo clinic bootstrap.
 */
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const GRACE_DAYS = 7;
const DAY_MS = 86_400_000;

export const LIC_E2E_PASSWORD = 'LicE2e123!';

export const LIC_E2E_TENANTS = {
  licensed: {
    tenantId: 'b1000000-0000-4000-8000-000000000101',
    platformTenantId: 'b1000000-0000-4000-8000-000000000201',
    subscriptionId: 'b1000000-0000-4000-8000-000000000301',
    branchId: 'b1000000-0000-4000-8000-000000000401',
    ownerId: 'b1000000-0000-4000-8000-000000000501',
    email: 'licensed@lic-e2e.clinic',
    slug: 'lic-e2e-licensed',
    name: 'E2E Licensed Clinic',
  },
  trial: {
    tenantId: 'b1000000-0000-4000-8000-000000000102',
    platformTenantId: 'b1000000-0000-4000-8000-000000000202',
    subscriptionId: 'b1000000-0000-4000-8000-000000000302',
    branchId: 'b1000000-0000-4000-8000-000000000402',
    ownerId: 'b1000000-0000-4000-8000-000000000502',
    email: 'trial@lic-e2e.clinic',
    slug: 'lic-e2e-trial',
    name: 'E2E Trial Clinic',
  },
  grace: {
    tenantId: 'b1000000-0000-4000-8000-000000000103',
    platformTenantId: 'b1000000-0000-4000-8000-000000000203',
    subscriptionId: 'b1000000-0000-4000-8000-000000000303',
    branchId: 'b1000000-0000-4000-8000-000000000403',
    ownerId: 'b1000000-0000-4000-8000-000000000503',
    email: 'grace@lic-e2e.clinic',
    slug: 'lic-e2e-grace',
    name: 'E2E Grace Clinic',
  },
  expired: {
    tenantId: 'b1000000-0000-4000-8000-000000000104',
    platformTenantId: 'b1000000-0000-4000-8000-000000000204',
    subscriptionId: 'b1000000-0000-4000-8000-000000000304',
    branchId: 'b1000000-0000-4000-8000-000000000404',
    ownerId: 'b1000000-0000-4000-8000-000000000504',
    email: 'expired@lic-e2e.clinic',
    slug: 'lic-e2e-expired',
    name: 'E2E Expired Clinic',
  },
  suspended: {
    tenantId: 'b1000000-0000-4000-8000-000000000105',
    platformTenantId: 'b1000000-0000-4000-8000-000000000205',
    subscriptionId: 'b1000000-0000-4000-8000-000000000305',
    branchId: 'b1000000-0000-4000-8000-000000000405',
    ownerId: 'b1000000-0000-4000-8000-000000000505',
    email: 'suspended@lic-e2e.clinic',
    slug: 'lic-e2e-suspended',
    name: 'E2E Suspended Clinic',
  },
  cancelled: {
    tenantId: 'b1000000-0000-4000-8000-000000000106',
    platformTenantId: 'b1000000-0000-4000-8000-000000000206',
    subscriptionId: 'b1000000-0000-4000-8000-000000000306',
    branchId: 'b1000000-0000-4000-8000-000000000406',
    ownerId: 'b1000000-0000-4000-8000-000000000506',
    email: 'cancelled@lic-e2e.clinic',
    slug: 'lic-e2e-cancelled',
    name: 'E2E Cancelled Clinic',
  },
  enterprise: {
    tenantId: 'b1000000-0000-4000-8000-000000000107',
    platformTenantId: 'b1000000-0000-4000-8000-000000000207',
    subscriptionId: 'b1000000-0000-4000-8000-000000000307',
    branchId: 'b1000000-0000-4000-8000-000000000407',
    ownerId: 'b1000000-0000-4000-8000-000000000507',
    email: 'enterprise@lic-e2e.clinic',
    slug: 'lic-e2e-enterprise',
    name: 'E2E Enterprise Clinic',
  },
  starter: {
    tenantId: 'b1000000-0000-4000-8000-000000000108',
    platformTenantId: 'b1000000-0000-4000-8000-000000000208',
    subscriptionId: 'b1000000-0000-4000-8000-000000000308',
    branchId: 'b1000000-0000-4000-8000-000000000408',
    ownerId: 'b1000000-0000-4000-8000-000000000508',
    email: 'starter@lic-e2e.clinic',
    slug: 'lic-e2e-starter',
    name: 'E2E Starter Clinic',
  },
  professional: {
    tenantId: 'b1000000-0000-4000-8000-000000000109',
    platformTenantId: 'b1000000-0000-4000-8000-000000000209',
    subscriptionId: 'b1000000-0000-4000-8000-000000000309',
    branchId: 'b1000000-0000-4000-8000-000000000409',
    ownerId: 'b1000000-0000-4000-8000-000000000509',
    email: 'professional@lic-e2e.clinic',
    slug: 'lic-e2e-professional',
    name: 'E2E Professional Clinic',
  },
};

async function upsertLicenseTenant(prisma, spec, config) {
  const passwordHash = await bcrypt.hash(LIC_E2E_PASSWORD, 12);
  const now = Date.now();

  await prisma.tenant.upsert({
    where: { id: spec.tenantId },
    create: {
      id: spec.tenantId,
      name: spec.name,
      slug: spec.slug,
      status: config.tenantStatus ?? 'ACTIVE',
      lifecycleStatus: config.lifecycleStatus ?? 'ACTIVE',
      timezone: 'Asia/Damascus',
      locale: 'en-US',
      trialStartedAt: config.trialStartedAt ?? null,
      trialEndsAt: config.trialEndsAt ?? null,
      features: config.features ?? {},
    },
    update: {
      name: spec.name,
      status: config.tenantStatus ?? 'ACTIVE',
      lifecycleStatus: config.lifecycleStatus ?? 'ACTIVE',
      trialStartedAt: config.trialStartedAt ?? null,
      trialEndsAt: config.trialEndsAt ?? null,
      features: config.features ?? {},
    },
  });

  await prisma.branch.upsert({
    where: { id: spec.branchId },
    create: {
      id: spec.branchId,
      tenantId: spec.tenantId,
      name: 'Main',
      isActive: true,
    },
    update: { name: 'Main', isActive: true },
  });

  await prisma.platformTenant.upsert({
    where: { tenantId: spec.tenantId },
    create: {
      id: spec.platformTenantId,
      tenantId: spec.tenantId,
      displayName: spec.name,
      region: 'ME_SOUTH',
      plan: config.platformPlan,
      maxBranches: config.maxBranches ?? 10,
      maxUsers: config.maxUsers ?? 100,
      status: config.platformStatus,
      provisionedBy: spec.ownerId,
      activatedAt: config.platformStatus === 'ACTIVE' ? new Date() : null,
      suspendedAt: config.suspendedAt ?? null,
      suspensionReason: config.suspensionReason ?? null,
      archivedAt: config.archivedAt ?? null,
      archivedReason: config.archivedReason ?? null,
      trialEndsAt: config.trialEndsAt ?? null,
      contractEndDate: config.contractEndDate ?? null,
    },
    update: {
      displayName: spec.name,
      plan: config.platformPlan,
      status: config.platformStatus,
      suspendedAt: config.suspendedAt ?? null,
      suspensionReason: config.suspensionReason ?? null,
      archivedAt: config.archivedAt ?? null,
      trialEndsAt: config.trialEndsAt ?? null,
      contractEndDate: config.contractEndDate ?? null,
    },
  });

  await prisma.platformSubscription.upsert({
    where: { id: spec.subscriptionId },
    create: {
      id: spec.subscriptionId,
      platformTenantId: spec.platformTenantId,
      plan: config.platformPlan,
      status: config.subscriptionStatus,
      billingCycleMonths: 12,
      pricePerMonth: 299,
      currency: 'USD',
      startDate: new Date(now - 365 * DAY_MS),
      endDate: config.subscriptionEndDate ?? new Date(now + 365 * DAY_MS),
      paidManuallyBy: spec.ownerId,
      paidManuallyAt: new Date(),
      paymentReference: `E2E-${spec.slug}`,
    },
    update: {
      plan: config.platformPlan,
      status: config.subscriptionStatus,
      endDate: config.subscriptionEndDate ?? new Date(now + 365 * DAY_MS),
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: spec.tenantId, email: spec.email } },
    create: {
      id: spec.ownerId,
      tenantId: spec.tenantId,
      branchId: spec.branchId,
      email: spec.email,
      passwordHash,
      firstName: 'E2E',
      lastName: spec.slug,
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roles: { create: [{ id: randomUUID(), role: 'OWNER' }] },
    },
    update: {
      passwordHash,
      isActive: true,
      emailVerified: true,
      branchId: spec.branchId,
    },
  });

  const existingRole = await prisma.userRoleAssignment.findFirst({
    where: { userId: spec.ownerId, role: 'OWNER' },
  });
  if (!existingRole) {
    await prisma.userRoleAssignment.create({
      data: { id: randomUUID(), userId: spec.ownerId, role: 'OWNER' },
    });
  }
}

export async function seedLicensingE2eTenants(prisma) {
  const now = Date.now();
  const passwordHash = await bcrypt.hash(LIC_E2E_PASSWORD, 12);
  void passwordHash;

  await upsertLicenseTenant(prisma, LIC_E2E_TENANTS.licensed, {
    platformPlan: 'PRO',
    platformStatus: 'ACTIVE',
    subscriptionStatus: 'ACTIVE',
    features: { subscriptionUiPlan: 'professional' },
    subscriptionEndDate: new Date(now + 365 * DAY_MS),
  });

  await upsertLicenseTenant(prisma, LIC_E2E_TENANTS.trial, {
    platformPlan: 'PRO',
    platformStatus: 'ACTIVE',
    subscriptionStatus: 'TRIAL',
    trialStartedAt: new Date(now - 3 * DAY_MS),
    trialEndsAt: new Date(now + 14 * DAY_MS),
    features: { subscriptionUiPlan: 'professional' },
    subscriptionEndDate: new Date(now + 14 * DAY_MS),
  });

  await upsertLicenseTenant(prisma, LIC_E2E_TENANTS.grace, {
    platformPlan: 'PRO',
    platformStatus: 'ACTIVE',
    subscriptionStatus: 'ACTIVE',
    features: { subscriptionUiPlan: 'professional' },
    contractEndDate: new Date(now - 2 * DAY_MS),
    subscriptionEndDate: new Date(now - 2 * DAY_MS),
  });

  await upsertLicenseTenant(prisma, LIC_E2E_TENANTS.expired, {
    platformPlan: 'PRO',
    platformStatus: 'ACTIVE',
    subscriptionStatus: 'EXPIRED',
    features: { subscriptionUiPlan: 'professional' },
    contractEndDate: new Date(now - (GRACE_DAYS + 3) * DAY_MS),
    subscriptionEndDate: new Date(now - (GRACE_DAYS + 3) * DAY_MS),
  });

  await upsertLicenseTenant(prisma, LIC_E2E_TENANTS.suspended, {
    platformPlan: 'PRO',
    platformStatus: 'SUSPENDED',
    subscriptionStatus: 'SUSPENDED',
    suspendedAt: new Date(now - DAY_MS),
    suspensionReason: 'E2E suspension fixture',
    features: { subscriptionUiPlan: 'professional' },
  });

  await upsertLicenseTenant(prisma, LIC_E2E_TENANTS.cancelled, {
    platformPlan: 'PRO',
    platformStatus: 'ACTIVE',
    subscriptionStatus: 'CANCELLED',
    features: { subscriptionUiPlan: 'professional' },
    subscriptionEndDate: new Date(now - DAY_MS),
  });

  await upsertLicenseTenant(prisma, LIC_E2E_TENANTS.enterprise, {
    platformPlan: 'ENTERPRISE',
    platformStatus: 'ACTIVE',
    subscriptionStatus: 'ACTIVE',
    features: { subscriptionUiPlan: 'enterprise' },
    maxBranches: null,
    maxUsers: null,
  });

  await upsertLicenseTenant(prisma, LIC_E2E_TENANTS.starter, {
    platformPlan: 'LITE',
    platformStatus: 'ACTIVE',
    subscriptionStatus: 'ACTIVE',
    features: { subscriptionUiPlan: 'starter' },
  });

  await upsertLicenseTenant(prisma, LIC_E2E_TENANTS.professional, {
    platformPlan: 'PRO',
    platformStatus: 'ACTIVE',
    subscriptionStatus: 'ACTIVE',
    features: { subscriptionUiPlan: 'professional' },
  });

  console.log('Seeded licensing E2E tenants (lic-e2e-*.clinic)');
}
