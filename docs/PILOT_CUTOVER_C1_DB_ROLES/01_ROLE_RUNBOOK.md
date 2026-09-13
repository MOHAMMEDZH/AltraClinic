# C1 — Role runbook (migrate-admin vs runtime-app)

**Audience:** Database/Backup Operator + Platform Security  
**SSOT model:** [`../PILOT_CUTOVER_KICKOFF_PACKAGE/03_DB_CREDENTIAL_MODEL.md`](../PILOT_CUTOVER_KICKOFF_PACKAGE/03_DB_CREDENTIAL_MODEL.md)  
**Migrate commands (pointer only):** [`../PRODUCTION_MIGRATION_WORKFLOW.md`](../PRODUCTION_MIGRATION_WORKFLOW.md)

---

## 1. Preconditions

- [ ] Pilot/staging Postgres host already exists (**EXTERNAL** — not created by C1)
- [ ] Operator has break-glass superuser / cloud master access outside git
- [ ] Placeholders substituted **out of band** (secret manager / sealed local file) — never commit filled SQL
- [ ] Copy template → working file **outside** the repo (or gitignored path)

Suggested placeholder names (match template):

```text
{{DB_NAME}}
{{MIGRATE_ROLE}}          e.g. altraclinic_migrate
{{RUNTIME_ROLE}}          e.g. altraclinic_app
{{PASSWORD_MIGRATE}}
{{PASSWORD_RUNTIME}}
{{APP_SCHEMA}}            usually public
```

---

## 2. Create roles (first time)

1. Obtain master/superuser session to the target instance (vault / cloud console — **EXTERNAL**).
2. Substitute placeholders into `02_CREATE_PROD_DB_ROLES.sql.template` in a **non-committed** working copy.
3. Run the script once as superuser / owner capable of `CREATE ROLE`.
4. Store passwords only in the secret manager (see `04_SECRETS_MAPPING.md`).
5. Run `03_VERIFY_QUERIES.sql` (substitute role names) and retain **redacted** evidence (role names + `rolbypassrls` only).

```text
API DATABASE_URL → {{RUNTIME_ROLE}} only (NOBYPASSRLS)
Migrate / RLS / triggers job → {{MIGRATE_ROLE}} only
Never point Nest runtime at migrate-admin
```

---

## 3. Rotate passwords

1. Generate new passwords in secret manager (do not paste into tickets/git).
2. As privileged operator:

```sql
-- placeholders only in docs; run filled version out-of-band
ALTER ROLE {{MIGRATE_ROLE}} WITH PASSWORD '{{PASSWORD_MIGRATE_NEW}}';
ALTER ROLE {{RUNTIME_ROLE}} WITH PASSWORD '{{PASSWORD_RUNTIME_NEW}}';
```

3. Update migrate-job secret and API runtime `DATABASE_URL` secret independently.
4. Rolling restart API after runtime secret update; confirm health.
5. Re-run verify queries (bypass flags unchanged).

---

## 4. Break-glass

| Situation | Action |
|-----------|--------|
| Migrate blocked / schema emergency | Use cloud master or `{{MIGRATE_ROLE}}` for **migrate window only**; log ticket; do **not** switch API to migrate credentials |
| Suspected credential leak | Rotate both roles; revoke sessions if supported (`pg_terminate_backend` for role PIDs); review audit |
| Temptation to “fix” RLS via BYPASSRLS on runtime | **FORBIDDEN** — see K6 / `SECURITY_RUNBOOKS.md` §3 |

Break-glass master credentials remain **EXTERNAL** to this repo. C1 does not install a vault.

---

## 5. After roles exist (later slices — not C1)

| Next | Slice |
|------|-------|
| Staging `db:migrate:deploy` + `db:rls:apply` + isolation check | **C2** |
| Backup/restore on clone | **C3** |

**C1 does not claim** migrate or cutover succeeded.
