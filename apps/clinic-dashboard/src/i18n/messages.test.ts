import { describe, expect, it } from 'vitest';
import { formatMessage } from '@/i18n/messages';

describe('formatMessage', () => {
  it('replaces placeholders', () => {
    expect(formatMessage('Revoked {count} session(s).', { count: 3 })).toBe(
      'Revoked 3 session(s).',
    );
  });
});
