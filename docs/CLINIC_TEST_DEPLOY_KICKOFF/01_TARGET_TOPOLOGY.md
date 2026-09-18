# D0 — Target topology

Clinic-test stack is three tiers. Roles are fixed for this program.

```text
Browser
  → Cloudflare Pages  (clinic-dashboard UI only)
  → Azure API         (Nest apps/api only)
  → Neon pilot DB     (existing; runtime role pilot_neon_app)
```

| Tier | Host | App / role | Notes |
|------|------|------------|--------|
| **UI** | Cloudflare Pages | `clinic-dashboard` | Static/SSR front end; points at Azure API origin |
| **API** | Azure (see [03_AZURE_OPTIONS.md](./03_AZURE_OPTIONS.md)) | Nest `apps/api` | Public HTTPS; CORS allow Pages origin |
| **DB** | Neon (existing pilot) | `pilot_neon_app` runtime | NOBYPASSRLS; migrate/owner ops stay off runtime |
| **Super-admin UI** | Optional later | — | Not required for D0–D3 clinic-test smoke |

**Constraints**

- Pages must not embed DB credentials.
- Azure API holds runtime `DATABASE_URL` (pilot app role), JWT secrets, and CORS allowlist for the Pages origin.
- No Azure Database for PostgreSQL in this program (see [05_EXPLICIT_OUT.md](./05_EXPLICIT_OUT.md)).
- Super-admin dashboard deploy is **deferred** unless CTO authorizes a later slice.

```text
Pages = UI only
Azure = API only
Neon pilot = SoR for clinic-test data
product production cutover = NOT CLAIMED
```
