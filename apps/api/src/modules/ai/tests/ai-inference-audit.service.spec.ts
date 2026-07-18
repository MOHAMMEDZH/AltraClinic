import { AiInferenceAuditService } from '../application/services/ai-inference-audit.service';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AI_INFERENCE_AUDIT_ACTION } from '../domain/config/ai-admin.config';

const TENANT = 'tenant-1';
const USER = 'user-1';
const CONV = 'conv-1';

describe('AiInferenceAuditService', () => {
  it('writes audit entry on successful inference', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const prisma = {
      auditEntry: { create },
      userRoleAssignment: { findMany: jest.fn().mockResolvedValue([{ role: 'owner' }]) },
    } as unknown as PrismaService;

    const svc = new AiInferenceAuditService(prisma);
    await svc.logSuccess(TENANT, USER, CONV, {
      provider: 'skill',
      model: 'builtin-skills-v1',
      skillId: 'patient.summary',
      tokenCount: 42,
      latencyMs: 80,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT,
          action: AI_INFERENCE_AUDIT_ACTION,
          resourceId: CONV,
          actorId: USER,
          actorRoles: ['owner'],
          details: expect.objectContaining({
            provider: 'skill',
            skillId: 'patient.summary',
            tokenCount: '42',
            latencyMs: '80',
          }),
        }),
      }),
    );
  });

  it('does not throw when audit write fails', async () => {
    const prisma = {
      auditEntry: { create: jest.fn().mockRejectedValue(new Error('db down')) },
      userRoleAssignment: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    const svc = new AiInferenceAuditService(prisma);
    await expect(
      svc.logSuccess(TENANT, USER, CONV, {
        provider: 'template',
        model: 'template-v1',
        skillId: undefined,
        tokenCount: 1,
        latencyMs: 5,
      }),
    ).resolves.toBeUndefined();
  });
});
