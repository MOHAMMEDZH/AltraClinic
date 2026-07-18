import { classifyFailure, computeRetryDelay } from '../delivery-job.service';
import { ProviderUnavailableError } from '../provider-adapter.contract';
import { RECEIPT_STATUS_RANK } from '../receipt.service';

describe('DeliveryJobService helpers', () => {
  it('classifies permanent failures', () => {
    expect(classifyFailure(new Error('invalid recipient'), 1, 5)).toBe('permanent');
    expect(classifyFailure(new Error('unauthorized'), 1, 5)).toBe('permanent');
  });

  it('classifies provider unavailable as fallback', () => {
    expect(classifyFailure(new ProviderUnavailableError('whatsapp', 'missing creds'), 1, 5)).toBe('fallback');
  });

  it('classifies dead_letter when attempts exhausted', () => {
    expect(classifyFailure(new Error('timeout'), 5, 5)).toBe('dead_letter');
  });

  it('classifies transient errors as retryable', () => {
    expect(classifyFailure(new Error('ECONNRESET'), 1, 5)).toBe('retryable');
  });

  it('computes jittered retry delay within exponential window', () => {
    const schedule = computeRetryDelay(3, new Date('2026-07-17T12:00:00.000Z'));
    expect(schedule.attempt).toBe(3);
    expect(schedule.delayMs).toBeGreaterThanOrEqual(0);
    expect(schedule.delayMs).toBeLessThanOrEqual(5_000 * 4);
    expect(schedule.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(Date.parse('2026-07-17T12:00:00.000Z'));
  });
});

describe('Receipt status rank', () => {
  it('orders SENT < DELIVERED < READ', () => {
    expect(RECEIPT_STATUS_RANK.SENT).toBeLessThan(RECEIPT_STATUS_RANK.DELIVERED);
    expect(RECEIPT_STATUS_RANK.DELIVERED).toBeLessThan(RECEIPT_STATUS_RANK.READ);
  });
});
