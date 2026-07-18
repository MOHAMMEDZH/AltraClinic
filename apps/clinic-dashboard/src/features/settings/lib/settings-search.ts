import type { SettingsNavItem } from '../config/settings-config';

export function searchSettings(query: string, items: SettingsNavItem[]): SettingsNavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return items.filter((item) => {
    const label = item.labelKey.toLowerCase();
    const desc = item.descriptionKey.toLowerCase();
    return (
      item.id.includes(q) ||
      label.includes(q) ||
      desc.includes(q) ||
      item.keywords.some((kw) => kw.toLowerCase().includes(q))
    );
  });
}
