import { describe, expect, it } from 'vitest';
import { parseAiMarkdown } from './ai-markdown-parse';

describe('parseAiMarkdown', () => {
  it('groups bullet lines into a list', () => {
    const blocks = parseAiMarkdown(
      '**Outstanding balances**\n- Open invoices: **5**\n- Amount due: **100 USD**\n- Overdue: **2**',
    );
    expect(blocks).toEqual([
      { type: 'section', text: 'Outstanding balances' },
      {
        type: 'ul',
        items: ['Open invoices: **5**', 'Amount due: **100 USD**', 'Overdue: **2**'],
      },
    ]);
  });

  it('splits footer after horizontal rule', () => {
    const blocks = parseAiMarkdown('Answer body\n\n---\n*Built-in clinic assistant — verify facts.*');
    expect(blocks.some((b) => b.type === 'hr')).toBe(true);
    expect(blocks.some((b) => b.type === 'footer' && b.text.includes('Built-in clinic assistant'))).toBe(true);
  });
});
