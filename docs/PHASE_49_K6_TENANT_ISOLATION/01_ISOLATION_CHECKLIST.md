# K6 — Isolation checklist (clinic RLS vs platform admin)

**Incident procedure:** `docs/SECURITY_RUNBOOKS.md` **§3 — Cross-tenant incident**  
**Inventory lineage:** `docs/PHASE_49_K1_DISCOVERY_INVENTORY/05_TENANT_ISOLATION_INVENTORY.md`  
**Phase 49 claim:** packaging only — reuse existing proofs; no new RLS engine

---

## 1. Clinic tenant RLS (data plane)

| Check | What “good” means | Existing proof |
|-------|-------------------|----------------|
| App role has **no** RLS bypass | `booking_app.rolbypassrls = false` | Tenant / Wave RLS suites; `tenant-isolation.postgres.integration.spec.ts` |
| Same-tenant reads/writes visible | Tenant A sees only Tenant A rows | Same + Wave pack RLS specs |
| Cross-tenant reads denied | Tenant A cannot see Tenant B patients/invoices/catalog rows | `tenant-isolation.postgres.integration.spec.ts`; `clinical-catalog.cross-tenant.api.postgres.integration.spec.ts` |
| RLS policies applied | `db:rls:apply` / `scripts/apply-rls.mjs` in deploy path (K5) | Step 29 migrate path; not reinvented here |
| Do **not** disable RLS as mitigation | Containment rule | `SECURITY_RUNBOOKS.md` §3 |

---

## 2. Platform admin boundary (control plane)

| Check | What “good” means | Existing proof |
|-------|-------------------|----------------|
| Platform principal ≠ clinic principal | Platform routes require platform auth/RBAC | `platform-auth.boundary.spec.ts`; `platform-rbac-security-integration.spec.ts` |
| Platform list/detail tenant scope intentional | Cross-tenant platform access is governed + audited — not accidental IDOR | Platform DB security suites; sentinel isolation specs |
| Platform bypass only for maintenance paths | `app.platform_rls_bypass` used deliberately in tests/ops — not clinic default | Platform DB harness; SECURITY_RUNBOOKS §3 |
| Permission matrices intact | `api.*` / platform resources consistent | `permission-matrix.json` (+ Step 28 matrix evidence) |

---

## 3. Production-check minimum (K6)

At an accepting Phase 49 SHA, operators run the **named** check (or equivalent commands in `02_COMMANDS.md`):

1. **Primary:** `npm run test:platform-db-security`
2. **Clinic RLS proof:** `tenant-isolation.postgres.integration.spec.ts`
3. **Thin cross-tenant API proof (reuse Wave pack pattern):** `clinical-catalog.cross-tenant.api.postgres` (same pattern as `test:phase48-p0-catalog` pg step)

Platform boundary unit specs remain available via Step 28 closure-focused / onepass — **pointer OK**; full Wave I onepass is **optional/heavy** (not required for K6).

---

## 4. Incident pointer

On suspected leakage: follow **SECURITY_RUNBOOKS §3** (contain → evidence → compensating writes → escalate Release Manager / RELEASE BLOCKED). K6 does not replace that runbook.
