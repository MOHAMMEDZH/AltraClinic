# S4 — Human: rotate Neon owner password

1. Open Neon project `altraclinic-pilot` (`little-moon-83905788`).
2. Branch **production** (Neon name only — this is still **pilot**).
3. Reset password for role `neondb_owner`.
4. **Connect** → Connection pooling **OFF** (host must not contain `-pooler`).
5. Copy connection string into **gitignored** file only:

```text
apps/api/.env.pilot.local
```

```env
PILOT_OWNER_DATABASE_URL=postgresql://neondb_owner:...@ep-....eu-central-1.aws.neon.tech/neondb?sslmode=require
```

6. Tell the agent: `S4 done. URL in apps/api/.env.pilot.local. Continue S1/C3b.`  
   **Do not paste the URL into chat.**

Root `.gitignore` already ignores `.env.*` (except `.env.example`).
