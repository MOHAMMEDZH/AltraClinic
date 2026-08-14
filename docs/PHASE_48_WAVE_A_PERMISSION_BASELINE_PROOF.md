# Phase 48 Wave A — Permission Baseline Proof (PA-01 / EVIDENCE-A)

| Field | Value |
|-------|--------|
| **Documented** | 2026-08-14 |
| **Wave A implementation commit** | `416c0981728a8cc2c88494352e1ec4413727efdf` |
| **Baseline parent** | `416c098^` |

## Claim

```text
Global permission-matrix validator FAIL is PRE-EXISTING BASELINE DEBT.
Wave A did not create the underlying validator/actions mismatch.
Wave A route additions are synchronized across three matrix files.
Targeted Wave A permission-routes validator = PASS.
```

## Proof 1 — `manage` existed before Wave A

Command:

```bash
git show 416c0981728a8cc2c88494352e1ec4413727efdf^:packages/permissions/permission-matrix.json
```

Observed at parent:

```text
actions includes "manage"
matrix comment: "7 actions: view/create/update/delete/approve/export/manage"
count of "action": "manage" operations at parent = 61
api.clinical-catalog resource = ABSENT at parent
```

## Proof 2 — validator allowlist mismatch predated Wave A

At parent commit, `apps/api/scripts/validate-permission-matrix.mjs` required:

```javascript
const requiredActions = ['view', 'create', 'update', 'delete', 'approve', 'export'];
// and: if (!requiredActions.includes(operation.action)) → error
```

Therefore any matrix that:

1. lists `manage` in `matrix.actions`, or
2. declares operations with `"action": "manage"`

fails the global validator **before** Wave A added `api.clinical-catalog`.

Wave A added more `manage` operations (clinical-catalog + price routes on billing) — Category C surface expansion of the same pre-existing convention — it did not invent the allowlist mismatch.

## Proof 3 — Wave A matrix delta is synchronized route additions

Command:

```bash
git diff 416c098^ 416c098 -- packages/permissions/permission-matrix.json
```

Observed:

```text
+ api.clinical-catalog resource + service/config operations
+ clinical-catalog price routes under api.billing
```

The same Wave A routes are present in:

```text
packages/permissions/permission-matrix.json
apps/api/config/permission-matrix.json
docs/permission-matrix.json
```

## Proof 4 — targeted Wave A validator PASS

Command:

```bash
node apps/api/scripts/validate-phase48-wave-a-permission-routes.mjs
```

Result:

```text
PHASE48_WAVE_A_PERMISSION_ROUTES_VALIDATOR_PASSED
Validated Wave A clinical-catalog + price routes across 3 matrix files.
```

## Proof 5 — global validator still FAIL (honest baseline)

Command:

```bash
npm run validate:permission-matrix -w booking-system-api
```

Result:

```text
FAIL — many "invalid operation action manage" findings including pre-existing resources
(api.billing, api.settings, api.notifications, …) plus Wave A surfaces
```

## Status

```text
PA-01 baseline proof included = YES
PA-01 Wave A permission validation = PASS (targeted)
PA-01 status = CLOSED (baseline debt classification retained)
```
