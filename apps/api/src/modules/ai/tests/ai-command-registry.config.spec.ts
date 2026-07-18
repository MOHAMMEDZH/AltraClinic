import { scoreCommandPhrase, scoreCommandDef, contextSatisfied } from '../domain/config/ai-command-registry.config';

describe('ai-command-registry.config', () => {
  it('scores exact phrase matches highest', () => {
    expect(scoreCommandPhrase('book appointment', 'book appointment')).toBe(100);
    expect(scoreCommandPhrase('book appoint', 'book appointment')).toBeGreaterThanOrEqual(72);
  });

  it('scores token overlap for partial natural language', () => {
    const score = scoreCommandDef('summarize this patient', {
      id: 'summarize-patient',
      labelKey: 'ai.actions.summarizePatient',
      kind: 'action',
      phrasesEn: ['summarize this patient', 'patient summary'],
      phrasesAr: [],
      smartActionId: 'summarize-patient',
      requiresContext: ['patientId'],
      workspace: 'medical',
      priority: 95,
    }, false);
    expect(score).toBeGreaterThan(40);
  });

  it('checks required context keys', () => {
    expect(contextSatisfied({ patientId: 'p1' }, ['patientId'])).toBe(true);
    expect(contextSatisfied({}, ['patientId'])).toBe(false);
    expect(contextSatisfied({ encounterId: 'e1' }, ['encounterId'])).toBe(true);
  });
});
