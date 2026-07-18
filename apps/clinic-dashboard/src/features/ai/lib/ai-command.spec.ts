import { describe, expect, it } from 'vitest';
import { extractOpenPatientQuery } from './ai-command-patient';
import { buildLocalCommandFallback } from './ai-command-fallback';

describe('ai-command-patient', () => {
  it('extracts patient name from open patient command', () => {
    expect(extractOpenPatientQuery('open patient John Smith')).toBe('John Smith');
    expect(extractOpenPatientQuery('find patient Sara')).toBe('Sara');
  });

  it('ignores generic open patient without a name', () => {
    expect(extractOpenPatientQuery('open patient')).toBeNull();
    expect(extractOpenPatientQuery('open patients')).toBeNull();
  });
});

describe('ai-command-fallback', () => {
  it('returns navigation commands when query is empty', () => {
    const items = buildLocalCommandFallback('');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.kind === 'navigate')).toBe(true);
  });

  it('filters fallback commands by phrase', () => {
    const items = buildLocalCommandFallback('book appointment');
    expect(items.some((item) => item.id === 'book-appointment')).toBe(true);
  });
});
