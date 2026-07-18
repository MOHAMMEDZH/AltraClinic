import { GeminiAiProvider } from '../application/services/providers/gemini-ai.provider';

describe('GeminiAiProvider', () => {
  const originalKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
  });

  it('reports configured when API key is set', () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const provider = new GeminiAiProvider();
    expect(provider.isConfigured()).toBe(true);
    expect(provider.resolveModel()).toMatch(/^gemini/);
  });

  it('is not configured without API key', () => {
    delete process.env.GEMINI_API_KEY;
    const provider = new GeminiAiProvider();
    expect(provider.isConfigured()).toBe(false);
  });
});
