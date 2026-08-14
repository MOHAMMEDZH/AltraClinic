# Phase 48 Wave A — Price Concurrency Test Evidence

| Field | Value |
|-------|--------|
| **Suite** | `clinical-price.concurrency.postgres.integration.spec.ts` |
| **Status** | PASS (PA-02 + PA-04 concurrency) |

## Command

```text
ALLOW_TEST_DATABASE_RESET=true RUN_PLATFORM_DB_SECURITY=true \
npx jest --runInBand --testPathIgnorePatterns=[] \
  --testPathPattern=clinical-price.concurrency.postgres.integration.spec
```

## Result

```text
Test Suites: 1 passed
Tests:       10 passed
```

## Coverage

- concurrent double-publish same key → ≤1 ACTIVE
- concurrent future schedule after ACTIVE → 1 SCHEDULED, prior ACTIVE immutable, ACTIVE overlap = 0
- branch-specific commercial key concurrency
- different commercial keys both succeed
- PA-04 schedule + chain invariants
- PA-07 commercial identity distinction
