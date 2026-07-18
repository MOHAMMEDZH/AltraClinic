export function mergeAiContext(
  stored: Record<string, unknown> | null | undefined,
  live: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const merged = { ...(stored ?? {}) };
  if (!live) return merged;

  for (const [key, value] of Object.entries(live)) {
    if (value === undefined || value === null || value === '') continue;
    merged[key] = value;
  }

  return merged;
}
