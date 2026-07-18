export const AI_MODEL_TYPES = [
  'summary',
  'search',
  'insight',
  'recommendation',
  'prediction',
  'assistant',
] as const;

export type AiModelType = (typeof AI_MODEL_TYPES)[number];

export function isAiModelType(value: string): value is AiModelType {
  return (AI_MODEL_TYPES as readonly string[]).includes(value);
}
