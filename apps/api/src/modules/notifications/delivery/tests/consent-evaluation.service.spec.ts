import { ConsentEvaluationService } from '../consent-evaluation.service';

describe('ConsentEvaluationService', () => {
  let service: ConsentEvaluationService;

  beforeEach(() => {
    service = new ConsentEvaluationService();
  });

  describe('revocation-aware universal gate', () => {
    it('denies when recipient has opted out, regardless of policy', () => {
      const decision = service.evaluate({
        policyId: 'transactional-necessity',
        transactional: true,
        preference: { optedOut: true },
      });
      expect(decision.allowed).toBe(false);
      expect(decision.policyId).toBe('revocation-aware');
    });

    it('allows revocation-aware policy when there is no revocation on record', () => {
      const decision = service.evaluate({ policyId: 'revocation-aware', transactional: false, preference: { optedOut: false } });
      expect(decision.allowed).toBe(true);
    });
  });

  describe('regional-restriction universal gate', () => {
    it('denies when metadata.regionBlocked is true, regardless of policy', () => {
      const decision = service.evaluate({
        policyId: 'transactional-necessity',
        transactional: true,
        metadata: { regionBlocked: true },
      });
      expect(decision.allowed).toBe(false);
      expect(decision.policyId).toBe('regional-restriction');
    });
  });

  describe('transactional-necessity', () => {
    it('allows transactional notifications', () => {
      const decision = service.evaluate({ policyId: 'transactional-necessity', transactional: true });
      expect(decision.allowed).toBe(true);
    });

    it('fails closed for non-transactional notifications', () => {
      const decision = service.evaluate({ policyId: 'transactional-necessity', transactional: false });
      expect(decision.allowed).toBe(false);
    });
  });

  describe('promotional-opt-in', () => {
    it('denies by default (fail closed)', () => {
      const decision = service.evaluate({ policyId: 'promotional-opt-in', transactional: false });
      expect(decision.allowed).toBe(false);
    });

    it('allows when preference.promotionalOptIn is true', () => {
      const decision = service.evaluate({
        policyId: 'promotional-opt-in',
        transactional: false,
        preference: { promotionalOptIn: true },
      });
      expect(decision.allowed).toBe(true);
    });

    it('allows when metadata.consentPromotional is true', () => {
      const decision = service.evaluate({
        policyId: 'promotional-opt-in',
        transactional: false,
        metadata: { consentPromotional: true },
      });
      expect(decision.allowed).toBe(true);
    });
  });

  describe('guardian-consent', () => {
    it('denies without metadata.guardianConsent', () => {
      const decision = service.evaluate({ policyId: 'guardian-consent', transactional: false });
      expect(decision.allowed).toBe(false);
    });

    it('allows with metadata.guardianConsent === true', () => {
      const decision = service.evaluate({
        policyId: 'guardian-consent',
        transactional: false,
        metadata: { guardianConsent: true },
      });
      expect(decision.allowed).toBe(true);
    });
  });

  describe('emergency-override', () => {
    it('denies when any of flag/reason/permission is missing', () => {
      const decision = service.evaluate({
        policyId: 'emergency-override',
        transactional: false,
        metadata: { emergencyOverride: true, emergencyOverrideReason: 'evacuation' },
      });
      expect(decision.allowed).toBe(false);
    });

    it('allows when flag, reason, and permission are all present', () => {
      const decision = service.evaluate({
        policyId: 'emergency-override',
        transactional: false,
        metadata: {
          emergencyOverride: true,
          emergencyOverrideReason: 'evacuation',
          emergencyOverridePermissionGranted: true,
        },
      });
      expect(decision.allowed).toBe(true);
    });

    it('still denies when region is blocked even with a complete emergency override', () => {
      const decision = service.evaluate({
        policyId: 'emergency-override',
        transactional: false,
        metadata: {
          emergencyOverride: true,
          emergencyOverrideReason: 'evacuation',
          emergencyOverridePermissionGranted: true,
          regionBlocked: true,
        },
      });
      expect(decision.allowed).toBe(false);
      expect(decision.policyId).toBe('regional-restriction');
    });
  });

  it('fails closed for an unknown policy id', () => {
    const decision = service.evaluate({ policyId: 'not-a-real-policy' as never, transactional: false });
    expect(decision.allowed).toBe(false);
  });
});
