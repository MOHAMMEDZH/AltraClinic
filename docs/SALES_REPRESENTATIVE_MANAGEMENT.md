# Sales Representative Management (Flexible Step 23)

**Status:** Accepted / Complete
**Playbook:** Super Admin Flexible Plans/Entitlements v4 — Step 23
**Authority:** Platform identity / auth / MFA / session / RBAC (Steps 06–08), Tenant Directory (customer SoR), Steps 17–22 preserved.

Steps **01–22** + **U01**: Accepted/Complete.
Step **23**: **Accepted and complete** (authoritative Case C attempt **5**, 2026-08-10).
Steps **24–29**: Not Authorized (no Leads, Opportunities, Pipeline, Trials, commissions, payroll, billing, PHI).

### Final Case C (authoritative)

| Field | Value |
|-------|--------|
| Attempt | **5** (attempts 1–4 invalidated; not combined) |
| Frozen DB | `booking_test` @ `localhost:5433` |
| Freeze | `2026-08-10T21:57:30.064Z` |
| Window | `2026-08-10T21:57:29.688Z` → `2026-08-10T22:42:48.764Z` (~45.3 min) |
| Runner | `npm run test:sales-representatives-final-onepass` |
| Counters | `failures=0 retries=0 dbRestarts=0 commandReruns=0 productEdits=0 databaseSwitches=0 exitCode=0` |
| Catalog | `68 / 136 / 68 / 13` |
| Hygiene | remaining prohibited Step 23 artifacts = **0** |

**Harness notes (accepted as load-only):** Step 17 failure-injection `jest.setTimeout` 300s→900s (assertions/semantics unchanged); U01 optional clock + `useFactory` for Nest DI; Step 22 validators intentionally allow Step 23 sales tables while forbidding Step 24+/billing.

---

## 1. Purpose

Allow authorized Platform managers (`sales_manager` / holders of `sales-representative.manage`) to create and administer **Sales Representatives** as least-privilege Platform principals, with commercial customer ownership metadata, without granting Catalog/Plan/Entitlement/Override/Subscription/provisioning authority.

---

## 2. Sources of Record (frozen)

| Concern | SoR | Notes |
|---------|-----|-------|
| Identity / credentials / MFA / login eligibility | `PlatformUser` | Never duplicate password/session/MFA stores |
| Roles | `PlatformUserRole` + code catalog | Role keys are not authorization by themselves |
| Sessions | `PlatformRefreshToken` + `PlatformSessionRevocationService` | Suspend/revoke-all must invalidate sessions |
| Sales profile / manager / region / territory / target / OCC | `PlatformSalesRepresentative` | 1:1 with `platformUserId` |
| Customer commercial ownership | `PlatformSalesCustomerOwnership` (+ history rows) | Customer = `PlatformTenant` / directory identity |
| Durable idempotency | `PlatformSalesIdempotencyRecord` | Claim-before-effect; not process-local alone |
| Durable audit | Step 21 `AuditEntry` Model A (same TX where applicable) | No secrets/PHI |

---

## 3. Identity model

- Sales Representative is a **Platform-side** principal only.
- Creation uses existing Platform invite/create path constrained to default role `sales_representative`.
- Profile extension links `platformUserId` (unique); does not store credentials.
- No Clinic/`User`/tenant membership is created.
- No silent conversion of existing Platform users into representatives without an explicit create/link mutation.

---

## 4. Status semantics

Representative `status` mirrors Platform lifecycle for administration UX:

| Status | Meaning |
|--------|---------|
| `pending_activation` | Invited / not yet active Platform session eligibility |
| `active` | Platform user active; may authenticate per MFA policy |
| `suspended` | Platform user suspended **and** sessions revoked |
| `disabled` | Terminal admin disable (if used) |

**Suspension invariant (required):**

```text
Representative suspended
AND PlatformUser.status = suspended / isActive = false
AND active Platform sessions revoked/invalidated
```

Reactivation (if permitted) does **not** restore old sessions; a new login/session is required.

---

## 5. Region / territory / target

| Field | Type | Authorization effect |
|-------|------|----------------------|
| `regionCode` | bounded normalized string (≤64) | Metadata only |
| `territoryCode` | bounded normalized string (≤64) | Metadata only |
| `targetAmount` | optional decimal | Metadata only |
| `targetCurrency` | optional ISO-like code (≤8) | Metadata only |
| `targetPeriod` | enum: `MONTH` \| `QUARTER` \| `YEAR` | Metadata only |

No commission, payroll, billing, revenue recognition, or entitlement/plan side effects.

---

## 6. Manager semantics

- `managerRepresentativeId` → another `PlatformSalesRepresentative` (Platform-side only).
- Denied: self-manager, cycles, Clinic principals, ineligible (non-rep / suspended without privilege).
- Changes require OCC (`rowVersion`) + durable audit.
- Manager privileges **do not** imply arbitrary Platform role grants.

---

## 7. Role grantability (frozen)

| Actor capability | May grant |
|------------------|-----------|
| `sales-representative.manage` (sales admin path) | **Only** `sales_representative` |
| `platform-user.role.assign` (existing Platform RBAC path) | Existing catalog rules + SoD + high-impact step-up |

**Default-denied / protected for representative assignment path:**

- `platform_owner`
- `security_administrator`
- `platform_administrator`
- `operations_engineer` (dangerous ops)
- Any role that includes Plan publish, entitlement/Limit mutation, Override grant/revoke, Subscription mutation, Feature Flag kill-switch, or unrestricted RBAC admin

**Default representative role permissions** (catalog): view-oriented commercial surfaces + `plan.view` / `tenant.view` / `tenant.provision.view` — **no** Catalog/Plan/Entitlement/Override/Subscription **mutation**, no Feature Flag/Global Setting mutation, no Operations dangerous execute, no Platform user/RBAC admin.

Segregation matrix **S01–S16** for DEFAULT representative: all **DENIED**.

---

## 8. Customer ownership (commercial only)

- Customer SoR: existing Platform tenant directory (`PlatformTenant` / bound `Tenant`).
- Ownership = commercial relationship owner metadata only.
- **Does not** grant Clinic auth, tenant membership, PHI, entitlement mutation, Subscription mutation, provisioning, or lifecycle authority.
- Assign / reassign / remove: permission `sales-representative.manage`, OCC/idempotency, history retained, durable audit.
- Missing customer → safe not-found (no existence oracle beyond directory norms).
- **No** Lead / Opportunity / Pipeline / Trial entities (Step 24–25).

---

## 9. Activation / suspension / session revocation

- Activate/reactivate: reuse Platform activate path + role revalidation; do not mint sessions.
- Suspend: require reason; step-up when Platform security policy requires for suspension class; Platform suspend + revoke-all sessions in coordinated flow; durable audit.
- Independent revoke-all: reuse `PlatformSessionRevocationService` with reason + step-up as policy requires.

---

## 10. Audit events (A01–A16)

Material mutations emit durable Step 21 evidence (exact cardinality on success; replay does not double-count; failures do not write false success):

A01 created · A02 profile updated · A03 region · A04 territory · A05 manager assigned · A06 manager reassigned · A07 target · A08 role assigned · A09 role removed · A10 activated · A11 suspended · A12 reactivated · A13 sessions revoked · A14 ownership assigned · A15 ownership reassigned · A16 ownership removed.

---

## 11. Idempotency / OCC

- Durable idempotency keys for create, activate, suspend, revoke sessions, role assign/remove, manager assign, ownership assign/reassign/remove.
- Fingerprint conflict → deterministic conflict.
- `rowVersion` OCC on representative and ownership rows.

---

## 12. API surface (conceptual)

Prefix under Platform Super Admin conventions (exact paths follow repository patterns):

- `GET/POST /platform/sales/representatives`
- `GET/PATCH /platform/sales/representatives/:id`
- `POST .../activate|suspend|reactivate`
- `POST .../sessions/revoke-all`
- `POST/DELETE .../roles`
- `PUT .../manager`
- `PUT .../target`
- `GET/PUT/DELETE .../customer-ownership`

All: real Platform Passport auth, explicit permissions, no role-name bypass, bounded inputs, safe errors.

---

## 13. UI

Super Admin `/sales` replaces placeholder with representative list/detail/create/actions.  
**No** Leads/Opportunities/Pipeline/Trial navigation (Step 24–25).

---

## 14. Migration / rollback

- Additive tables only: representatives, ownership (+ history), sales idempotency.
- Clean validator: no auto-created reps; Catalog `68/136/68/13`; no Step 24/25 schema.
- Rollback: disable UI/routes; preserve accounts/audits/history; never auto-reactivate or restore revoked sessions.

---

## 15. Step 24 boundary

Explicitly out of scope: Leads, Opportunities, Pipeline stages, demos, win/loss, plan-fit, Trial creation/conversion, commissions/payroll.
