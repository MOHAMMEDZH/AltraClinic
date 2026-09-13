/**
 * Owner-facing identity: human name primary when SoR/API already provides it;
 * truncated UUID remains secondary (title / aria / monospace). Fail-closed: no name → UUID only.
 */
export function truncateIdentityId(id: string, visible = 8): string {
  const trimmed = id.trim();
  if (!trimmed) return '';
  if (trimmed.length <= visible) return trimmed;
  return `${trimmed.slice(0, visible)}…`;
}

export type NamedIdentityProps = {
  id: string;
  /** Already-resolved display name from an existing API field / directory join. Never invent. */
  name?: string | null;
  /** Accessible field label (e.g. i18n "Used by"). */
  fieldLabel: string;
  /** Monospace class for the truncated id. */
  idClassName?: string;
};

export function NamedIdentityDisplay({ id, name, fieldLabel, idClassName }: NamedIdentityProps) {
  const primary = name?.trim() || '';
  const truncated = truncateIdentityId(id);

  if (!id) {
    return <>—</>;
  }

  if (primary) {
    return (
      <span title={id} aria-label={`${fieldLabel}: ${primary} (${id})`}>
        <span>{primary}</span>{' '}
        <code className={idClassName} dir="ltr">
          {truncated}
        </code>
      </span>
    );
  }

  return (
    <code className={idClassName} dir="ltr" title={id} aria-label={`${fieldLabel}: ${id}`}>
      {truncated}
    </code>
  );
}
