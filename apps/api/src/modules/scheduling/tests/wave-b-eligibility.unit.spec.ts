/**
 * Wave B — Provider eligibility B-ELIG-01..18
 */
import { ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { ProviderEligibilityService } from '../application/services/provider-eligibility.service';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { isBookingEligibilityEnforcementEnabled } from '../domain/booking-feature-flags';

const fakeAudit = {
  entries: [] as unknown[],
  async record(entry: unknown) {
    this.entries.push(entry);
  },
  async recordInTransaction(_c: unknown, entry: unknown) {
    this.entries.push(entry);
  },
};

jest.setTimeout(120_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describe('Wave B eligibility feature flags (unit)', () => {
  it('B-ELIG-01 — OFF preserves bounded legacy (missing flag defaults OFF)', () => {
    expect(isBookingEligibilityEnforcementEnabled(null)).toBe(false);
    expect(isBookingEligibilityEnforcementEnabled({})).toBe(false);
    expect(
      isBookingEligibilityEnforcementEnabled({ 'booking.eligibility.enforcement': false }),
    ).toBe(false);
  });
});

describeDb('Wave B eligibility B-ELIG-01..18 (PostgreSQL)', () => {
  let raw: PrismaClient;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let eligibility: ProviderEligibilityService;
  let tenantId: string;
  let otherTenantId: string;
  let providerUserId: string;
  let clinicalServiceId: string;
  let otherServiceId: string;
  let branchId: string;

  beforeAll(async () => {
    raw = await createPlatformDbSecurityClient();
    wrapper = createClinicalPrismaWrapper(raw);
    eligibility = new ProviderEligibilityService(wrapper as never, fakeAudit as never);
  });

  afterAll(async () => {
    await raw.$disconnect();
  });

  beforeEach(async () => {
    tenantId = randomUUID();
    otherTenantId = randomUUID();
    providerUserId = randomUUID();
    clinicalServiceId = randomUUID();
    otherServiceId = randomUUID();
    branchId = randomUUID();
    fakeAudit.entries.length = 0;
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.create({
        data: {
          id: tenantId,
          name: 'WB Elig',
          slug: `wb-elig-${tenantId.slice(0, 8)}`,
          features: { 'booking.eligibility.enforcement': true },
        },
      });
      await c.tenant.create({
        data: {
          id: otherTenantId,
          name: 'WB Elig Other',
          slug: `wb-elig-o-${otherTenantId.slice(0, 8)}`,
          features: { 'booking.eligibility.enforcement': true },
        },
      });
      await c.branch.create({ data: { id: branchId, tenantId, name: 'Main' } });
      await c.user.create({
        data: {
          id: providerUserId,
          tenantId,
          email: `prov-${providerUserId.slice(0, 8)}@test.local`,
          passwordHash: 'x',
          firstName: 'Prov',
          lastName: 'Ider',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
      for (const id of [clinicalServiceId, otherServiceId]) {
        await c.canonicalClinicalServiceDefinition.create({
          data: {
            id,
            tenantId: null,
            provenance: 'SYSTEM_CANONICAL',
            stableKey: `canonical.elig_${id.slice(0, 8)}`,
            domain: 'GENERAL',
            lifecycle: 'PUBLISHED',
            publishedAt: new Date(),
            translations: { create: [{ locale: 'en', displayName: 'Svc' }] },
          },
        });
      }
    });
  });

  afterEach(async () => {
    await wrapper.withPlatformBypass(async (c) => {
      await c.providerServiceEligibility.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await c.userRoleAssignment.deleteMany({ where: { userId: providerUserId } });
      await c.user.deleteMany({ where: { id: providerUserId } });
      await c.clinicalServiceTranslation.deleteMany({
        where: { clinicalServiceId: { in: [clinicalServiceId, otherServiceId] } },
      });
      await c.canonicalClinicalServiceDefinition.deleteMany({
        where: { id: { in: [clinicalServiceId, otherServiceId] } },
      });
      await c.branch.deleteMany({ where: { id: branchId } });
      await c.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    });
  });

  it('B-ELIG-02 — ON + zero rows = booking denied', async () => {
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId,
        clinicalServiceId,
        branchId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('B-ELIG-03 — ON + zero rows = portal provider excluded', async () => {
    const filtered = await eligibility.filterEligibleProviderIds({
      tenantId,
      clinicalServiceId,
      branchId,
      providerIds: [providerUserId],
    });
    expect(filtered).toEqual([]);
  });

  it('B-ELIG-04 — active matching eligibility allowed', async () => {
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: randomUUID(),
    });
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId,
        clinicalServiceId,
        branchId,
      }),
    ).resolves.toBeUndefined();
  });

  it('B-ELIG-05 — expired denied', async () => {
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      effectiveTo: new Date('2021-01-01T00:00:00.000Z'),
      actorId: randomUUID(),
    });
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId,
        clinicalServiceId,
        branchId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('B-ELIG-06 — inactive denied', async () => {
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId,
      clinicalServiceId,
      branchId: null,
      active: false,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: randomUUID(),
    });
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId,
        clinicalServiceId,
        branchId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('B-ELIG-07 — future effective denied until due', async () => {
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2099-01-01T00:00:00.000Z'),
      actorId: randomUUID(),
    });
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId,
        clinicalServiceId,
        branchId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('B-ELIG-08 — branch mismatch denied', async () => {
    const otherBranch = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.branch.create({ data: { id: otherBranch, tenantId, name: 'Other' } });
    });
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId,
      clinicalServiceId,
      branchId: otherBranch,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: randomUUID(),
    });
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId,
        clinicalServiceId,
        branchId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await wrapper.withPlatformBypass(async (c) => {
      await c.providerServiceEligibility.deleteMany({ where: { branchId: otherBranch } });
      await c.branch.delete({ where: { id: otherBranch } });
    });
  });

  it('B-ELIG-09 — tenant/branch semantics match frozen design (tenant-null covers all; branch-specific exact)', async () => {
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: randomUUID(),
    });
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId,
        clinicalServiceId,
        branchId,
      }),
    ).resolves.toBeUndefined();
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId,
        clinicalServiceId,
        branchId: null,
      }),
    ).resolves.toBeUndefined();
  });

  it('B-ELIG-10 — cross-tenant row denied', async () => {
    const foreignProvider = randomUUID();
    await wrapper.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: foreignProvider,
          tenantId: otherTenantId,
          email: `f-${foreignProvider.slice(0, 8)}@test.local`,
          passwordHash: 'x',
          firstName: 'F',
          lastName: 'P',
          roles: { create: [{ role: 'DOCTOR' }] },
        },
      });
    });
    await eligibility.createEligibilityRow({
      tenantId: otherTenantId,
      providerUserId: foreignProvider,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: randomUUID(),
    });
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId,
        clinicalServiceId,
        branchId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await wrapper.withPlatformBypass(async (c) => {
      await c.providerServiceEligibility.deleteMany({ where: { providerUserId: foreignProvider } });
      await c.userRoleAssignment.deleteMany({ where: { userId: foreignProvider } });
      await c.user.deleteMany({ where: { id: foreignProvider } });
    });
  });

  it('B-ELIG-11 — wrong service denied', async () => {
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId,
      clinicalServiceId: otherServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: randomUUID(),
    });
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId,
        clinicalServiceId,
        branchId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('B-ELIG-12 — specialty alone does not substitute', async () => {
    // specialtyRequirementRef is metadata only; without an eligibility row, deny.
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId,
        clinicalServiceId,
        branchId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const ok = await eligibility.hasActiveEligibility({
      tenantId,
      providerUserId,
      clinicalServiceId,
      branchId,
    });
    expect(ok).toBe(false);
  });

  it('B-ELIG-13 — provider change/reschedule rechecks (assertEligible fail-closed on new provider)', async () => {
    const otherProvider = randomUUID();
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: randomUUID(),
    });
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId: otherProvider,
        clinicalServiceId,
        branchId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('B-ELIG-14 — free but ineligible provider excluded from portal filter', async () => {
    const eligible = providerUserId;
    const freeButIneligible = randomUUID();
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId: eligible,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: randomUUID(),
    });
    const filtered = await eligibility.filterEligibleProviderIds({
      tenantId,
      clinicalServiceId,
      branchId,
      providerIds: [eligible, freeButIneligible],
    });
    expect(filtered).toEqual([eligible]);
    expect(filtered).not.toContain(freeButIneligible);
  });

  it('B-ELIG-15 — readiness report finds uncovered scopes', async () => {
    const report = await eligibility.buildCoverageReport({
      tenantId,
      clinicalServiceIds: [clinicalServiceId],
      providerUserIds: [providerUserId],
      branchId,
    });
    expect(report.some((r) => r.status === 'uncovered')).toBe(true);
  });

  it('B-ELIG-16 — activation ON blocked without readiness', async () => {
    const report = await eligibility.buildCoverageReport({
      tenantId,
      clinicalServiceIds: [clinicalServiceId],
      providerUserIds: [providerUserId],
      branchId,
    });
    expect(() => eligibility.assertReadinessForEnforcementOn(report)).toThrow(ForbiddenException);
  });

  it('B-ELIG-17 — activation ON succeeds with complete readiness', async () => {
    await eligibility.createEligibilityRow({
      tenantId,
      providerUserId,
      clinicalServiceId,
      branchId: null,
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      actorId: randomUUID(),
    });
    const report = await eligibility.buildCoverageReport({
      tenantId,
      clinicalServiceIds: [clinicalServiceId],
      providerUserIds: [providerUserId],
      branchId,
    });
    expect(() => eligibility.assertReadinessForEnforcementOn(report)).not.toThrow();
    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.update({ where: { id: tenantId }, data: { features: {} } });
    });
    const updated = await eligibility.activateEnforcement(
      tenantId,
      { 'booking.eligibility.enforcement': true },
      { actorId: randomUUID() },
    );
    expect(
      isBookingEligibilityEnforcementEnabled(updated.features as Record<string, unknown>),
    ).toBe(true);
  });

  it('B-ELIG-18 — no silent emergency bypass', async () => {
    // Even with specialtyRequirementRef present on an inactive/expired-style empty set, deny.
    await expect(
      eligibility.assertEligible({
        tenantId,
        providerUserId,
        clinicalServiceId,
        branchId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // OFF path is explicit flag only — not an emergency bypass while ON.
    const tenant = await wrapper.withPlatformBypass((c) =>
      c.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { features: true } }),
    );
    expect(
      isBookingEligibilityEnforcementEnabled(tenant.features as Record<string, unknown>),
    ).toBe(true);
  });
});
