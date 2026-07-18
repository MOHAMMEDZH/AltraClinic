import { LicensingAuditService } from '../application/services/licensing-audit.service';

function makePrisma() {
  const licenseAuditEvent = { create: jest.fn().mockResolvedValue({ id: 'e1' }) };
  const auditEntry = { create: jest.fn().mockResolvedValue({ id: 'a1' }) };
  return {
    licenseAuditEvent,
    auditEntry,
    _licenseAuditEvent: licenseAuditEvent,
    _auditEntry: auditEntry,
  } as unknown as import('../../../infrastructure/prisma.service').PrismaService & {
    _licenseAuditEvent: typeof licenseAuditEvent;
    _auditEntry: typeof auditEntry;
  };
}

describe('LicensingAuditService — LicenseAuditEvent', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: LicensingAuditService;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new LicensingAuditService(prisma);
    jest.clearAllMocks();
  });

  it('appends license audit events', async () => {
    await svc.recordLicenseEvent({
      tenantId: 't1',
      eventType: 'plan.upgrade',
      previousPlan: 'starter',
      newPlan: 'professional',
      decision: 'allowed',
      reason: 'Plan changed',
      source: 'subscription.change',
    });

    expect(prisma._licenseAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'plan.upgrade', decision: 'allowed' }),
      }),
    );
  });

  it('mirrors denials to AuditEntry', async () => {
    await svc.recordLicenseEvent({
      tenantId: 't1',
      eventType: 'communication.denied',
      decision: 'denied',
      reason: 'SMS quota exceeded',
      usageLimit: 'SMS',
      source: 'communication.dispatch',
    });

    expect(prisma._auditEntry.create).toHaveBeenCalled();
  });

  it('records denial history with usage limit metadata', async () => {
    await svc.recordLicenseEvent({
      tenantId: 't1',
      eventType: 'rate_limit.denied',
      decision: 'denied',
      reason: 'API quota exceeded',
      usageLimit: 'API',
      source: 'api.rate-limit',
      correlationId: 'corr-1',
      requestId: 'req-1',
    });

    expect(prisma._licenseAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'rate_limit.denied',
          usageLimit: 'API',
          correlationId: 'corr-1',
          requestId: 'req-1',
        }),
      }),
    );
  });
});
