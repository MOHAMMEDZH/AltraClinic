import { IdentityController } from '../controllers/identity.controller';

function mockHandler<T = unknown>(result?: T) {
  return { execute: jest.fn().mockResolvedValue(result) };
}

/** Builds IdentityController with default no-op handlers; pass partial overrides by handler key. */
function buildController(
  overrides: Partial<{
    overview: ReturnType<typeof mockHandler>;
    recentActivity: ReturnType<typeof mockHandler>;
    features: ReturnType<typeof mockHandler>;
    listUsers: ReturnType<typeof mockHandler>;
    regions: ReturnType<typeof mockHandler>;
  }> = {},
) {
  const handlers = Array.from({ length: 52 }, () => mockHandler());
  handlers[2] = overrides.overview ?? mockHandler({ totalUsers: 0 });
  handlers[27] = overrides.recentActivity ?? mockHandler([]);
  handlers[32] = overrides.features ?? mockHandler({ smsInvites: false });
  handlers[3] = overrides.listUsers ?? mockHandler({ items: [], total: 0, nextCursor: null });
  handlers[47] = overrides.regions ?? mockHandler([]);
  return new IdentityController(
    ...(handlers as unknown as ConstructorParameters<typeof IdentityController>),
  );
}

describe('IdentityController (integration wiring)', () => {
  it('GET /identity/features delegates to GetIdentityFeaturesHandler', async () => {
    const features = mockHandler({ smsInvites: true, advancedAnalytics: true });
    const ctrl = buildController({ features });
    await expect(ctrl.features()).resolves.toEqual({ smsInvites: true, advancedAnalytics: true });
    expect(features.execute).toHaveBeenCalledTimes(1);
  });

  it('GET /identity/overview merges stats and recent activity', async () => {
    const overview = mockHandler({ totalUsers: 12, activeUsers: 10 });
    const recentActivity = mockHandler([{ action: 'identity.user.created' }]);
    const ctrl = buildController({ overview, recentActivity });
    await expect(ctrl.overview()).resolves.toEqual({
      totalUsers: 12,
      activeUsers: 10,
      recentActivity: [{ action: 'identity.user.created' }],
    });
  });

  it('GET /identity/users passes cursor query to ListUsersHandler', async () => {
    const listUsers = mockHandler({ items: [{ id: 'u1' }], total: 1, nextCursor: 'u1' });
    const ctrl = buildController({ listUsers });
    await ctrl.listUsers({ cursor: 'u0', limit: 25 } as never);
    expect(listUsers.execute).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'u0', limit: 25 }));
  });

  it('GET /identity/regions delegates to ListRegionsHandler', async () => {
    const regions = mockHandler([{ id: 'r1', name: 'Central' }]);
    const ctrl = buildController({ regions });
    await expect(ctrl.regions()).resolves.toEqual([{ id: 'r1', name: 'Central' }]);
  });
});
