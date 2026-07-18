import { OpenAiProvider } from '../application/services/providers/openai-ai.provider';

describe('OpenAiProvider', () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalKey;
    process.env.OPENAI_MODEL = originalModel;
  });

  it('reports configured when API key is set', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const provider = new OpenAiProvider();
    expect(provider.isConfigured()).toBe(true);
  });

  it('is not configured without API key', () => {
    delete process.env.OPENAI_API_KEY;
    const provider = new OpenAiProvider();
    expect(provider.isConfigured()).toBe(false);
  });

  it('resolves preferred gpt model or env default', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_MODEL = 'gpt-4o-mini';
    const provider = new OpenAiProvider();
    expect(provider.resolveModel({ preferredModel: 'gpt-4o' })).toBe('gpt-4o');
    expect(provider.resolveModel({})).toBe('gpt-4o-mini');
  });
});
