/**
 * Thin ESM wrapper — NO business logic.
 * Authoritative implementation: phase48-wave-b-snapshot-backfill.cjs
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const impl = require(path.join(path.dirname(fileURLToPath(import.meta.url)), 'phase48-wave-b-snapshot-backfill.cjs'));

export const LEGACY_APPOINTMENT_SERVICE_TYPE = impl.LEGACY_APPOINTMENT_SERVICE_TYPE;
export const DEFAULT_BATCH_SIZE = impl.DEFAULT_BATCH_SIZE;
export const CUTOVER_MARKER_KEY = impl.CUTOVER_MARKER_KEY;
export const PSEUDO_CUTOVER_FORBIDDEN = impl.PSEUDO_CUTOVER_FORBIDDEN;
export const CLASS = impl.CLASS;
export const runPhase48WaveBSnapshotBackfill = impl.runPhase48WaveBSnapshotBackfill;
export const classifyMissingSnapshotAppointment = impl.classifyMissingSnapshotAppointment;
export const assertSafeTestDatabaseUrl = impl.assertSafeTestDatabaseUrl;
export const printSafeDatabaseIdentity = impl.printSafeDatabaseIdentity;
export const countEligibleRemaining = impl.countEligibleRemaining;
export const countClassifiedRemaining = impl.countClassifiedRemaining;
export const loadCutoverWatermark = impl.loadCutoverWatermark;
