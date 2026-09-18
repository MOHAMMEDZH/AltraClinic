# D1 — Azure API runbook (Container Apps preferred)

**Roles:** Human = Azure login, resource create, secret paste. Agent = image/runbook/health proof after public URL exists.

**Image:** `apps/api/Dockerfile` — build from **repository root**:

```bash
docker build -f apps/api/Dockerfile --ignorefile apps/api/.dockerignore -t clinic-test-api:<tag> .
```

Entrypoint: `npx ts-node --transpile-only src/main.ts` (workspace `@booking/*` packages are TypeScript). Listen port: `PORT` (default **8080** in image).

---

## 0. Human preconditions

1. Free or paid **Azure** subscription.
2. Azure CLI (`az`) logged in: `az login` → `az account show`.
3. Neon **runtime** URL for `pilot_neon_app` with `sslmode=require` (gitignored local only — never paste into chat/git).
4. Fresh JWT + MFA keys (see [02_SECRETS_MAP.md](./02_SECRETS_MAP.md)).

```text
F1 App Service = trial-only footnote — not the D1 target
Prefer Container Apps consumption; B1 App Service = acceptable alternate
```

---

## 1. Preferred: Azure Container Apps (consumption)

Suggested names (change freely):

| Resource | Example name |
|----------|----------------|
| Resource group | `rg-clinic-test` |
| Region | `westeurope` (or nearest to Neon Frankfurt) |
| ACR | `acrclinictest` (globally unique) |
| Environment | `cae-clinic-test` |
| Container app | `ca-clinic-test-api` |

### 1.1 Create foundation

```bash
az group create -n rg-clinic-test -l westeurope

az acr create -n acrclinictest -g rg-clinic-test --sku Basic --admin-enabled true

az containerapp env create \
  -n cae-clinic-test -g rg-clinic-test -l westeurope
```

### 1.2 Build & push image

```bash
az acr login -n acrclinictest
docker build -f apps/api/Dockerfile --ignorefile apps/api/.dockerignore \
  -t acrclinictest.azurecr.io/clinic-test-api:d1 .
docker push acrclinictest.azurecr.io/clinic-test-api:d1
```

### 1.3 Create Container App (secrets via Azure — not git)

Paste values only in Azure Portal or `az` interactive secret flags on a secure machine:

```bash
# Example shape — replace secret values out-of-band; do not commit real values
az containerapp create \
  -n ca-clinic-test-api -g rg-clinic-test \
  --environment cae-clinic-test \
  --image acrclinictest.azurecr.io/clinic-test-api:d1 \
  --registry-server acrclinictest.azurecr.io \
  --target-port 8080 \
  --ingress external \
  --cpu 0.5 --memory 1.0Gi \
  --min-replicas 0 --max-replicas 1 \
  --env-vars \
    NODE_ENV=production \
    PORT=8080 \
    REDIS_OPTIONAL=true \
    CORS_ORIGINS=https://PLACEHOLDER-PAGES-ORIGIN.pages.dev
```

Then set **secret** env refs in Portal (or `az containerapp secret set` + env from secret) for:

- `DATABASE_URL` — Neon **pilot_neon_app** only + SSL  
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`  
- `PLATFORM_MFA_ENCRYPTION_KEY`  
- Optional platform JWT pair if you set production platform principals

Record the public FQDN:

```bash
az containerapp show -n ca-clinic-test-api -g rg-clinic-test --query properties.configuration.ingress.fqdn -o tsv
```

Public API base URL = `https://<fqdn>` (no path).

### 1.4 Update image later

```bash
docker build -f apps/api/Dockerfile --ignorefile apps/api/.dockerignore \
  -t acrclinictest.azurecr.io/clinic-test-api:<newtag> .
docker push acrclinictest.azurecr.io/clinic-test-api:<newtag>
az containerapp update -n ca-clinic-test-api -g rg-clinic-test \
  --image acrclinictest.azurecr.io/clinic-test-api:<newtag>
```

---

## 2. Acceptable alternate: App Service B1

1. Create Linux Web App (container) on **B1**.
2. Point to the same ACR image; set App Settings from [02_SECRETS_MAP.md](./02_SECRETS_MAP.md).
3. Ensure WEBSITES_PORT / `PORT=8080` matches container.
4. **F1** may be used only for a short private trial; not the clinic-test target.

---

## 3. Health proof (agent resumes after URL exists)

From any machine (no secrets):

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "https://<fqdn>/health/live"
curl -sS -o /dev/null -w "%{http_code}\n" "https://<fqdn>/health/ready"
```

Expect **200** / **200**. Save redacted bodies + status codes under:

`apps/api/.ci-evidence/clinic-test-d1-<sha>/` (**do not commit**).

---

## 4. CORS notes (for D2 Pages — do not deploy Pages in D1)

| Now (D1) | Later (D2) |
|----------|------------|
| Set `CORS_ORIGINS` to a placeholder or omit until Pages URL exists | Replace with exact Cloudflare Pages HTTPS origin(s) |
| `credentials: true` requires **exact** origins (no `*`) | Match clinic-dashboard Pages custom domain if any |
| Super-admin optional later | Separate `SUPER_ADMIN_CORS_ORIGINS` if needed |

---

## 5. Runtime DB rules

| Rule | Required |
|------|----------|
| `DATABASE_URL` user = `pilot_neon_app` | YES |
| Owner / migrate URL on Azure runtime | **NO** |
| SSL to Neon (`sslmode=require` or Neon SSL URL) | YES |
| Azure Database for PostgreSQL | **OUT** |

---

## 6. If Azure is not ready

1. Complete this runbook packaging (Dockerfile + docs).  
2. Human creates Azure account + Container App + secrets.  
3. Reply to agent with **hostname only** (no secrets).  
4. Agent re-runs health proof and upgrades RESULTS to PASS/FAIL.

```text
Do not fake PASS without public 200s
Do not paste DATABASE_URL / JWT into chat or git
```
