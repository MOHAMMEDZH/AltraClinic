import { describe, expect, it, vi } from 'vitest';
import {
  PLATFORM_ACTIVITY_CLIENT_THROTTLE_MS,
  startPlatformActivitySignal,
} from './platform-activity';

describe('startPlatformActivitySignal', () => {
  it('emits activity only after real interaction and respects throttling', () => {
    const target = new EventTarget();
    let clock = 1_000_000;
    const recordActivity = vi.fn().mockResolvedValue({ updated: true });
    let token: string | null = 'access-1';

    const stop = startPlatformActivitySignal({
      getAccessToken: () => token,
      isAuthenticated: () => token !== null,
      recordActivity,
      throttleMs: PLATFORM_ACTIVITY_CLIENT_THROTTLE_MS,
      now: () => clock,
      target,
    });

    expect(recordActivity).not.toHaveBeenCalled();

    target.dispatchEvent(new Event('pointerdown'));
    expect(recordActivity).toHaveBeenCalledTimes(1);
    expect(recordActivity).toHaveBeenCalledWith('access-1');

    clock += 1_000;
    target.dispatchEvent(new Event('keydown'));
    expect(recordActivity).toHaveBeenCalledTimes(1);

    clock += PLATFORM_ACTIVITY_CLIENT_THROTTLE_MS;
    target.dispatchEvent(new Event('touchstart'));
    expect(recordActivity).toHaveBeenCalledTimes(2);

    token = null;
    clock += PLATFORM_ACTIVITY_CLIENT_THROTTLE_MS;
    target.dispatchEvent(new Event('pointerdown'));
    expect(recordActivity).toHaveBeenCalledTimes(2);

    stop();
    clock += PLATFORM_ACTIVITY_CLIENT_THROTTLE_MS;
    token = 'access-1';
    target.dispatchEvent(new Event('pointerdown'));
    expect(recordActivity).toHaveBeenCalledTimes(2);
  });

  it('does not treat inactivity as a reason to send signals', () => {
    const target = new EventTarget();
    const recordActivity = vi.fn().mockResolvedValue({ updated: true });
    const stop = startPlatformActivitySignal({
      getAccessToken: () => 'access-1',
      isAuthenticated: () => true,
      recordActivity,
      throttleMs: 100,
      now: () => Date.now(),
      target,
    });
    expect(recordActivity).not.toHaveBeenCalled();
    stop();
  });
});
