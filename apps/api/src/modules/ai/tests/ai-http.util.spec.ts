import { extractGeminiResponseText, parseGeminiSseLine } from '../application/services/ai-http.util';

describe('ai-http.util Gemini SSE helpers', () => {
  it('extracts text from generateContent payload', () => {
    const text = extractGeminiResponseText({
      candidates: [{ content: { parts: [{ text: 'Hello' }, { text: ' world' }] } }],
    });
    expect(text).toBe('Hello world');
  });

  it('ignores parts without text (thought signature chunks)', () => {
    const text = extractGeminiResponseText({
      candidates: [{ content: { parts: [{ thoughtSignature: 'abc' } as never, { text: 'Done' }] } }],
    });
    expect(text).toBe('Done');
  });

  it('parses newline-delimited SSE data lines', () => {
    const line =
      'data: {"candidates":[{"content":{"parts":[{"text":"Hi"}],"role":"model"}}]}';
    expect(parseGeminiSseLine(line)).toBe('Hi');
  });

  it('returns empty string for non-data lines', () => {
    expect(parseGeminiSseLine('event: ping')).toBe('');
  });
});
