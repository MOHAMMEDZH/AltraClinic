import {
  canTransitionCommercialLifecycle,
  isCommercialConfigMutable,
  isCurrentEligibleLifecycle,
} from '../domain/subscription-commercial-lifecycle';
import {
  computeSubscriptionCommercialFingerprint,
  SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
} from '../domain/subscription-commercial-fingerprint';

describe('Step 16 commercial lifecycle', () => {
  it('allows Draft → Active and rejects terminal transitions', () => {
    expect(canTransitionCommercialLifecycle('DRAFT', 'ACTIVE_COMMERCIAL')).toBe(true);
    expect(canTransitionCommercialLifecycle('ACTIVE_COMMERCIAL', 'SUSPENDED')).toBe(true);
    expect(canTransitionCommercialLifecycle('CANCELLED', 'DRAFT')).toBe(false);
    expect(canTransitionCommercialLifecycle('SUPERSEDED', 'ACTIVE_COMMERCIAL')).toBe(false);
  });

  it('marks only Draft as mutable', () => {
    expect(isCommercialConfigMutable('DRAFT')).toBe(true);
    expect(isCommercialConfigMutable('ACTIVE_COMMERCIAL')).toBe(false);
  });

  it('current eligibility covers draft/scheduled/active/suspended', () => {
    expect(isCurrentEligibleLifecycle('DRAFT')).toBe(true);
    expect(isCurrentEligibleLifecycle('CANCELLED')).toBe(false);
  });
});

describe('Step 16 commercial fingerprint', () => {
  const base = {
    platformTenantId: 't1',
    platformSubscriptionId: null,
    planCanonicalKey: 'plan.pro',
    planVersionId: 'pv1',
    planVersionNumber: 1,
    planPublicationFingerprint: 'pf1',
    addonVersionIds: ['a2', 'a1'],
    addonFingerprints: ['f2', 'f1'],
    overrideIds: ['o2', 'o1'],
    overrideFingerprints: ['of2', 'of1'],
    commercialStart: '2026-01-01T00:00:00.000Z',
    commercialEnd: '2027-01-01T00:00:00.000Z',
    scheduledActivationAt: null,
  };

  it('is order-independent and schema-versioned', () => {
    const left = computeSubscriptionCommercialFingerprint(base);
    const right = computeSubscriptionCommercialFingerprint({
      ...base,
      addonVersionIds: ['a1', 'a2'],
      overrideIds: ['o1', 'o2'],
    });
    expect(left).toBe(right);
    expect(left).toHaveLength(64);
    expect(SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA).toContain('v1');
  });

  it('changes when Plan, Add-on, Override, date, or correlation changes; order independent', () => {
    const a = computeSubscriptionCommercialFingerprint(base);
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({ ...base, planVersionId: 'pv2' }),
    );
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...base,
        planPublicationFingerprint: 'pf-changed',
      }),
    );
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({ ...base, addonVersionIds: ['a1'] }),
    );
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({ ...base, overrideIds: ['o1'] }),
    );
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...base,
        commercialEnd: '2028-01-01T00:00:00.000Z',
      }),
    );
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...base,
        platformSubscriptionId: 'runtime-sub-1',
      }),
    );
    expect(a).toBe(
      computeSubscriptionCommercialFingerprint({
        ...base,
        addonVersionIds: ['a1', 'a2'],
        overrideIds: ['o1', 'o2'],
      }),
    );
  });
});
