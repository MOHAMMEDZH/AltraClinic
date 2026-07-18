import { OutboundBrandingResolverService } from '../outbound-branding-resolver.service';

describe('OutboundBrandingResolverService', () => {
  it('wraps email HTML with header/footer and RTL when locale is ar', async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'Demo Clinic',
          locale: 'ar-SY',
          customDomain: 'portal.demo.clinic',
          features: {
            branding: {
              senderDisplayName: 'Demo Care',
              primaryColor: '#0f766e',
              logoUrl: 'https://cdn.example.com/logo.png',
              portalBaseUrl: 'https://portal.demo.clinic',
            },
          },
        }),
      },
      branch: { findFirst: jest.fn().mockResolvedValue({ name: 'Main Branch' }) },
    };

    const resolver = new OutboundBrandingResolverService(prisma as never);
    const branding = await resolver.resolve('tenant-1', 'branch-1', 'ar');
    expect(branding.clinicName).toBe('Demo Clinic');
    expect(branding.senderDisplayName).toBe('Demo Care');
    expect(branding.rtl).toBe(true);
    expect(branding.brandingRef).toMatch(/^wl:/);

    const html = resolver.wrapEmailHtml('<p>Hello</p>', branding);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('Demo Care');
    expect(html).toContain('Main Branch');
    expect(html).toContain('https://cdn.example.com/logo.png');
    expect(html).toContain('Hello');
  });
});
