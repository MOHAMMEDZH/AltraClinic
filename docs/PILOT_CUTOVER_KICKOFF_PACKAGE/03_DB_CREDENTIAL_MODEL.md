# C0 — DB credential model (migrate-admin vs runtime-app)

**Purpose:** Separate privileged migrate work from RLS-enforced API runtime.  
**Rule:** **No passwords in git**, tickets, or committed evidence.

---

## Roles (logical model)

| Role class | Intended use | RLS posture | Exists in-repo today |
|------------|--------------|-------------|----------------------|
| **migrate-admin** (privileged) | `prisma migrate deploy`, schema/RLS apply jobs, fixture/admin maintenance | Elevated GRANTs for migrate window only; not API default; prefer **NOBYPASSRLS** (not SUPERUSER) | **C1 template** — [`PILOT_CUTOVER_C1_DB_ROLES/`](../PILOT_CUTOVER_C1_DB_ROLES/) (not claimed applied in prod) |
| **runtime-app** (API) | Nest/Prisma application `DATABASE_URL` | **MUST** be `NOSUPERUSER` + **NOBYPASSRLS** (`rolbypassrls = false`) | Test analog: `booking_app`; **C1 template** for prod naming |
| Platform maintenance bypass | Controlled platform ops / tests via session var patterns — not clinic default | Documented in K6 / SECURITY_RUNBOOKS §3 | In-product session patterns; not a substitute for NOBYPASSRLS runtime role |

---

## Hard rules

```text
API runtime DATABASE_URL → runtime-app (NOBYPASSRLS) only
Migrate job credentials → migrate-admin (separate secret); not reused as API runtime
booking_app = test/local pattern — not automatic prod provision
Do not disable RLS as “mitigation”
Do not commit role passwords or connection strings with secrets
```

---

## Proof expectations (later slices)

| Check | When |
|-------|------|
| `rolbypassrls = false` for runtime-app | C1 template + C2 staging verify |
| Migrate job can deploy; runtime cannot BYPASSRLS | C2 |
| K6-style isolation against staging/pilot target | C2 |

**C0 claim:** model documented. **C1** delivers SQL template + runbook — roles **still not** claimed provisioned in production until ops applies out-of-band + C2 verifies.
