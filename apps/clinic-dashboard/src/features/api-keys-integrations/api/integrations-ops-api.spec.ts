import { describe, expect, it } from 'vitest';

describe('integrations ops api paths', () => {
  it('uses integrations namespace', async () => {
    const mod = await import('../api/integrations-ops-api');
    expect(typeof mod.fetchOpsDashboard).toBe('function');
    expect(typeof mod.listCredentials).toBe('function');
    expect(typeof mod.listWebhookSubscriptions).toBe('function');
  });
});
