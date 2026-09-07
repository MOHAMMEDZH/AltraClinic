/**
 * Jest setup: enable dual-gate rate-limit test bypass for this worker only.
 * NODE_ENV=test alone does not disable the limiter — this allow flag is required
 * together with JEST_WORKER_ID (set automatically by Jest).
 */
process.env.API_RATE_LIMIT_ALLOW_TEST_BYPASS = '1';
