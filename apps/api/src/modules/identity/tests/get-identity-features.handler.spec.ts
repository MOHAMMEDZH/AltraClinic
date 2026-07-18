import { GetIdentityFeaturesHandler } from '../application/handlers/get-identity-features.handler';



describe('GetIdentityFeaturesHandler', () => {

  it('merges plan and tenant features with smsInvites requiring both', async () => {

    const prisma = {

      tenant: {

        findUnique: jest.fn().mockResolvedValue({ features: { smsInvites: true } }),

      },

    };

    const tenantContext = { resolve: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }) };

    const licensing = {

      resolveLicense: jest.fn().mockResolvedValue({

        backendFeatures: { smsInvites: true, advancedAnalytics: true },

        features: { analytics: 'enabled' },

      }),

    };

    const handler = new GetIdentityFeaturesHandler(prisma as never, tenantContext as never, licensing as never);

    const result = await handler.execute();

    expect(result.smsInvites).toBe(true);

    expect(result.advancedAnalytics).toBe(true);

  });



  it('disables smsInvites when tenant flag is off', async () => {

    const prisma = {

      tenant: {

        findUnique: jest.fn().mockResolvedValue({ features: { smsInvites: false } }),

      },

    };

    const tenantContext = { resolve: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }) };

    const licensing = {

      resolveLicense: jest.fn().mockResolvedValue({

        backendFeatures: { smsInvites: true },

        features: {},

      }),

    };

    const handler = new GetIdentityFeaturesHandler(prisma as never, tenantContext as never, licensing as never);

    const result = await handler.execute();

    expect(result.smsInvites).toBe(false);

  });

});

