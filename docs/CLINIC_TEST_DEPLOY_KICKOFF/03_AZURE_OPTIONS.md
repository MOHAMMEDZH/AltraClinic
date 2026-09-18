# D0 — Azure options (API host)

Prefer lowest friction for a **single Nest API** facing Pages. Decision locks in **D1**, not D0.

| Option | Fit | Notes |
|--------|-----|--------|
| **Azure Container Apps** (free grant / consumption) | **Preferred** if grant or free tier available | Containerized Nest; scale-to-zero OK for clinic-test |
| **App Service B1** | **Acceptable** | Simple Linux Web App / container; predictable always-on |
| **App Service F1** | **Trial only** | Free tier for short proof; not durable clinic-test host |

**Selection criteria (D1)**

1. Public HTTPS URL for Nest.
2. Env/secrets for Neon runtime URL + JWT (portal/Key Vault or App Settings — values never in git).
3. Outbound TCP to Neon (SSL).
4. CORS configurable for Pages origin.

**Out for host choice**

- AKS / full k8s SoR
- Multi-region App Service plans
- Azure Postgres as the database (Neon remains SoR)

```text
Prefer Container Apps free grant OR App Service B1
F1 = trial only
Host decision = D1 (not D0)
```
