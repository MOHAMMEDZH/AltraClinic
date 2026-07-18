import type { AiResponseLength } from './ai-inference.types';

export class AiHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'AiHttpError';
  }
}

export interface FetchWithRetryOptions {
  retries?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const retryDelayMs = options.retryDelayMs ?? 400;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (response.ok || response.status < 500 || attempt === retries) {
        return response;
      }
      lastError = new AiHttpError(`Upstream HTTP ${response.status}`, response.status, await response.text());
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt === retries) break;
    }
    await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
  }

  if (lastError instanceof AiHttpError) throw lastError;
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function maxOutputTokens(length?: AiResponseLength): number {
  if (length === 'concise') return 512;
  if (length === 'detailed') return 2048;
  return 1024;
}

export class EmptyAiProviderResponseError extends Error {
  constructor(readonly provider: string) {
    super(`${provider} returned empty content`);
    this.name = 'EmptyAiProviderResponseError';
  }
}

type GeminiPayload = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

export function extractGeminiResponseText(payload: GeminiPayload): string {
  let text = '';
  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (typeof part.text === 'string' && part.text) {
        text += part.text;
      }
    }
  }
  return text;
}

/** Parse one Gemini SSE `data:` line (newline-delimited stream). */
export function parseGeminiSseLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return '';
  const raw = trimmed.slice(5).trim();
  if (!raw || raw === '[DONE]') return '';
  try {
    return extractGeminiResponseText(JSON.parse(raw) as GeminiPayload);
  } catch {
    return '';
  }
}
