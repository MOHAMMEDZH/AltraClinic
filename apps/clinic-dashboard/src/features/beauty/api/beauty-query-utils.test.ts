import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shouldUseBeautyDemoFallback } from '../api/beauty-query-utils';
import { invoiceStatusLabel, treatmentLabel } from '../config/beauty-config';

describe('beauty-query-utils', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_DEMO_FALLBACK', 'true');
  });

  it('skips demo fallback when online', () => {
    expect(shouldUseBeautyDemoFallback({ status: 500 }, true)).toBe(false);
  });

  it('allows demo fallback only when offline', () => {
    expect(shouldUseBeautyDemoFallback({ status: 401 }, false)).toBe(false);
    expect(shouldUseBeautyDemoFallback({ status: 403 }, false)).toBe(false);
    expect(shouldUseBeautyDemoFallback({ status: 404 }, false)).toBe(false);
    expect(shouldUseBeautyDemoFallback({ status: 500 }, false)).toBe(true);
  });
});

describe('beauty-config labels', () => {
  const t = (key: string) => (key === 'beauty.treatments.botox' ? 'Botox' : key);

  it('resolves treatment and invoice labels', () => {
    expect(treatmentLabel(t, 'botox')).toBe('Botox');
    expect(treatmentLabel(t, 'unknown')).toBe('unknown');
    expect(invoiceStatusLabel((k) => (k === 'beauty.billing.invoiceStatus.paid' ? 'Paid' : k), 'PAID')).toBe('Paid');
  });
});
