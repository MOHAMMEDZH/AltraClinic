import {
  COURSE_TRANSITIONS,
  SESSION_TRANSITIONS,
  DEVICE_TYPE_SCHEMA_REGISTRY,
  assertDeviceTypeSchemaKey,
  assertPlannedSessions,
  assertIntervalBounds,
  signedCalendarDaysBetween,
} from '../services/wave-e-reference.validation';

describe('Wave E course / session transitions', () => {
  it('allows DRAFT → ACTIVE', () => {
    expect(COURSE_TRANSITIONS.DRAFT).toContain('ACTIVE');
  });

  it('allows DRAFT → CANCELLED', () => {
    expect(COURSE_TRANSITIONS.DRAFT).toContain('CANCELLED');
  });

  it('forbids COMPLETED outgoing transitions', () => {
    expect(COURSE_TRANSITIONS.COMPLETED).toEqual([]);
  });

  it('allows PLANNED → BOOKED', () => {
    expect(SESSION_TRANSITIONS.PLANNED).toContain('BOOKED');
  });

  it('forbids COMPLETED session outgoing', () => {
    expect(SESSION_TRANSITIONS.COMPLETED).toEqual([]);
  });

  it('registers known device schema keys per deviceType', () => {
    expect(DEVICE_TYPE_SCHEMA_REGISTRY.laser).toContain('laser.generic.v1');
    expect(DEVICE_TYPE_SCHEMA_REGISTRY.ipl).toContain('ipl.generic.v1');
  });

  it('accepts matching deviceType and parameterSchemaKey', () => {
    expect(assertDeviceTypeSchemaKey('laser', 'laser.generic.v1')).toBe('laser.generic.v1');
  });

  it('rejects cross-type parameterSchemaKey (laser device + ipl key)', () => {
    expect(() => assertDeviceTypeSchemaKey('laser', 'ipl.generic.v1')).toThrow(
      /not valid for deviceType 'laser'/,
    );
  });

  it('rejects unknown deviceType', () => {
    expect(() => assertDeviceTypeSchemaKey('microwave', 'laser.generic.v1')).toThrow(
      /controlled type/,
    );
  });

  it('validates plannedSessions bounds', () => {
    expect(assertPlannedSessions(3)).toBe(3);
    expect(() => assertPlannedSessions(0)).toThrow();
    expect(() => assertPlannedSessions(101)).toThrow();
  });

  it('validates interval bounds', () => {
    expect(() => assertIntervalBounds(5, 3)).toThrow(/intervalMinDays/);
    expect(() => assertIntervalBounds(2, 10)).not.toThrow();
  });

  it('R2-B2: signedCalendarDaysBetween is chronological (no abs reverse)', () => {
    const earlier = new Date('2026-09-01T10:00:00.000Z');
    const later = new Date('2026-09-15T10:00:00.000Z');
    expect(signedCalendarDaysBetween(earlier, later)).toBe(14);
    expect(signedCalendarDaysBetween(later, earlier)).toBe(-14);
  });
});
