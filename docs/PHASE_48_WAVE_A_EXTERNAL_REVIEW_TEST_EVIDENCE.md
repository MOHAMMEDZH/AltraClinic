# Phase 48 Wave A — External Review Test Evidence

| Field | Value |
|-------|--------|
| **Captured** | 2026-08-14 (local evidence run) |
| **HEAD** | `416c0981728a8cc2c88494352e1ec4413727efdf` |
| **Branch** | `cursor/phase48-wave-a-foundation` |

## Commands

### 1. Prisma validate

```text
command = cd apps/api; npx prisma validate
exit code = 0
PASS/FAIL = PASS
test count = n/a (schema validation)
key assertion = schema at prisma/schema.prisma is valid
duration = ~1341 ms
```

### 2. Clinical catalog integrity + price unit tests

```text
command = npx jest --runInBand src/modules/clinical-catalog/tests/clinical-catalog.integrity.unit.spec.ts src/modules/clinical-catalog/tests/clinical-price.unit.spec.ts
exit code = 0
PASS/FAIL = PASS
test count = 15
key assertion = stableKey/namespace/bilingual publish/SYSTEM_CANONICAL deny/tenant isolation predicates; price precedence/fail-closed/lock key/overlap helper
duration = ~7528 ms
```

### 3. Clean migration validator

```text
command = node scripts/validate-phase48-wave-a-clean.mjs
exit code = 0
PASS/FAIL = PASS
test count = validator assertions (tables, indexes, 7 shared SYSTEM_CANONICAL, idempotent backfill)
key assertion = PHASE48_WAVE_A_CLEAN_VALIDATOR_PASSED
duration = ~6169 ms
```

### 4. Upgrade migration validator

```text
command = node scripts/validate-phase48-wave-a-upgrade.mjs
exit code = 0
PASS/FAIL = PASS
test count = validator assertions (additive deploy, Appointment.serviceType preserved, shared backfill)
key assertion = PHASE48_WAVE_A_UPGRADE_VALIDATOR_PASSED
duration = ~6264 ms
note = ServicePrice digest skipped when no tenants in empty upgrade DB
```

### 5. Permission matrix validation

```text
command = npm run validate:permission-matrix
exit code = 1
PASS/FAIL = FAIL
test count = n/a
key assertion = matrix.actions omits 'manage' while resources (including pre-existing api.billing and new api.clinical-catalog) use manage
duration = ~433 ms
classification = pre-existing validator/schema mismatch; Wave A followed existing pattern
```

### 6. Super Admin clinical-catalog UI tests

```text
command = cd apps/super-admin; npm test -- --run src/pages/clinical-catalog.spec.tsx
exit code = 0
PASS/FAIL = PASS
test count = 3
key assertion = ClinicalCatalogPage renders EN/AR list + create/lifecycle smoke
duration = ~1.51 s suite
```

### 7. Clinic Dashboard clinical-catalog UI tests

```text
command = cd apps/clinic-dashboard; npm test -- --run src/features/clinical-catalog/clinical-catalog.spec.tsx
exit code = 0
PASS/FAIL = PASS
test count = 2
key assertion = clinical catalog feature smoke
duration = ~1.28 s suite
```

### 8. True concurrent PriceVersion publish test

```text
true concurrent PriceVersion publish test = MISSING
```

### Explicitly not run

```text
Step 29 final onepass = NOT RUN
Step 28 Case C = NOT RUN
Phase 49 suites = NOT RUN
```
