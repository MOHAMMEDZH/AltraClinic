import { GetWorkflowOverviewHandler } from '../application/handlers/workflow-enterprise.handlers';

describe('GetWorkflowOverviewHandler', () => {
  it('returns extended KPI fields', async () => {
    const prisma = {
      workflow: {
        count: jest.fn().mockResolvedValue(5),
        findMany: jest.fn().mockResolvedValue([]),
      },
      workflowApproval: { count: jest.fn().mockResolvedValue(2), findMany: jest.fn().mockResolvedValue([]) },
      workflowTask: { count: jest.fn().mockResolvedValue(3), groupBy: jest.fn().mockResolvedValue([]) },
      workflowAutomationRule: { count: jest.fn().mockResolvedValue(1) },
      workflowExecutionLog: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const tenantContext = { resolve: jest.fn().mockResolvedValue({ tenantId: 't1', branchId: null }) };
    const handler = new GetWorkflowOverviewHandler(prisma as never, tenantContext as never);
    const result = await handler.execute('user-1');
    expect(result).toMatchObject({
      activeWorkflows: 5,
      pendingApprovals: 2,
      failedAutomations: 1,
      avgApprovalTimeMs: 0,
      taskLoadByRole: [],
      taskLoadByBranch: [],
    });
  });
});
