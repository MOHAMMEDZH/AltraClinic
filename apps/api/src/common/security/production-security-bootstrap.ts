/**
 * Production HTTP bootstrap security assertions (Step 28 RLTEST containment).
 * Called from main.ts before listening.
 */
export function assertProductionSecurityBootstrap(env: NodeJS.ProcessEnv = process.env): void {
  // Refuse accidental production-like HTTP listen under NODE_ENV=test unless
  // an explicit bootstrap allow is present (local harness only).
  if (env.NODE_ENV === 'test' && env.ALLOW_TEST_HTTP_BOOTSTRAP !== '1') {
    throw new Error(
      'Refusing HTTP API bootstrap with NODE_ENV=test without ALLOW_TEST_HTTP_BOOTSTRAP=1. ' +
        'Production security controls must not run under an accidental test environment label.',
    );
  }

  // Rate-limit bypass env alone must never be treated as production-safe.
  if (
    env.API_RATE_LIMIT_ALLOW_TEST_BYPASS === '1' &&
    !env.JEST_WORKER_ID &&
    env.NODE_ENV !== 'test'
  ) {
    throw new Error(
      'API_RATE_LIMIT_ALLOW_TEST_BYPASS=1 is not valid outside a Jest worker. ' +
        'Remove this variable from production/deployment configuration.',
    );
  }
}
