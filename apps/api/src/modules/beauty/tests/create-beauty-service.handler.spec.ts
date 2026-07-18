import { Test, TestingModule } from '@nestjs/testing';
import { CreateBeautyServiceHandler } from '../application/handlers/create-beauty-service.handler';
import { CreateBeautyServiceCommand } from '../application/commands/create-beauty-service.command';
import { InMemoryBeautyServiceRepository } from '../infrastructure/in-memory-beauty.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { EVENT_PUBLISHER } from '../../../infrastructure/provider.tokens';

describe('CreateBeautyServiceHandler', () => {
  let handler: CreateBeautyServiceHandler;
  let repo: InMemoryBeautyServiceRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateBeautyServiceHandler,
        InMemoryBeautyServiceRepository,
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'default', environment: 'sandbox' }) },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: async () => {} } },
      ],
    }).compile();

    handler = module.get(CreateBeautyServiceHandler);
    repo = module.get(InMemoryBeautyServiceRepository);
  });

  it('creates a service and persists it', async () => {
    const cmd: CreateBeautyServiceCommand = {
      patientId: 'patient-1',
      clinicianId: 'clin-1',
      serviceType: 'facial',
      scheduledAt: new Date().toISOString(),
      notesEn: 'notes',
    };
    const result = await handler.execute(cmd);
    expect(result).toHaveProperty('serviceId');
    const saved = await repo.findById('default', result.serviceId);
    expect(saved).not.toBeNull();
  });
});

