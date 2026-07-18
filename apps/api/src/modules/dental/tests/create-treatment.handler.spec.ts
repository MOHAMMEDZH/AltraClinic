import { CreateTreatmentHandler } from '../application/handlers/create-treatment.handler';
import { InMemoryDentalRepository } from '../infrastructure/in-memory-dental.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { EventPublisherInterface } from '../../../infrastructure/event-publisher.interface';

class DummyPublisher implements EventPublisherInterface {
  async publish() {
    return;
  }
}

describe('CreateTreatmentHandler', () => {
  it('applies procedures to existing chart', async () => {
    const repo = new InMemoryDentalRepository();
    const tenantCtx = { resolve: async () => ({ tenantId: 't1', branchId: null }) } as unknown as TenantContextService;
    const pub = new DummyPublisher();
    const handler = new CreateTreatmentHandler(repo as any, tenantCtx, pub);

    // seed chart
    const chart = require('../domain/dental-entry.factory').DentalEntryFactory.createEmptyChart('chart1', 't1', 'p1');
    await repo.save(chart);

    const result = await handler.execute({ patientId: 'p1', providerId: 'prov1', procedures: [{ code: 'D01', description: 'Filling', toothNumbers: [12] }] });
    expect(result.chartId).toBe('chart1');
    const updated = await repo.findByPatient('t1', 'p1');
    expect(updated).not.toBeNull();
    // procedure appended
    expect(updated!.procedures.length).toBe(1);
  });
});

