# Super Admin — Subscription Management and Commercial Assignment (Release 47 Step 16)

## Bounded context

Step 16 owns the **Platform commercial subscription configuration** plane:

- tenant commercial association to a Published Plan Version
- zero or more Published Add-on Versions
- zero or more Approved Overrides
- commercial lifecycle, effective dates, readiness
- static commercial preview
- immutable commercial snapshots and fingerprints

Step 16 does **not** own tenant runtime entitlement resolution, billing, or provisioning.

`LicensingEngineService` remains authoritative for tenant runtime decisions and is **not** called by Step 16 mutations or previews.

## Source-of-Record decision

Additive `PlatformSubscriptionCommercialConfig` SoR. Optional `platformSubscriptionId` correlation only. Never creates/updates runtime `PlatformSubscription` or `PlatformTenant.plan`.

## Frozen correlation / Option A / renew

See prior accepted contracts: fail-closed correlation, Option A second-create (`current_configuration_already_exists`), specialized renew with `renewalEffectiveAt`.

## Permissions

`subscription.view` | `subscription.assign` | `subscription.migrate` (schedule/activate/supersede/renew + step-up) | `subscription.suspend` | `subscription.cancel`

## Durable idempotency (13)

create, update, assignPlanVersion, replaceAddOns, replaceOverrides, updateDates, schedule, activate, suspend, resume, cancel, supersede, renew

## Readiness (absolute final)

Action-scoped via `GET .../readiness?action=`.

| Code | edit / assign_* / update_dates / supersede / renew | schedule | activate | preview |
|------|-----------------------------------------------------|----------|----------|---------|
| `tenant_lifecycle_ineligible` | **BLOCKER** | **BLOCKER** | **BLOCKER** | WARNING |
| `lifecycle_not_editable` | **BLOCKER** | omitted | omitted | warning |
| `lifecycle_not_schedulable` | omitted | **BLOCKER** | omitted | warning |
| `lifecycle_not_activatable` | omitted | omitted | **BLOCKER** | warning |
| `override_future_effective` | warning | BLOCKER unless schedule ≥ effectiveFrom | BLOCKER if future | warning |

Suspended-tenant mutations call `assertTenantEligibleForCommercialMutation` **before** opening a write transaction.

## Assignment contracts (frozen)

### Add-on dependencies

**Capability-based** via Catalog `FEATURE.owningModule` presence in base∪assigned entitlements. Stable code: `addon_dependency_missing`.

**Add-on-to-Add-on dependency schema:** Not Applicable — no dependency table on Add-on definitions.

### Compatibility / exclusivity

**Option B — one canonical contract:** mutual exclusivity is the commercial interpretation of ACTIVE Catalog `INCOMPATIBLE_WITH` rules. Codes: `addon_mutually_exclusive` / `addon_compatibility_conflict`. No second exclusivity SoR.

### Override scope

**Not Applicable** beyond the assignment relation: Override definitions have no tenant/subscription scope discriminator; assignment FK is the only subscription binding.

### Activate vs resume audit (Option B)

Shared action `platform_subscription_commercial.active_commercial` with bounded `transitionCommand` = `ACTIVATE` | `RESUME`.

## Fingerprint / snapshot

Schema `subscription-commercial-fingerprint/v1`. Renew-specific TX failure tokens exist separately from supersede tokens.

## Representative upgrade

Validator prints explicit `before` / `after` / `equal: true` digest pairs for Step 15 immutable inventory. Step 16 migration creates 0 configurations/assignments/snapshots. Catalog 68/136/68/13.

## Migration / commands

- Clean: `npm run test:platform-subscriptions-clean-migration`
- Upgrade: `npm run test:platform-subscriptions-upgrade-migration`
- DB: `npm run test:platform-subscriptions-db`

## Explicit non-goals

Step 17 Effective Entitlement Runtime, billing, usage, provisioning, Feature Flags, Patient Portal.

## Final Step 16 decision (final blocker elimination gate)

**Step 16 final blocker elimination gate passed. Recommend final Step 16 acceptance.**

Step 17 was not implemented.

### Evidence totals (post-final-production-edit)

| Matrix | Cells | Status |
|--------|-------|--------|
| Add-on Limit (LIM*) | 31 independent unit cells via Step 15 `composeCommercialPreview` | Passed |
| Override governance (GOV*) | Maker-checker, missing approver/timestamp/fingerprint, lifecycle reuse | Passed |
| Override precedence (PREC*) | Grant/suppress, Limit compose, contradiction, order independence | Passed |
| Override/Add-on replace reliability + rollback | OV-REL*, OV-RB01–08, AO-RB* | Passed |
| Fingerprint FP01–FP52 | 52 independently named cells | Passed |
| Snapshot SN01–SN40 | 40 independently named cells | Passed |
| Concurrency RC01–RC40 | 40 independently named races + assertion template | Passed |
| Schedule SC-RB01–08 | 8 points | Passed |
| Suspend SU-RB01–08 | 8 points | Passed |
| Resume RE-RB01–08 | 8 points | Passed |
| Renew RN-RB01–21 | 21 renew-specific points | Passed |
| Persisted redaction RD01–RD13 | Dirty-inject + production adapter + PostgreSQL readback | Passed |
| Exact audit cardinality | 13 mutations; Option B `transitionCommand` ACTIVATE/RESUME | Passed |

### Post-change regression (after final production edits)

- Clean migration: exit 0; Catalog 68/136/68/13; Step 16 empty seed
- Upgrade migration: exit 0; explicit before/after/`equal: true` digest pairs
- Steps 08–15: green (Step 15: 5 suites / 65 tests after future-effective assertion fix)
- Step 16: **19 suites / 442 tests**, exit 0
- Platform auth / MFA / sessions / Step 16 route isolation / licensing-clinic: green
- Prisma validate + generate: pass
- API `tsc -p tsconfig.build.json --noEmit`: accepted baseline only (`permission-seeds.ts` / TS6059)
- Super Admin: **27 files / 222 tests**; typecheck + build pass
- Frontend lint: Not Available / Not Applicable — no verified frontend lint script

### Production behavior changes in this gate

- Override assignment governance: reject self-approval, missing approver/timestamp/fingerprint
- Add-on/Override replace TX order: delete → insert → rowVersion (FOR UPDATE OCC) with expanded failure points
- Schedule/suspend/resume/renew audit-staging failure points fire even without idempotency key
- Test runner preflight can publish one Draft Plan Version fixture when product seed left only Drafts

### Explicit non-goals retained

No Step 17 runtime entitlement resolution, billing, usage, provisioning, or `LicensingEngineService` mutation.
