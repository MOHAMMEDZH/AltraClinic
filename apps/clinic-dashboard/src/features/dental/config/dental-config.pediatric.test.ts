import { describe, expect, it } from 'vitest';
import { pediatricLetter, PEDIATRIC_UPPER } from '../config/dental-config';

describe('dental-config pediatric', () => {
  it('maps primary teeth to letters A–J on upper arch', () => {
    expect(PEDIATRIC_UPPER).toHaveLength(10);
    expect(pediatricLetter(1)).toBe('A');
    expect(pediatricLetter(10)).toBe('J');
  });
});
