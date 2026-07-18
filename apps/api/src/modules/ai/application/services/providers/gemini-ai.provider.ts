import { Injectable, Logger } from '@nestjs/common';

import type { AiEnrichedContext, AiInferenceInput, AiInferenceResult, AiUserPreferences } from '../ai-inference.types';

import {

  AiHttpError,

  EmptyAiProviderResponseError,

  extractGeminiResponseText,

  fetchWithRetry,

  maxOutputTokens,

  parseGeminiSseLine,

} from '../ai-http.util';



@Injectable()

export class GeminiAiProvider {

  private readonly logger = new Logger(GeminiAiProvider.name);



  isConfigured(): boolean {

    return Boolean(process.env.GEMINI_API_KEY?.trim());

  }



  resolveModel(preferences?: AiUserPreferences): string {

    const preferred = preferences?.preferredModel?.trim();

    if (preferred && preferred.startsWith('gemini')) return preferred;

    return process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

  }



  async generate(

    input: AiInferenceInput,

    enriched: AiEnrichedContext,

    started: number,

  ): Promise<AiInferenceResult> {

    const apiKey = process.env.GEMINI_API_KEY!.trim();

    const model = this.resolveModel(input.preferences);

    const temperature = input.preferences?.temperature ?? 0.3;



    const contents = [

      ...enriched.history.map((h) => ({

        role: h.role === 'assistant' ? 'model' : 'user',

        parts: [{ text: h.content }],

      })),

      { role: 'user', parts: enriched.userParts },

    ];



    const response = await fetchWithRetry(

      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,

      {

        method: 'POST',

        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },

        body: JSON.stringify({

          systemInstruction: { parts: [{ text: enriched.systemPrompt }] },

          contents,

          generationConfig: {

            temperature,

            maxOutputTokens: maxOutputTokens(input.preferences?.responseLength),

          },

        }),

      },

    );



    if (!response.ok) {

      const body = await response.text();

      throw new AiHttpError(`Gemini HTTP ${response.status}`, response.status, body.slice(0, 300));

    }



    const payload = (await response.json()) as {

      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;

      usageMetadata?: { totalTokenCount?: number };

    };

    const content = extractGeminiResponseText(payload).trim();

    if (!content) {

      throw new EmptyAiProviderResponseError('gemini');

    }



    this.logger.debug(`Gemini ${model} ${Date.now() - started}ms`);

    return {

      content,

      citations: enriched.citations,

      tokenCount: payload.usageMetadata?.totalTokenCount ?? Math.ceil(content.length / 4),

      latencyMs: Date.now() - started,

      provider: 'gemini',

      model,

    };

  }



  async *stream(

    input: AiInferenceInput,

    enriched: AiEnrichedContext,

    started: number,

  ): AsyncGenerator<string, AiInferenceResult, void> {

    const apiKey = process.env.GEMINI_API_KEY!.trim();

    const model = this.resolveModel(input.preferences);

    const temperature = input.preferences?.temperature ?? 0.3;



    const contents = [

      ...enriched.history.map((h) => ({

        role: h.role === 'assistant' ? 'model' : 'user',

        parts: [{ text: h.content }],

      })),

      { role: 'user', parts: enriched.userParts },

    ];



    const response = await fetchWithRetry(

      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,

      {

        method: 'POST',

        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },

        body: JSON.stringify({

          systemInstruction: { parts: [{ text: enriched.systemPrompt }] },

          contents,

          generationConfig: {

            temperature,

            maxOutputTokens: maxOutputTokens(input.preferences?.responseLength),

          },

        }),

      },

      { timeoutMs: 120_000 },

    );



    if (!response.ok) {

      const body = await response.text();

      throw new AiHttpError(`Gemini stream HTTP ${response.status}`, response.status, body.slice(0, 300));

    }



    const reader = response.body?.getReader();

    if (!reader) throw new Error('Gemini stream body missing');



    const decoder = new TextDecoder();

    let lineBuffer = '';

    let full = '';



    while (true) {

      const { done, value } = await reader.read();

      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });

      const lines = lineBuffer.split('\n');

      lineBuffer = lines.pop() ?? '';



      for (const line of lines) {

        const chunk = parseGeminiSseLine(line);

        if (chunk) {

          full += chunk;

          yield chunk;

        }

      }

    }



    const tail = parseGeminiSseLine(lineBuffer);

    if (tail) {

      full += tail;

      yield tail;

    }



    if (!full.trim()) {

      throw new EmptyAiProviderResponseError('gemini');

    }



    return {

      content: full,

      citations: enriched.citations,

      tokenCount: Math.ceil(full.length / 4),

      latencyMs: Date.now() - started,

      provider: 'gemini',

      model,

    };

  }



  async healthCheck(): Promise<{ ok: boolean; latencyMs?: number; message?: string }> {

    if (!this.isConfigured()) return { ok: false, message: 'GEMINI_API_KEY not set' };

    const started = Date.now();

    try {

      const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

      const response = await fetchWithRetry(

        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,

        {

          method: 'POST',

          headers: {

            'Content-Type': 'application/json',

            'x-goog-api-key': process.env.GEMINI_API_KEY!.trim(),

          },

          body: JSON.stringify({

            contents: [{ role: 'user', parts: [{ text: 'ping' }] }],

            generationConfig: { maxOutputTokens: 8 },

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


