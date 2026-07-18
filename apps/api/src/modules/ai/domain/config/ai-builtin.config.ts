/** When true (default), chat uses built-in skills only — no Gemini/OpenAI. Set AI_BUILTIN_ONLY=false to allow external LLMs. */
export function isBuiltinOnlyAiMode(): boolean {
  const raw = process.env.AI_BUILTIN_ONLY?.trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return true;
}
