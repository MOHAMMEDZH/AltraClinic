export function parseInventoryDate(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}
