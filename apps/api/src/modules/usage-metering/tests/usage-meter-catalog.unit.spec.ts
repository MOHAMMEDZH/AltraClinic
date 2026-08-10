import { STATIC_USAGE_METER_CATALOG, getMeterDefinition, getMeterByLimitKey, isKnownMeterKey } from '../catalog/static-usage-meter.catalog';

describe('usage meter catalog', () => {
  it('ships exactly 8 verified meters', () => {
    expect(STATIC_USAGE_METER_CATALOG).toHaveLength(8);
  });

  it('maps one meter to one limit key with HARD enforcement', () => {
    const limitKeys = new Set(STATIC_USAGE_METER_CATALOG.map((m) => m.limitKey));
    expect(limitKeys.size).toBe(8);
    for (const m of STATIC_USAGE_METER_CATALOG) {
      expect(m.meterKey.startsWith('meter.')).toBe(true);
      expect(m.limitKey.startsWith('limit.')).toBe(true);
      expect(m.enforcementMode).toBe('HARD');
      expect(m.privacyClass).toBe('OPERATIONAL_AGGREGATE');
      expect(getMeterDefinition(m.meterKey)).toEqual(m);
      expect(getMeterByLimitKey(m.limitKey)?.meterKey).toBe(m.meterKey);
    }
  });

  it('rejects unknown meter keys', () => {
    expect(isKnownMeterKey('meter.max_api_requests_per_day')).toBe(false);
    expect(getMeterDefinition('meter.unknown')).toBeUndefined();
  });
});
