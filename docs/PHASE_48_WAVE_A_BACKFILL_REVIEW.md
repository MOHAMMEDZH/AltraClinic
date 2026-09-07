# Phase 48 Wave A — Backfill / Legacy Mapping Review

| Field | Value |
|-------|--------|
| **Runner** | `apps/api/scripts/phase48-wave-a-backfill.mjs` → `run-wave-a-backfill.ts` |
| **Service** | `WaveABackfillService` |
| **Seed inventory** | `scheduling-seed.inventory.ts` imports exact `SCHEDULING_SERVICE_TYPES` |
| **HEAD** | `416c098` |

## Scheduling keys

Exact keys from `apps/api/src/modules/scheduling/domain/service-types.ts`:

```text
consultation, follow_up, procedure, cleaning, imaging, lab, emergency
```

Count = **7**. Each maps to shared stableKey `canonical.general.<id>`.

## Behavior verified

| Check | Result |
|-------|--------|
| exact existing scheduling keys used | YES |
| 7 known scheduling keys handled | YES |
| one shared SYSTEM_CANONICAL per known standard | YES (`tenantId=null`) |
| no canonical row per tenant | YES |
| TenantServiceConfiguration created separately | YES (when ServicePrice maps) |
| PriceVersion created separately | YES (copy from ServicePrice amounts; ServicePrice untouched) |
| idempotent rerun | YES — findUnique by stableKey; skip existing mappings |
| MAPPED supported | YES |
| LEGACY_UNMAPPED supported | YES (unknown serviceCode) |
| AMBIGUOUS supported | YES (enum + schema); backfill does **not** auto-assign AMBIGUOUS |
| unknown/ambiguous values never guessed | YES — unknown → LEGACY_UNMAPPED only |
| historical ServicePrice not destructively mutated | YES (read-only) |
| historical invoice values untouched | YES (no invoice writes) |

## Idempotency mechanism

```text
1. For each seed: findUnique(stableKey) → create only if missing
2. Legacy service mapping: findFirst(sourceSystem+sourceCode+tenantId null) → create only if missing
3. Legacy price mapping: findUnique(servicePriceId) → skip if exists
4. Tenant config: findFirst(tenant+service+branch null) → create only if missing
5. PriceVersion: findFirst ACTIVE same commercial key → reuse; else create
```

## Hardcoded scheduling fallback

```text
SCHEDULING_SERVICE_TYPES file untouched by Wave A
Appointment booking does not import clinical-catalog module
```

## Fuzzy guessing

```text
ambiguous guessed = NO
Production Acceptance blocker from guessing = NONE
```
