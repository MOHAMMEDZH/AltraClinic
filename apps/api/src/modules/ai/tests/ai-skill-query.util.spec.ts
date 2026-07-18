import { extractPatientSearchQuery } from '../domain/utils/ai-skill-query.util';

describe('ai-skill-query.util', () => {
  it('extracts patient name from open patient phrase', () => {
    expect(extractPatientSearchQuery('open patient John Smith')).toBe('John Smith');
    expect(extractPatientSearchQuery('find patient Sara')).toBe('Sara');
  });

  it('returns null for incomplete phrases', () => {
    expect(extractPatientSearchQuery('open patient')).toBeNull();
    expect(extractPatientSearchQuery('open patients')).toBeNull();
  });
});
