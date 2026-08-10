import { useState } from 'react';

interface RecoveryCodesPanelProps {
  codes: string[];
  onAcknowledge: () => void;
}

/**
 * One-time display for MFA recovery codes. The API never returns these
 * again, so the caller must explicitly confirm they were saved before this
 * unmounts (acknowledging clears them from memory).
 */
export function RecoveryCodesPanel({ codes, onAcknowledge }: RecoveryCodesPanelProps) {
  const [saved, setSaved] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  async function onCopyAll() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }

  return (
    <section className="sa-recovery-panel" aria-labelledby="recovery-codes-heading">
      <h2 id="recovery-codes-heading">Save your recovery codes</h2>
      <p className="sa-error" role="alert">
        These codes will not be shown again. Store them in a password manager or another safe
        place — each can be used once if you lose access to your authenticator app.
      </p>

      <ul className="sa-recovery-codes">
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ul>

      <div className="sa-recovery-actions">
        <button type="button" className="sa-button sa-button-quiet" onClick={onCopyAll}>
          {copyState === 'copied' ? 'Copied' : 'Copy all codes'}
        </button>
        {copyState === 'error' ? (
          <span className="sa-error" role="alert">
            Unable to copy — please copy manually.
          </span>
        ) : null}
      </div>

      <label className="sa-checkbox-field">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
        />
        I have saved these recovery codes in a safe place.
      </label>

      <button type="button" className="sa-button" disabled={!saved} onClick={onAcknowledge}>
        Continue
      </button>
    </section>
  );
}
