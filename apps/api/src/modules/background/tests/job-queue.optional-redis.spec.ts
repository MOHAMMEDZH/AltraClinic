import { JobQueueService } from '../infrastructure/job-queue.service';
import { BullMqConnectionService } from '../infrastructure/bullmq-connection.service';
import { QueueMetricsService } from '../../../infrastructure/redis/services/queue-metrics.service';
import { BACKGROUND_QUEUES } from '../config/queue-names';

describe('JobQueueService REDIS_OPTIONAL longevity', () => {
  const prevOptional = process.env.REDIS_OPTIONAL;
  const prevUrl = process.env.REDIS_URL;
  const prevTimeout = process.env.REDIS_CONNECT_TIMEOUT_MS;

  afterEach(() => {
    if (prevOptional === undefined) delete process.env.REDIS_OPTIONAL;
    else process.env.REDIS_OPTIONAL = prevOptional;
    if (prevUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prevUrl;
    if (prevTimeout === undefined) delete process.env.REDIS_CONNECT_TIMEOUT_MS;
    else process.env.REDIS_CONNECT_TIMEOUT_MS = prevTimeout;
  });

  it('skips Queue construction when optional Redis cannot connect', async () => {
    process.env.REDIS_OPTIONAL = 'true';
    process.env.REDIS_URL = 'redis://127.0.0.1:63999';
    process.env.REDIS_CONNECT_TIMEOUT_MS = '200';

    const connect = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const bullMq = {
      connection: {
        status: 'wait',
        connect,
        off: jest.fn(),
        once: jest.fn(),
      },
    } as unknown as BullMqConnectionService;
    const metrics = {
      recordEnqueued: jest.fn(),
    } as unknown as QueueMetricsService;

    const svc = new JobQueueService(bullMq, metrics);
    const createSpy = jest.spyOn(svc, 'getOrCreateQueue');

    await svc.enqueue(BACKGROUND_QUEUES.NOTIFICATIONS, 'notifications.process', {});
    await svc.enqueue(BACKGROUND_QUEUES.NOTIFICATIONS, 'notifications.process', {});

    expect(connect).toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();
    expect(metrics.recordEnqueued).not.toHaveBeenCalled();
  });
});
