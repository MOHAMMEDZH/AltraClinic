import { describe, expect, it } from 'vitest';
import { SETTINGS_NAV, filterSettingsNav, isSettingsNavLocked } from '../config/settings-config';

describe('settings-config', () => {
  it('shows home for users with settings or identity view', () => {
    const ownerNav = filterSettingsNav(['owner'], () => true);
    expect(ownerNav.some((item) => item.id === 'home')).toBe(true);
    expect(ownerNav.some((item) => item.id === 'general')).toBe(true);
    expect(ownerNav.some((item) => item.id === 'security-policies')).toBe(true);
  });

  it('hides developer settings without manage permission', () => {
    const receptionistNav = filterSettingsNav(['receptionist'], () => true);
    expect(receptionistNav.some((item) => item.id === 'developer')).toBe(false);
  });

  it('marks subscription-gated nav items as locked', () => {
    const branding = SETTINGS_NAV.find((item) => item.id === 'branding');
    expect(branding).toBeDefined();
    expect(isSettingsNavLocked(branding!, () => false)).toBe(true);
    expect(isSettingsNavLocked(branding!, () => true)).toBe(false);
  });

  it('includes import-export nav for owner roles', () => {
    const ownerNav = filterSettingsNav(['owner'], () => true);
    expect(ownerNav.some((item) => item.id === 'import-export')).toBe(true);
  });

  it('hides import-export nav without view permission', () => {
    const receptionistNav = filterSettingsNav(['receptionist'], () => true);
    expect(receptionistNav.some((item) => item.id === 'import-export')).toBe(false);
  });
});
