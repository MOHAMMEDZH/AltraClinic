import { describe, expect, it } from 'vitest';
import { AI_CONVERSATION_VIRTUAL_THRESHOLD } from '../lib/ai-types';

describe('ai-types', () => {
  it('virtualizes conversation lists at threshold', () => {
    expect(AI_CONVERSATION_VIRTUAL_THRESHOLD).toBe(20);
  });
});
