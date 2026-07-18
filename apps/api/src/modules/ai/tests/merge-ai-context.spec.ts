import { mergeAiContext } from '../domain/utils/merge-ai-context';

describe('mergeAiContext', () => {
  it('merges live context over stored values', () => {
    const merged = mergeAiContext(
      { patientId: 'p1', path: '/patients/p1', module: 'patients' },
      { patientId: 'p2', path: '/patients/p2' },
    );
    expect(merged.patientId).toBe('p2');
    expect(merged.path).toBe('/patients/p2');
    expect(merged.module).toBe('patients');
  });

  it('ignores empty live values', () => {
    const merged = mergeAiContext({ patientId: 'p1' }, { patientId: '', encounterId: 'e1' });
    expect(merged.patientId).toBe('p1');
    expect(merged.encounterId).toBe('e1');
  });
});
