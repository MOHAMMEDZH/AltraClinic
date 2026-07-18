import { Injectable, Logger } from '@nestjs/common';
import type { AiEnrichedContext, AiInferenceInput, AiInferenceResult } from '../ai-inference.types';
import { AiHttpError, EmptyAiProviderResponseError, fetchWithRetry, maxOutputTokens } from '../ai-http.util';

@Injectable()
export class OpenAiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  resolveModel(preferences?: AiInferenceInput['preferences']): string {
    const preferred = preferences?.preferredModel?.trim();
    if (preferred && preferred.startsWith('gpt')) return preferred;
    return process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  }

  async generate(
    input: AiInferenceInput,
    enriched: AiEnrichedContext,
    started: number,
  ): Promise<AiInferenceResult> {
    const apiKey = process.env.OPENAI_API_KEY!.trim();
    const model = this.resolveModel(input.preferences);
    const temperature = input.preferences?.temperature ?? 0.3;

    const messages = [
      { role: 'system' as const, content: enriched.systemPrompt },
      ...enriched.history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: input.userMessage },
    ];

    const response = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxOutputTokens(input.preferences?.responseLength),
        messages,
      }),
    });

    if (!response.ok) {
      throw new AiHttpError(`OpenAI HTTP ${response.status}`, response.status, await response.text());
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    const content = payload.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) {
      throw new EmptyAiProviderResponseError('openai');
    }

    this.logger.debug(`OpenAI ${model} ${Date.now() - started}ms`);
    return {
      content,
      citations: enriched.citations,
      tokenCount: payload.usage?.total_tokens ?? Math.ceil(content.length / 4),
      latencyMs: Date.now() - started,
      provider: 'openai',
      model,
    };
  }

  async *stream(
    input: AiInferenceInput,
    enriched: AiEnrichedContext,
    started: number,
  ): AsyncGenerator<string, AiInferenceResult, void> {
    const apiKey = process.env.OPENAI_API_KEY!.trim();
    const model = this.resolveModel(input.preferences);
    const temperature = input.preferences?.temperature ?? 0.3;

    const messages = [
      { role: 'system' as const, content: enriched.systemPrompt },
      ...enriched.history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: input.userMessage },
    ];

    const response = await fetchWithRetry(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxOutputTokens(input.preferences?.responseLength),
          stream: true,
          messages,
        }),
      },
      { timeoutMs: 120_000 },
    );

    if (!response.ok) {
      throw new AiHttpError(`OpenAI stream HTTP ${response.status}`, response.status, await response.text());
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('OpenAI stream body missing');

    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const payload = JSON.parse(raw) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const chunk = payload.choices?.[0]?.delta?.content ?? '';
          if (chunk) {
            full += chunk;
            yield chunk;
          }
        } catch {
          // ignore
        }
      }
    }

    if (!full.trim()) {
      throw new EmptyAiProviderResponseError('openai');
    }

    return {
      content: full,
      citations: enriched.citations,
      tokenCount: Math.ceil(full.length / 4),
      latencyMs: Date.now() - started,
      provider: 'openai',
      model,
    };
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs?: number; message?: string }> {
    if (!this.isConfigured()) return { ok: false, message: 'OPENAI_API_KEY not set' };
    const started = Date.now();
    try {
      const response = await fetchWithRetry(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
            max_tokens: 5,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        },
        { retries: 0, timeoutMs: 15_000 },
      );
      return { ok: response.ok, latencyMs: Date.now() - started, message: response.ok ? undefined : `HTTP ${response.status}` };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - started, message: String(err) };
    }
  }
}
