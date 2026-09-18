# D1 — Secrets map (keys only)

Values live in **Azure Container Apps secrets / App Service Application settings** only.  
Never commit values. Never paste into chat or PR evidence.

| Azure env / secret key | Purpose | Notes |
|------------------------|---------|--------|
| `DATABASE_URL` | Nest Prisma / pg | Neon **`pilot_neon_app`** runtime URL + SSL. **Not** owner. |
| `JWT_ACCESS_SECRET` | Access tokens | ≥32 chars; not placeholder; ≠ refresh |
| `JWT_REFRESH_SECRET` | Refresh tokens | ≥32 chars; not placeholder; ≠ access |
| `PLATFORM_MFA_ENCRYPTION_KEY` | Platform TOTP envelope | Required when `NODE_ENV` ≠ `test`; ≥32; ≠ JWT secrets |
| `JWT_PLATFORM_ACCESS_SECRET` | Platform access (optional) | Recommended if platform principals used |
| `JWT_PLATFORM_REFRESH_SECRET` | Platform refresh (optional) | Must differ from access |
| `CORS_ORIGINS` | Browser CORS allowlist | Exact origins; placeholder OK until D2 Pages URL |
| `SUPER_ADMIN_CORS_ORIGINS` | Super-admin CORS | Optional later |
| `NODE_ENV` | Runtime mode | Use `production` for clinic-test host |
| `PORT` | Listen port | `8080` (matches Dockerfile / ingress) |
| `REDIS_OPTIONAL` | Redis soft-fail | `true` for clinic-test without Redis |
| `REDIS_URL` | Redis | Optional if `REDIS_OPTIONAL=true` |
| `APP_ENV` | Label | e.g. `demo` / `uat` — not a substitute for secrets |

**Owner / migrate Neon URL:** local gitignored only (`PILOT_*` / operator machine). **Never** set as Azure `DATABASE_URL`.

**Generate (human machine, do not paste output into chat):**

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

```text
no secrets in git = YES
runtime role = pilot_neon_app only
```
