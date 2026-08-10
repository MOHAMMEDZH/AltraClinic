/**
 * Step 17 provenance classification unit tests (no DB).
 */
import { classifyRuntimeProvenance, isRuntimeDenyCode } from '../domain/runtime-provenance';

describe('Step 17 runtime provenance classification (unit)', () => {
  it('NEVER_MANAGED when all history absent', () => {
    const p = classifyRuntimeProvenance({
      platformTenantId: 'pt',
      configCount: 0,
      snapshotCount: 0,
      fingerprintCount: 0,
      terminalConfigCount: 0,
      activatedConfigCount: 0,
      currentCount: 0,
      currents: [],
    });
    expect(p.provenance).toBe('NEVER_MANAGED');
    expect(p.source).toBe('LEGACY');
    expect(p.code).toBe('legacy_never_managed');
  });

  it('zero-current with history → AUTHORITATIVE_TERMINAL (not legacy)', () => {
    const p = classifyRuntimeProvenance({
      platformTenantId: 'pt',
      configCount: 1,
      snapshotCount: 1,
      fingerprintCount: 1,
      terminalConfigCount: 1,
      activatedConfigCount: 1,
      currentCount: 0,
      currents: [],
    });
    expect(p.provenance).toBe('AUTHORITATIVE_TERMINAL');
    expect(p.source).toBe('SNAPSHOT');
    expect(p.errorCode).toBe('runtime_terminal');
    expect(p.source).not.toBe('LEGACY');
  });

  it('ACTIVE with snapshot → AUTHORITATIVE_ACTIVE', () => {
    const p = classifyRuntimeProvenance({
      platformTenantId: 'pt',
      configCount: 1,
      snapshotCount: 1,
      fingerprintCount: 1,
      terminalConfigCount: 0,
      activatedConfigCount: 1,
      currentCount: 1,
      currents: [
        {
          id: 'c1',
          lifecycle: 'ACTIVE_COMMERCIAL',
          predecessorId: null,
          platformTenantId: 'pt',
          snapshot: { id: 's1', fingerprint: 'fp' },
        },
      ],
    });
    expect(p.provenance).toBe('AUTHORITATIVE_ACTIVE');
    expect(p.snapshotId).toBe('s1');
  });

  it('Draft successor with predecessor → AUTHORITATIVE_PENDING_SUCCESSOR', () => {
    const p = classifyRuntimeProvenance({
      platformTenantId: 'pt',
      configCount: 2,
      snapshotCount: 1,
      fingerprintCount: 1,
      terminalConfigCount: 1,
      activatedConfigCount: 1,
      currentCount: 1,
      currents: [
        {
          id: 'draft',
          lifecycle: 'DRAFT',
          predecessorId: 'pred',
          platformTenantId: 'pt',
          snapshot: null,
        },
      ],
    });
    expect(p.provenance).toBe('AUTHORITATIVE_PENDING_SUCCESSOR');
    expect(p.predecessorHandoff).toBe(true);
    expect(p.source).toBe('SNAPSHOT');
  });

  it('first Draft before activation → AUTHORITATIVE_PENDING_ACTIVATION (not legacy)', () => {
    const p = classifyRuntimeProvenance({
      platformTenantId: 'pt',
      configCount: 1,
      snapshotCount: 0,
      fingerprintCount: 0,
      terminalConfigCount: 0,
      activatedConfigCount: 0,
      currentCount: 1,
      currents: [
        {
          id: 'd1',
          lifecycle: 'DRAFT',
          predecessorId: null,
          platformTenantId: 'pt',
          snapshot: null,
        },
      ],
    });
    expect(p.provenance).toBe('AUTHORITATIVE_PENDING_ACTIVATION');
    expect(p.errorCode).toBe('runtime_pending_activation');
    expect(p.source).not.toBe('LEGACY');
  });

  it('ambiguous current → AUTHORITATIVE_INVALID', () => {
    const p = classifyRuntimeProvenance({
      platformTenantId: 'pt',
      configCount: 2,
      snapshotCount: 0,
      fingerprintCount: 0,
      terminalConfigCount: 0,
      activatedConfigCount: 0,
      currentCount: 2,
      currents: [
        {
          id: 'a',
          lifecycle: 'DRAFT',
          predecessorId: null,
          platformTenantId: 'pt',
          snapshot: null,
        },
        {
          id: 'b',
          lifecycle: 'DRAFT',
          predecessorId: null,
          platformTenantId: 'pt',
          snapshot: null,
        },
      ],
    });
    expect(p.provenance).toBe('AUTHORITATIVE_INVALID');
    expect(p.errorCode).toBe('current_configuration_ambiguous');
  });

  it('isRuntimeDenyCode covers terminal and pending codes', () => {
    expect(isRuntimeDenyCode('runtime_terminal')).toBe(true);
    expect(isRuntimeDenyCode('runtime_cancelled')).toBe(true);
    expect(isRuntimeDenyCode('runtime_pending_activation')).toBe(true);
    expect(isRuntimeDenyCode('snapshot_resolved')).toBe(false);
    expect(isRuntimeDenyCode('legacy_never_managed')).toBe(false);
  });
});
