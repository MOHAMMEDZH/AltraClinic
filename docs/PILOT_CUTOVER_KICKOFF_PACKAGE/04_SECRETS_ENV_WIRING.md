# C0 — Secrets / env wiring map

**SSOT inventory:** [`PHASE_49_K2_SECRETS_CONFIG/`](../PHASE_49_K2_SECRETS_CONFIG/) · template [`apps/api/.env.example`](../../apps/api/.env.example)  
**Rule:** Map **key names** only. Never paste real values. Never commit `.env`.

---

## Consumer classes

| Consumer | Purpose | Typical keys (names only) |
|----------|---------|---------------------------|
| **Migrate job** | `db:migrate:deploy` + RLS apply | Privileged DB URL (migrate-admin); **not** the API runtime URL |
| **API runtime** | Nest process | `DATABASE_URL` (runtime-app / NOBYPASSRLS), `JWT_*`, `JWT_PLATFORM_*`, `PLATFORM_MFA_ENCRYPTION_KEY`, Redis URLs as required |
| **Backup / restore** | K3 / Step 29 §9 | Backup tool credentials + artifact path refs (`BACKUP_*` flags/paths in example — encryption key **ref**, not value in git) |

---

## Critical API key names (from K2 / `.env.example`)

```text
# Runtime DB (runtime-app — NOBYPASSRLS)
DATABASE_URL

# Auth / platform (runtime)
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_PLATFORM_ACCESS_SECRET
JWT_PLATFORM_REFRESH_SECRET
PLATFORM_MFA_ENCRYPTION_KEY

# Test / integration only (not pilot prod)
INTEGRATION_DATABASE_URL
ALLOW_TEST_DATABASE_RESET
RUN_PLATFORM_DB_SECURITY

# Backup center flags / refs (no secrets in repo)
BACKUP_RESTORE_* / BACKUP_* 
BACKUP_RESTORE_ENCRYPTION_KEY_REF   # reference only
```

---

## Wiring expectations (pilot)

| Concern | Expectation |
|---------|-------------|
| Secret storage | Deployment-owned secret manager / sealed env — **EXTERNAL** (C0 does not install) |
| Migrate vs runtime | Two distinct DB credentials; rotate independently |
| Evidence | Names + exit codes OK; redacted logs; **no** connection strings with passwords in `apps/api/.ci-evidence/` commits |
| Frontend | `VITE_*` / SA examples only — no API secrets in browser apps |

```text
K2 packaging ≠ secrets provisioned in pilot
.env.example ≠ production values
```
