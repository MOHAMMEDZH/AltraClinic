import { NotificationAutomationSchedulerService } from '../../background/application/services/notification-automation-scheduler.service';

describe('NotificationAutomationSchedulerService', () => {
  it('triggers due scheduled rules once per hour bucket', async () => {
    const now = new Date('2026-06-01T08:05:00Z');
    const rule = {
      id: 'r1',
      tenantId: 't1',
      name: 'Daily digest',
      channel: 'IN_APP',
      schedule: '0 8 * * *',
      isActive: true,
      recipientRoles: ['OWNER'],
      template: null,
    };
    const prisma = {
      notificationAutomationRule: {
        findMany: jest.fn().mockResolvedValue([rule]),
      },
    };
    const executor = { executeRule: jest.fn().mockResolvedValue(2) };
    const dedup = { isDuplicate: jest.fn().mockResolvedValue(false) };
    const licensing = { allowWorkerExecution: jest.fn().mockResolvedValue(true) };
    const service = new NotificationAutomationSchedulerService(
      prisma as never,
      executor as never,
      dedup as never,
      licensing as never,
    );
    const result = await service.scanDueScheduledRules(now);
    expect(result.rulesTriggered).toBe(1);
    expect(result.notificationsSent).toBe(2);
    expect(executor.executeRule).toHaveBeenCalledWith(rule, { tenantId: 't1', branchId: null });
  });

  it('skips duplicate hourly runs', async () => {
    const prisma = {
      notificationAutomationRule: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'r1',
            tenantId: 't1',
            name: 'Daily digest',
            channel: 'IN_APP',
            schedule: '0 8 * * *',
            isActive: true,
            recipientRoles: ['OWNER'],
            template: null,
          },
        ]),
      },
    };
    const executor = { executeRule: jest.fn() };
    const dedup = { isDuplicate: jest.fn().mockResolvedValue(true) };
    const licensing = { allowWorkerExecution: jest.fn().mockResolvedValue(true) };
    const service = new NotificationAutomationSchedulerService(
      prisma as never,
      executor as never,
      dedup as never,
      licensing as never,
    );
    const result = await service.scanDueScheduledRules(new Date('2026-06-01T08:05:00Z'));
    expect(result.duplicatesSkipped).toBe(1);
    expect(executor.executeRule).not.toHaveBeenCalled();
  });
});
