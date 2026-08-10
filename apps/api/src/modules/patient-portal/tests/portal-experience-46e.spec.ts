/**
 * Phase 46e — experience readiness + preferences + branding regression.
 */
import { PortalBrandingResolverService } from '../application/services/portal-branding-resolver.service';
import { PatientPortalObservabilityContracts } from '../application/patient-portal-observability.contracts';
import { PATIENT_PORTAL_METRIC_NAMES } from '../patient-portal.constants';
import { PortalPreferencesVO } from '../domain/value-objects/portal-preferences.vo';

describe('Phase 46e — portal experience integrations', () => {
  it('registers experience observability metric names', () => {
    const names = [...PATIENT_PORTAL_METRIC_NAMES];
    expect(names).toContain('patient_portal.experience.home');
    expect(names).toContain('patient_portal.preferences.updates');
    expect(names).toContain('patient_portal.branding.resolve');
  });

  it('branding resolver returns defaults without tenant', async () => {
    const service = new PortalBrandingResolverService(
      { tenant: { findUnique: jest.fn() } } as never,
      new PatientPortalObservabilityContracts(),
    );
    const snapshot = await service.resolve(null);
    expect(snapshot.source).toBe('default');
    expect(snapshot.portalName).toBe('Patient Portal');
    expect(snapshot.primaryColor).toMatch(/^#/);
  });

  it('branding resolver maps tenant features.branding safely', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      name: 'North Clinic',
      features: {
        branding: {
          primaryColor: '#0ea5e9',
          accentColor: '#0369a1',
          logoUrl: 'https://cdn.example/logo.svg',
          faviconUrl: 'https://cdn.example/favicon.ico',
          fontFamily: 'Source Sans 3',
          portalName: 'North Patient Portal',
        },
      },
    });
    const service = new PortalBrandingResolverService(
      { tenant: { findUnique } } as never,
      new PatientPortalObservabilityContracts(),
    );
    const snapshot = await service.resolve('tenant-1');
    expect(snapshot.source).toBe('tenant');
    expect(snapshot.clinicName).toBe('North Clinic');
    expect(snapshot.portalName).toBe('North Patient Portal');
    expect(snapshot.primaryColor).toBe('#0ea5e9');
    expect(snapshot.secondaryColor).toBe('#0369a1');
    expect(snapshot.logoUrl).toContain('logo.svg');
  });

  it('portal preferences VO remains the portal-owned preference model', () => {
    const prefs = new PortalPreferencesVO('ar', { email: true, sms: false, push: true });
    expect(prefs.locale).toBe('ar');
    expect(prefs.channels.push).toBe(true);
    expect(prefs.equals(PortalPreferencesVO.default('en'))).toBe(false);
  });
});
