import { AiSkillExecutorService } from '../application/services/ai-skill-executor.service';

const TENANT = 'a1000000-0000-4000-8000-000000000001';

describe('AiSkillExecutorService', () => {
  const mockPrisma = {
    appointment: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    patient: {
      findFirst: jest.fn(),
    },
    encounter: {
      findMany: jest.fn(),
    },
    invoice: {
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    userRoleAssignment: {
      findMany: jest.fn().mockResolvedValue([{ role: 'owner' }]),
    },
    aiUsageDaily: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const mockGlobalSearch = {
    execute: jest.fn(),
  };

  let executor: AiSkillExecutorService;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new AiSkillExecutorService(mockPrisma as never, mockGlobalSearch as never);
  });

  it('formats appointments.today with patient names', async () => {
    mockPrisma.appointment.count.mockResolvedValue(1);
    mockPrisma.appointment.findMany.mockResolvedValue([
      {
        id: 'appt-1',
        scheduledStart: new Date('2026-06-20T14:30:00.000Z'),
        scheduledEnd: new Date('2026-06-20T15:00:00.000Z'),
        status: 'CONFIRMED',
        serviceType: 'consultation',
        patient: { id: 'pat-1', firstName: 'Sara', lastName: 'Ali' },
      },
    ]);

    const result = await executor.execute(
      'appointments.today',
      { tenantId: TENANT, userId: 'u1', userMessage: 'appointments today' },
      { systemPrompt: '', contextBlocks: [], citations: [], history: [], userParts: [] },
    );

    expect(result.skillId).toBe('appointments.today');
    expect(result.content).toContain('Sara Ali');
    expect(result.content).toContain('CONFIRMED');
    expect(result.citations.length).toBeGreaterThan(0);
  });

  it('guides patient.summary without patient context', async () => {
    const result = await executor.execute(
      'patient.summary',
      { tenantId: TENANT, userId: 'u1', userMessage: 'summarize patient' },
      { systemPrompt: '', contextBlocks: [], citations: [], history: [], userParts: [] },
    );

    expect(result.content).toContain('Patients');
    expect(mockPrisma.patient.findFirst).not.toHaveBeenCalled();
  });

  it('lists app.help suggestions from smart actions', async () => {
    const result = await executor.execute(
      'app.help',
      {
        tenantId: TENANT,
        userId: 'u1',
        userMessage: 'help',
        context: { path: '/patients/p1', patientId: 'p1' },
      },
      { systemPrompt: '', contextBlocks: [], citations: [], history: [], userParts: [] },
    );

    expect(result.content).toContain('Built-in clinic assistant');
    expect(result.content.toLowerCase()).toContain('patient');
  });

  it('formats billing.outstanding totals', async () => {
    mockPrisma.invoice.aggregate.mockResolvedValue({
      _sum: { amountTotal: 500, amountPaid: 100 },
      _count: 3,
    });
    mockPrisma.invoice.count.mockResolvedValue(1);
    mockPrisma.invoice.findMany.mockResolvedValue([
      {
        id: 'inv-1',
        invoiceNumber: 'INV-100',
        amountTotal: { toNumber: () => 200 },
        amountPaid: { toNumber: () => 50 },
        currency: 'USD',
        status: 'OVERDUE',
        dueDate: new Date('2026-06-01'),
      },
    ]);

    const result = await executor.execute(
      'billing.outstanding',
      { tenantId: TENANT, userId: 'u1', userMessage: 'outstanding balances' },
      { systemPrompt: '', contextBlocks: [], citations: [], history: [], userParts: [] },
    );

    expect(result.content).toContain('400.00');
    expect(result.content).toContain('INV-100');
  });

  it('searches patients via global search handler', async () => {
    mockGlobalSearch.execute.mockResolvedValue({
      total: 1,
      results: [
        {
          type: 'patient',
          id: 'pat-1',
          title: 'Ahmed Ali',
          subtitle: 'MRN-100',
          url: '/patients/pat-1',
        },
      ],
    });

    const result = await executor.execute(
      'search.patients',
      { tenantId: TENANT, userId: 'u1', userMessage: 'find patient Ahmed' },
      { systemPrompt: '', contextBlocks: [], citations: [], history: [], userParts: [] },
    );

    expect(mockGlobalSearch.execute).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'Ahmed', types: ['patient'] }),
    );
    expect(result.content).toContain('Ahmed Ali');
  });
});
