import { LicensingCommercialAuditService } from '../application/services/licensing-commercial-audit.service';
import { LicensingAuditService } from '../application/services/licensing-audit.service';

describe('LicensingCommercialAuditService', () => {
  const audit = {
    recordLicenseEvent: jest.fn().mockResolvedValue(undefined),
  } as unknown as LicensingAuditService;

  const svc = new LicensingCommercialAuditService(audit);

  beforeEach(() => jest.clearAllMocks());

  it('records plan upgrade events', async () => {
    await svc.recordPlanChange({
      tenantId: 't1',
      actorId: 'owner-1',
      previousPlan: 'starter',
      newPlan: 'professional',
      source: 'test',
    });

    expect(audit.recordLicenseEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'plan.upgrade', decision: 'allowed' }),
    );
  });

  it('records trial start events', async () => {
    await svc.recordTrialStart({
      tenantId: 't1',
      actorId: 'admin-1',
      plan: 'professional',
      days: 14,
      source: 'subscription.grant_trial',
    });

    expect(audit.recordLicenseEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'trial.started', newStatus: 'trial' }),
    );
  });

  it('records suspension events', async () => {
    await svc.recordSuspension({
      tenantId: 't1',
      actorId: 'admin-1',
      reason: 'non-payment',
      source: 'event.platform.suspended',
    });

    expect(audit.recordLicenseEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'suspension', newStatus: 'suspended' }),
    );
  });

  it('records grace start on status transition', async () => {
    await svc.recordLicenseStatusTransition({
      tenantId: 't1',
      previousStatus: 'active',
      newStatus: 'grace',
      source: 'licensing.engine.status',
    });

    expect(audit.recordLicenseEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'grace.started', newStatus: 'grace' }),
    );
  });

  it('records feature disable events', async () => {
    await svc.recordFeatureDisable({
      tenantId: 't1',
      featureId: 'workflow',
      plan: 'starter',
      source: 'test',
    });

    expect(audit.recordLicenseEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'feature.disabled', featureId: 'workflow' }),
    );
  });
});
