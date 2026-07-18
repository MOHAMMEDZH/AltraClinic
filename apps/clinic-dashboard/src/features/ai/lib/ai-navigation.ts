export interface AiChatLocationState {
  autoInfer?: boolean;
}

export const AI_CHAT_AUTO_INFER_STATE: AiChatLocationState = { autoInfer: true };

export function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  );
}
