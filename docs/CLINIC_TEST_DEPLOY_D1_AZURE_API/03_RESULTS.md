# D1 — Results

| Field | Value |
|-------|--------|
| **Result** | **PARTIAL** |
| **Docs tip** | (this commit on `cursor/clinic-test-deploy-kickoff`) |
| **Chosen host** | Azure Container Apps (consumption) — **not provisioned** |
| **Public API URL** | **PENDING** (no hostname) |
| **Evidence** | `apps/api/.ci-evidence/clinic-test-d1-<sha>/` (**UNCOMMITTED**) |
| **Agent host** | No `az` CLI; Docker client present, **daemon not running** |

## Delivered

| Item | Status |
|------|--------|
| Runbook (Container Apps preferred; B1 alternate; F1 footnote) | **YES** |
| Secrets key map (values out-of-band) | **YES** |
| `apps/api/Dockerfile` + `.dockerignore` | **YES** |
| OPERATOR_INDEX + kickoff slice-plan D1 mark | **YES** |
| CORS notes for future Pages (D2) | **YES** |

## Health proof (public)

| Check | Status |
|-------|--------|
| `GET /health/live` → 200 | **NOT RUN** — no public Azure URL |
| `GET /health/ready` → 200 | **NOT RUN** — no public Azure URL |

## Blocker (human / ops)

1. Create (or open) an Azure subscription.  
2. Install/login Azure CLI; create resource group + **Container Apps** environment + app (or App Service **B1**).  
3. Build/push image from repo root; set secrets from [02_SECRETS_MAP.md](./02_SECRETS_MAP.md) in Azure only.  
4. Return **hostname only** to agent; agent re-proves health and upgrades this file to **PASS** or **FAIL**.

```text
D1 = PARTIAL (runbook + Dockerfile; public health blocked)
Do not fake PASS
Product production cutover = NOT CLAIMED
Phase 52 = OUT
Azure Postgres = OUT
Pages = D2
```
