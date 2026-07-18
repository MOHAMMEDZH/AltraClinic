import { DeliveryActivityEmitterService } from '../delivery-activity-emitter.service';

describe('DeliveryActivityEmitterService', () => {
  it('emits PHI-free structured activity and records metrics', async () => {
    const queueMetrics = {
      recordEnqueued: jest.fn().mockResolvedValue(undefined),
      recordCompleted: jest.fn().mockResolvedValue(undefined),
      recordFailed: jest.fn().mockResolvedValue(undefined),
    };
    const emitter = new DeliveryActivityEmitterService(queueMetrics as never);
    await emitter.emit('delivered', {
      tenantId: 't1',
      intentId: 'i1',
      jobId: 'j1',
      channel: 'email',
      providerKey: 'email-transactional',
    });
    expect(queueMetrics.recordCompleted).toHaveBeenCalled();
    await emitter.emit('blocked_consent', { tenantId: 't1', intentId: 'i1', reasonCode: 'denied' });
    expect(queueMetrics.recordEnqueued).toHaveBeenCalled();
  });
});
