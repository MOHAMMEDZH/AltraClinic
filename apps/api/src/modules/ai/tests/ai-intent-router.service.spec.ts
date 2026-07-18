import { AiIntentRouterService } from '../application/services/ai-intent-router.service';

describe('AiIntentRouterService', () => {
  const router = new AiIntentRouterService();

  it('returns null for unrelated text', () => {
    expect(router.route('hello there', {}, 'en')).toBeNull();
  });

  it('maps context keys for patient summary', () => {
    const route = router.route(
      'patient summary',
      { patientId: 'a1000000-0000-4000-8000-000000000099', path: '/patients/x' },
      'en',
    );
    expect(route?.skillId).toBe('patient.summary');
  });

  it('respects Arabic locale phrases', () => {
    const route = router.route('مواعيد اليوم', { path: '/appointments' }, 'ar');
    expect(route?.skillId).toBe('appointments.today');
  });
});
