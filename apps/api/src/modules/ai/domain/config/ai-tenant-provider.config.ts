export type AiTenantExternalProvider = 'gemini' | 'openai' | 'auto';

export interface AiTenantProviderSettings {
  preferredExternalProvider: AiTenantExternalProvider;
  geminiEnabled: boolean;
  openaiEnabled: boolean;
}

export const AI_TENANT_PROVIDER_DEFAULTS: AiTenantProviderSettings = {
  preferredExternalProvider: 'auto',
  geminiEnabled: true,
  openaiEnabled: true,
};

export function normalizeTenantProviderSettings(raw: unknown): AiTenantProviderSettings {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<AiTenantProviderSettings>;
  const preferred =
    obj.preferredExternalProvider === 'gemini' || obj.preferredExternalProvider === 'openai'
      ? obj.preferredExternalProvider
      : 'auto';
  return {
    preferredExternalProvider: preferred,
    geminiEnabled: obj.geminiEnabled !== false,
    openaiEnabled: obj.openaiEnabled !== false,
  };
}

export function parseTenantSettingsJson(json: unknown): AiTenantProviderSettings {
  const root = (json && typeof json === 'object' ? json : {}) as { providers?: unknown };
  return normalizeTenantProviderSettings(root.providers);
}

export function toTenantSettingsJson(settings: AiTenantProviderSettings): { providers: AiTenantProviderSettings } {
  return { providers: settings };
}
