/**
 * Explicit Round 19 oracle evidence export (not run during normal Jest gates).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
require('ts-node/register/transpile-only');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const outDir = path.join(
  repoRoot,
  'docs/PHASE_48_WAVE_F_IMPLEMENTATION_REVIEW_PACKAGE/ROUND_19_RAW_GATE_OUTPUTS',
);

const { writeRound19OracleEvidence, formatOracleReportLine } = require(
  '../src/modules/workforce-commercials/tests/refund-complete-set-exhaustive-oracle.ts',
);

const report = writeRound19OracleEvidence(outDir);
console.log(formatOracleReportLine(report));
console.log(`Evidence written to ${outDir}`);
