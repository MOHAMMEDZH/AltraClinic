/**
 * Flexible Step 27 — pure classifyWindow unit matrix (no DB).
 */
import { PlatformNotificationWarningScheduler } from '../application/schedulers/platform-notification-warning.scheduler';
import { WARNING_WINDOWS_MS } from '../platform-notifications.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('classifyWindow (Step 27 UTC warning windows)', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');

  it('W01: end exactly at now is expired (ms <= 0)', () => {
    expect(PlatformNotificationWarningScheduler.classifyWindow(now, now)).toBe('expired');
  });

  it('W02: end 1ms before now is expired', () => {
    expect(
      PlatformNotificationWarningScheduler.classifyWindow(new Date(now.getTime() - 1), now),
    ).toBe('expired');
  });

  it('W03: end exactly d1 boundary is d1', () => {
    expect(
      PlatformNotificationWarningScheduler.classifyWindow(
        new Date(now.getTime() + WARNING_WINDOWS_MS.d1),
        now,
      ),
    ).toBe('d1');
  });

  it('W04: end just inside d1 window is d1', () => {
    expect(
      PlatformNotificationWarningScheduler.classifyWindow(
        new Date(now.getTime() + WARNING_WINDOWS_MS.d1 - 1),
        now,
      ),
    ).toBe('d1');
  });

  it('W05: end just after d1 (and within d7) is d7', () => {
    expect(
      PlatformNotificationWarningScheduler.classifyWindow(
        new Date(now.getTime() + WARNING_WINDOWS_MS.d1 + 1),
        now,
      ),
    ).toBe('d7');
  });

  it('W06: end exactly d7 boundary is d7', () => {
    expect(
      PlatformNotificationWarningScheduler.classifyWindow(
        new Date(now.getTime() + WARNING_WINDOWS_MS.d7),
        now,
      ),
    ).toBe('d7');
  });

  it('W07: end just after d7 is out of window (null)', () => {
    expect(
      PlatformNotificationWarningScheduler.classifyWindow(
        new Date(now.getTime() + WARNING_WINDOWS_MS.d7 + 1),
        now,
      ),
    ).toBeNull();
  });

  it('W08: end 8 days out is null', () => {
    expect(
      PlatformNotificationWarningScheduler.classifyWindow(new Date(now.getTime() + 8 * DAY_MS), now),
    ).toBeNull();
  });

  it('W09: WARNING_WINDOWS_MS constants are 7d / 1d', () => {
    expect(WARNING_WINDOWS_MS.d7).toBe(7 * DAY_MS);
    expect(WARNING_WINDOWS_MS.d1).toBe(1 * DAY_MS);
  });

  it('W10: classification is timezone-agnostic (UTC ms arithmetic only)', () => {
    const localish = new Date('2026-06-01T00:00:00.000+02:00');
    const end = new Date(localish.getTime() + 6 * DAY_MS);
    expect(PlatformNotificationWarningScheduler.classifyWindow(end, localish)).toBe('d7');
  });
});
