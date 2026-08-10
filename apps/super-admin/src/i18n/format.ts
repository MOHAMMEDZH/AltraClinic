/**
 * Minimal `{token}` interpolation for translated strings. Deliberately
 * simple (no plural rules, no ICU) — Step 09 copy only ever needs single
 * safe-text substitutions (a target label, an email, a page number).
 */
export function formatMessage(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.split(`{${key}}`).join(String(value)),
    template,
  );
}
