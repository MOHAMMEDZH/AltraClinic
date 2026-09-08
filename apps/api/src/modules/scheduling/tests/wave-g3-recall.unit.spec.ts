/**
 * Wave G3 / P1-13 / AR-17 — Recall lifecycle + due helpers (unit).
 */
import {
  canBook,
  canComplete,
  canOptOut,
  canSnooze,
  computeDueAt,
  isDueAsOf,
  parseBoundedEligibilityExpr,
  patientPassesBoundedEligibility,
} from '../domain/recall.lifecycle';

describe('Wave G3 Recall lifecycle (unit)', () => {
  it('G3-DUE-01 — computeDueAt adds intervalDays', () => {
    const last = new Date('2026-01-01T00:00:00.000Z');
    expect(computeDueAt(last, 90).toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('G3-DUE-02 — isDueAsOf true when dueAt <= asOf', () => {
    expect(isDueAsOf(new Date('2026-06-01T00:00:00.000Z'), new Date('2026-06-01T00:00:00.000Z'))).toBe(
      true,
    );
    expect(isDueAsOf(new Date('2026-06-02T00:00:00.000Z'), new Date('2026-06-01T00:00:00.000Z'))).toBe(
      false,
    );
  });

  it('G3-TX-01 — DUE can snooze/book/complete/opt-out', () => {
    expect(canSnooze('DUE')).toBe(true);
    expect(canBook('DUE')).toBe(true);
    expect(canComplete('DUE')).toBe(true);
    expect(canOptOut('DUE')).toBe(true);
  });

  it('G3-TX-02 — BOOKED → complete/opt-out; not snooze/book', () => {
    expect(canSnooze('BOOKED')).toBe(false);
    expect(canBook('BOOKED')).toBe(false);
    expect(canComplete('BOOKED')).toBe(true);
    expect(canOptOut('BOOKED')).toBe(true);
  });

  it('G3-TX-03 — COMPLETED/OPTED_OUT are terminal', () => {
    expect(canSnooze('COMPLETED')).toBe(false);
    expect(canBook('COMPLETED')).toBe(false);
    expect(canComplete('COMPLETED')).toBe(false);
    expect(canOptOut('OPTED_OUT')).toBe(false);
  });

  it('G3-ELIG-01 — bounded eligibilityExpr parses known keys only', () => {
    expect(parseBoundedEligibilityExpr({ minAgeYears: 18.7, requireLastService: true, junk: 1 })).toEqual({
      minAgeYears: 18,
      requireLastService: true,
    });
    expect(parseBoundedEligibilityExpr(null)).toEqual({});
  });

  it('G3-ELIG-02 — default requires lastQualifyingServiceAt', () => {
    expect(
      patientPassesBoundedEligibility({
        expr: {},
        lastQualifyingServiceAt: null,
        asOf: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toBe(false);
    expect(
      patientPassesBoundedEligibility({
        expr: {},
        lastQualifyingServiceAt: new Date('2025-01-01T00:00:00.000Z'),
        asOf: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toBe(true);
  });
});
