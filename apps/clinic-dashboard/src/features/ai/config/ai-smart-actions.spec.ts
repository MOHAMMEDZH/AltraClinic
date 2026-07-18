import { describe, expect, it } from 'vitest';
import { interpolateTemplate } from '../lib/ai-navigation';

describe('ai smart actions helpers', () => {
  it('interpolates template variables', () => {
    expect(interpolateTemplate('Ask AI: {query}', { query: 'stock levels' })).toBe(
      'Ask AI: stock levels',
    );
  });
});
