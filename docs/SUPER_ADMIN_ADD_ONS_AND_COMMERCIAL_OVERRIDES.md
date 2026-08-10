# Super Admin — Add-ons and Commercial Overrides (Release 47 Step 15)

## Bounded context

Step 15 is the **Platform commercial-definition plane** for reusable Add-ons and governed Commercial Overrides.

It is **not**:

- tenant subscription assignment (Step 16)
- Effective Entitlement Runtime (Step 18)
- a call path into `LicensingEngineService`
- a seed of invented `addon.*` Catalog products

Creating, publishing, approving, or revoking definitions **must not** change tenant runtime access.

## Discovery matrix (no seed)

Full matrix: [`docs/SUPER_ADMIN_ADD_ONS_OVERRIDES_LEGACY_MAPPING.md`](./SUPER_ADMIN_ADD_ONS_OVERRIDES_LEGACY_MAPPING.md).

| Discovery target | Finding | Seed decision |
|------------------|---------|---------------|
| Existing `addon.*` Catalog items | None in Healthcare Catalog inventory (68/136/68/13) | **Do not invent** Add-on products |
| Runtime grant JSON / feature packs | Historical clinic JSON is not commercial SoR | Map later via audit + assignment (Step 16+), not seed |
| Plan Version entitlements/limits | Step 14 commercial definition | Reuse as Base layer in composition preview |
| Tenant assignment FK needs | Subscription binding | Deferred to Step 16 — **no `tenantId` / `subscriptionId` on Add-on or Override rows** |
| Maker-checker | `override.request` vs `override.approve` + SoD | Wire `PlatformSodService.assertOverrideApproveSod` |
| Step-up | Publish / approve / revoke / high-impact lifecycle | `PlatformAssuranceService.requireStepUp` (same as Plans) |

Empty Add-on catalog is a **valid** production state.

## Schema (additive)

Migration: `apps/api/prisma/migrations/20260726010000_phase47_step15_addons_overrides/`

### Enums

| Enum | Values |
|------|--------|
| `PlatformAddOnLifecycle` | DRAFT, ACTIVE, ARCHIVED |
| `PlatformAddOnVersionLifecycle` | DRAFT, PUBLISHED, RETIRED |
| `PlatformAddOnLimitEffectType` | SET_ABSOLUTE, INCREASE_BY, SET_UNLIMITED |
| `PlatformCommercialOverrideLifecycle` | DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, REVOKED, EXPIRED |
| `PlatformCommercialOverrideEffectKind` | ENTITLEMENT_GRANT, ENTITLEMENT_SUPPRESS, LIMIT_SET_ABSOLUTE, LIMIT_INCREASE_BY, LIMIT_SET_UNLIMITED |
| `PlatformCommercialOverrideReasonCode` | SALES_CONCESSION, CONTRACTUAL_EXCEPTION, SUPPORT_WAIVER, TRIAL_EXTENSION, OTHER |

### Models

| Model | Role |
|-------|------|
| `PlatformAddOn` | Canonical Add-on identity (`addon.*`, unique) |
| `PlatformAddOnTranslation` | en-US / ar-SY display |
| `PlatformAddOnVersion` | Versioned commercial snapshot; publish fingerprint; clone source Restrict |
| `PlatformAddOnVersionTranslation` | Version labels |
| `PlatformAddOnVersionEntitlement` | MODULE/FEATURE grants (enforced in service) |
| `PlatformAddOnVersionLimitEffect` | LIMIT effects (enforced in service) |
| `PlatformAddOnVersionApplicability` | Plan canonical keys as strings (validated in service; not FK) |
| `PlatformCommercialOverride` | Governed override **definition** — **no tenantId** |
| `PlatformCommercialOverrideEffect` | Unique `(overrideId, catalogItemId, effectKind)` |
| `PlatformCommercialIdempotencyRecord` | Option A completed-only idempotency |

All FKs use **Restrict**. Published history is never cascade-deleted.

## Semantics

### Add-ons

- Canonical keys: `addon.<snake_name>` (immutable).
- One open Draft version per Add-on (partial unique index).
- Entitlements: MODULE / FEATURE only.
- Limit effects: LIMIT kind only; `SET_UNLIMITED` / `SET_ABSOLUTE` / `INCREASE_BY`.
- Applicability: plan keys must exist as `PlatformPlan.canonicalKey`.
- Publish requires fresh step-up; stores `publicationFingerprint`; does **not** change runtime.
- Clone copies entitlements, limit effects, and applicability into a new Draft.

### Overrides

- Lifecycle: Draft → Pending Approval → Approved | Rejected; Approved → Revoked | Expired.
- Maker-checker: creator/submitter cannot approve or reject (`assertOverrideApproveSod`).
- Approve / reject / revoke require fresh step-up.
- `reasonNote` max 500 chars.
- Supersede creates a new Draft linked via `predecessorId`.
- No tenant binding in Step 15 (`tenantAssignment: unavailable_until_step_16`).

### Idempotency operations

`addon.create`, `addon.update`, `addon.activate`, `addon.archive`, `addon.createDraftVersion`, `addon.replaceEntitlements`, `addon.replaceLimitEffects`, `addon.replaceApplicability`, `addon.cloneVersion`, `addon.publishVersion`, `addon.retireVersion`, `override.create`, `override.updateDraft`, `override.submit`, `override.approve`, `override.reject`, `override.revoke`, `override.supersede`.

Not implemented as separate ops: `addon.reactivate` (ARCHIVED→ACTIVE via `addon.activate`, audits `platform_addon.reactivated`), `addon.updateDraftVersion` (no PATCH), `override.replaceEffects` (part of updateDraft), `override.expire` (no endpoint).

## Composition precedence

Static preview endpoint: `POST /platform/commercial-composition/preview`

Order:

1. **Base** — Plan Version entitlements + limits
2. **Add-ons** — additive capability grants only (no removal); limit effects applied
3. **Overrides** — grants / suppressions / limit mutations

Limit rules:

- `LIMIT_SET_ABSOLUTE` / `SET_ABSOLUTE` replaces
- `LIMIT_INCREASE_BY` / `INCREASE_BY` adds numeric values
- `LIMIT_SET_UNLIMITED` / `SET_UNLIMITED` wins (unless later absolute replace)

`ENTITLEMENT_SUPPRESS` removes from the **preview set** only.

Response always includes:

- `runtimeEffective: false`
- `licensingEngineCalled: false`
- commercial-only disclaimer

## Permissions

**Selected model: Option A — `addon.view` + `addon.manage`.**

There are **no** separate `addon.publish` / `addon.retire` permissions, and **no** permission isolation between edit vs publish vs retire. Anyone with `addon.manage` may create, edit, publish, retire, and clone. Separation of those high-impact steps is enforced by **fresh step-up**, **readiness gates**, **OCC (`rowVersion`)**, and **ConfirmationDialog** — not by finer-grained addon permissions.

| Permission | Use |
|------------|-----|
| `addon.view` | Read Add-ons / versions / readiness / compare |
| `addon.manage` | Create / edit / publish / retire / clone (single manage permission; Option A) |
| `override.view` | Read overrides / readiness / compare |
| `override.request` | Create / edit Draft / submit / supersede |
| `override.approve` | Approve / reject / revoke (SoD + step-up) |

Role-grant intent (explicit keys only; no wildcards; `super_admin` role-name text grants nothing):

| Role | Add-on / Override grants |
|------|--------------------------|
| `platform_owner` | Explicit catalog includes `addon.*` and `override.*` (not a `*` bypass) |
| `platform_administrator` | `addon.view`, `override.view` only (no `addon.manage` / `override.request` / `override.approve`) |
| `plans_subscription_manager` | `addon.view`, `addon.manage`, `override.view`, `override.request` (no `override.approve` — SoD) |
| Security / Sales / Auditor / Support roles | No Add-on mutation; auditor may have `override.view` for read |

Step-up alone never substitutes for a missing permission. Tenant and Clinic permission keys grant nothing on Step 15 routes.

## Readiness integration (Steps 13–14)

Plan entitlement readiness now reports:

```json
{ "status": "available", "reason": "step_15_commercial_definition" }
```

for `addonReadiness` / `overrideReadiness`. This means the commercial SoR exists; definitions may be empty. It does **not** imply runtime effectiveness.

## Step 16 boundary

Step 16 owns commercial subscription **configuration** (see [`SUPER_ADMIN_SUBSCRIPTION_MANAGEMENT_AND_COMMERCIAL_ASSIGNMENT.md`](./SUPER_ADMIN_SUBSCRIPTION_MANAGEMENT_AND_COMMERCIAL_ASSIGNMENT.md)):

- Tenant commercial configuration (Plan Version / Add-on / Override assignment)
- Commercial lifecycle, snapshots, and static subscription preview
- Optional correlation to existing `PlatformSubscription` identity without mutating runtime plan/status

Step 15 remains the commercial **definition** SoR. Runtime entitlement activation remains Step 17+. Activating a Step 16 commercial configuration does **not** change tenant runtime access.

## API surface

| Area | Prefix |
|------|--------|
| Add-ons | `/platform/add-ons` |
| Overrides | `/platform/commercial-overrides` |
| Composition | `POST /platform/commercial-composition/preview` |

Module: `apps/api/src/modules/platform-addons/`

## Tests

| Suite / script | Purpose |
|----------------|---------|
| `platform-addons.unit.spec.ts` | Lifecycle + composition precedence / conflicts / order independence |
| `platform-addons.auth.boundary.spec.ts` | Every handler: Clinic/patient/pre-auth/step-up-as-access reject; JwtStrategy issuer/audience/revoked; rate-bucket contract; Cache-Control |
| `platform-addons-overrides.postgres.integration.spec.ts` | Create → publish → SoD → revoke → composition → OCC → rate → step-up |
| `platform-addons-final-gate.postgres.integration.spec.ts` | Per-op idempotency matrix (all durable ops), 3 rate buckets, authz isolation, rollback samples, concurrent grants, composition conflicts |
| `platform-addons-lifecycle-races.postgres.integration.spec.ts` | Lifecycle concurrency matrix (identity, version, override races) |
| `platform-addons-rollback-families.postgres.integration.spec.ts` | Injected rollback for TX families A–L |
| `platform-addons-audit-matrix.postgres.integration.spec.ts` | Persisted audit for all event families + serialized redaction shapes |
| `platform-addons-licensing-clinic.compat.spec.ts` | Explicit LicensingEngine + Clinic JWT boundary (no Step 15 runtime lookup) |
| `npm run test:platform-add-ons-overrides-db` | All Step 15 `*.postgres.integration.spec.ts` |
| `npm run test:platform-add-ons-overrides-clean-migration` | Empty DB → full migrate → Catalog+Plans+empty Step 15 seed×2 |
| `npm run test:platform-add-ons-overrides-upgrade-migration` | Full pre/post inventory → park/apply Step 15 → preserve hashes |

## Mutation inventory and idempotency

Every externally callable Step 15 mutation uses completed-only PostgreSQL idempotency when an `Idempotency-Key` is supplied:

| Operation | Route | Idempotency name | Notes |
|-----------|-------|------------------|-------|
| create Add-on | `POST /platform/add-ons` | `addon.create` | |
| update identity | `PATCH /platform/add-ons/:id` | `addon.update` | |
| activate / reactivate | `POST .../activate` | `addon.activate` | Reactivate = ARCHIVED→ACTIVE |
| archive | `POST .../archive` | `addon.archive` | |
| create Draft Version | `POST .../versions` | `addon.createDraftVersion` | |
| replace grants | `PUT .../entitlements` | `addon.replaceEntitlements` | |
| replace Limit effects | `PUT .../limit-effects` | `addon.replaceLimitEffects` | |
| replace applicability | `PUT .../applicability` | `addon.replaceApplicability` | |
| clone | `POST .../clone` | `addon.cloneVersion` | |
| publish | `POST .../publish` | `addon.publishVersion` | |
| retire | `POST .../retire` | `addon.retireVersion` | |
| create Override | `POST /platform/commercial-overrides` | `override.create` | |
| update Draft (+ effects) | `PATCH .../:overrideId` | `override.updateDraft` | Effects replace is not a separate route |
| submit / approve / reject / revoke / supersede | lifecycle POSTs | matching `override.*` | |
| Draft Version metadata-only update | — | **not implemented** | No PATCH version-metadata route |
| Override expire mutation | — | **not implemented** | EXPIRED lifecycle exists; no explicit expire route |
| Composition preview | `POST .../preview` | N/A read | Static preview only |

## Final remaining evidence gate

### Durable idempotency

Final-gate matrix covers every implemented durable op: replay, different-payload 409, service recreation, concurrent equivalent (one completed row, one success audit). Failures (validation/OCC/permission/step-up/rate-limit/rollback) leave no completed row.

### Lifecycle races

PostgreSQL `Promise.all` races for identity update/activate/archive/reactivate, version grants/publish/retire, override approve/reject/edit/submit/revoke, equivalent and conflicting publish/approve.

### Rollback families A–L

Test-only `PLATFORM_ADDONS_TX_FAILURE_HOOK` (never in production module). Families cover entitlement/limit/applicability partial inserts, clone partials, publish/retire lifecycle, override draft/submit/approve/reject/revoke, supersede partial effects.

### Audit + redaction

Durable `AuditTrailPlatformAddonsAuditLog` + `redactAddonAuditDetails` allowlist. Every implemented event family persists; serialized details exclude translations, free-form notes, raw arrays, tokens, request bodies.

### Upgrade inventory

Representative upgrade (`npm run test:platform-add-ons-overrides-upgrade-migration`) proves byte-stable pre/post hashes for:

- Platform users, roles (code-governed), role assignments, sessions/refresh, suspended-user fixture
- Tenants, Platform tenants, LITE/PRO/ENTERPRISE subscription fixtures, missing-tenant fixture, audit sentinel identity/hash
- Catalog Items/Translations/Aliases/Rules **68 / 136 / 68 / 13**, Catalog idempotency, administrator-edited translation hash
- Plans, Plan translations/aliases, Draft/Published/Retired Plan Versions, ownership fixtures, entitlement/Limit/Unlimited counts+hashes, fingerprint hash, Plan idempotency
- Prior product outputs via normalized hashes (no snapshot tables required): `dashboardSummaryHash`, `tenantDirectoryHash`, `accessSummaryHash`, `licensingInputHash_LITE|PRO|ENTERPRISE`, `licensingSubscriptionFixturesHash`, `clinicHash`
- Step 15 created records: Add-ons **0**, Versions **0**, Overrides **0**; tenant/subscription assignments absent; Step 16 schema absent

### Licensing / Clinic

`platform-addons-licensing-clinic.compat.spec.ts`: no Step 15 lookup in `LicensingEngineService`; Clinic JWT rejected on all Step 15 handlers; publish/approve/reject/revoke/supersede do not call licensing.

### Super Admin full suite (final closure)

One complete `npm run test` (Vitest `fileParallelism: false`, `maxWorkers: 1` to isolate global `fetch` stubs): **25** files / **194** tests green. Then `npm run typecheck` and `npm run build` green. Frontend lint: **Not Available / Not Applicable** — no verified frontend lint script.

Route-level RTL/a11y: `addons-rtl-a11y.spec.tsx` covers every Step 15 route family (H1, permission gate, Arabic/RTL, no assignment actions). High-impact publish/approve use shared `ConfirmationDialog` (not `window.confirm`). Route permission/H1 matrix: `addons-route-matrix.spec.tsx`.

### Steps 10–11 regressions

- `npm run test:platform-dashboard-db` — 7 passed (summary counts unchanged; no Step 15 leakage)
- `npm run test:platform-tenant-directory-db` — 22 passed (directory/detail/access summary unchanged; no assignment surfaces)

### API TypeScript

- Focused Step 15: full `tsc -p tsconfig.build.json --noEmit` filtered for `platform-addons` → **no diagnostics**
- Full: same command exit **2** with only accepted baseline `TS6059` (`prisma/seeds/permission-seeds.ts` outside configured `rootDir`)
- `npx prisma validate` / `npx prisma generate` — pass

### Exact idempotency inventory

**Total implemented durable Step 15 idempotency operations: 18**

1. `addon.create`
2. `addon.update`
3. `addon.activate` (reactivation ARCHIVED→ACTIVE uses this op; no separate `addon.reactivate`)
4. `addon.archive`
5. `addon.createDraftVersion`
6. `addon.replaceEntitlements`
7. `addon.replaceLimitEffects`
8. `addon.replaceApplicability`
9. `addon.cloneVersion`
10. `addon.publishVersion`
11. `addon.retireVersion`
12. `override.create`
13. `override.updateDraft` (Draft effects replace is included here; no separate `override.replaceEffects`)
14. `override.submit`
15. `override.approve`
16. `override.reject`
17. `override.revoke`
18. `override.supersede`

Per-operation replay / different-payload 409 / service recreation / equivalent concurrency / completed-row / real-mutation audit: `platform-addons-final-gate.postgres.integration.spec.ts`.

### Persisted audit + serialized redaction

`platform-addons-audit-matrix.postgres.integration.spec.ts` persists exactly one clean row per implemented event family (identity created/updated/activated/archived/reactivated; version created/entitlements/limits/applicability/published/cloned/retired; override created/updated/submitted/approved/rejected/revoked/superseded). Replay does not duplicate. Serialized redaction covers every distinct metadata shape with injected prohibited fields stripped.

### Final decision

Step 15 final closure and consistency gate passed. Step 16 was not implemented.

## Catalog inventory preserved

Healthcare Catalog remains **68 / 136 / 68 / 13**. Step 15 adds **zero** Catalog seed items and **zero** invented `addon.*` products.
