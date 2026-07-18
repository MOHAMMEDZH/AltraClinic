import { describe, expect, it } from 'vitest';
import {
  STATIC_JOURNEY_CATALOG,
  STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY,
  assertJourneyCatalogValid,
} from './static-journey-catalog';

describe('STATIC_JOURNEY_CATALOG (Phase 40a)', () => {
  it('is never runtime authority', () => {
    expect(STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
  });

  it('contains 65 parity entries', () => {
    expect(STATIC_JOURNEY_CATALOG).toHaveLength(65);
  });

  it('has unique extensionIds', () => {
    const ids = STATIC_JOURNEY_CATALOG.map((e) => e.extensionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('passes local catalog validation', () => {
    expect(assertJourneyCatalogValid()).toEqual([]);
  });

  it('breaks down into 21 stages, 22 transitions, 4 definitions, 4 surfaces, 10 automation hooks, 4 packs', () => {
    const byKind = (kind: string) => STATIC_JOURNEY_CATALOG.filter((e) => e.journeyKind === kind).length;
    expect(byKind('stage')).toBe(21);
    expect(byKind('transition')).toBe(22);
    expect(byKind('definition')).toBe(4);
    expect(byKind('surface')).toBe(4);
    expect(byKind('automationHook')).toBe(10);
    expect(byKind('pack')).toBe(4);
  });
});
