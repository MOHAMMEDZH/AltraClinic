import { describe, expect, it } from 'vitest';
import {
  canCreateApiIntegrations,
  canManageApiIntegrations,
  canViewApiIntegrations,
  API_INTEGRATIONS_BASE_PATH,
  API_INTEGRATIONS_RESOURCE,
} from './api-integrations-config';

describe('api-integrations-config', () => {
  it('exposes base path and resource', () => {
    expect(API_INTEGRATIONS_BASE_PATH).toBe('/settings/api-integrations');
    expect(API_INTEGRATIONS_RESOURCE).toBe('api.integrations');
  });

  it('allows owner view/create/manage', () => {
    const roles = ['owner'];
    expect(canViewApiIntegrations(roles)).toBe(true);
    expect(canCreateApiIntegrations(roles)).toBe(true);
    expect(canManageApiIntegrations(roles)).toBe(true);
  });

  it('denies patient view/create/manage', () => {
    const roles = ['patient'];
    expect(canViewApiIntegrations(roles)).toBe(false);
    expect(canCreateApiIntegrations(roles)).toBe(false);
    expect(canManageApiIntegrations(roles)).toBe(false);
  });
});
