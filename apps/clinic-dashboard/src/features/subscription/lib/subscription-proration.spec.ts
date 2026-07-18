import { describe, expect, it } from 'vitest';
import { estimateProration } from './subscription-proration';

describe('subscription-proration', () => {
  it('estimates positive proration on upgrade', () => {
    const amount = estimateProration('starter', 'professional', 'monthly', 15, 30);
    expect(amount).toBeGreaterThan(0);
  });

  it('returns zero when downgrading to same tier', () => {
    const amount = estimateProration('professional', 'professional', 'monthly');
    expect(amount).toBe(0);
  });
});
