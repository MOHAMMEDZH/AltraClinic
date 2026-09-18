# Clinic Test Deploy — D1 Azure API

CTO-authorized **D1**: Nest API on Azure HTTPS → Neon `pilot_neon_app` → prove `/health`.

**NOT Phase 52.** Product production cutover = **NOT CLAIMED.** Cloudflare Pages = **D2** (out).

| Field | Value |
|-------|--------|
| **Program** | Clinic Test Deploy (P1) |
| **Slice** | D1 — Azure API |
| **Chosen host** | **Azure Container Apps (consumption)** — preferred; App Service **B1** acceptable; **F1** = trial-only footnote |
| **Public API base URL** | **PENDING** — no Azure subscription / `az` CLI on agent host at D1 packaging time |
| **Result** | **PARTIAL** — runbook + Dockerfile delivered; public health **not** proven |
| **Runtime DB** | Neon pilot + `pilot_neon_app` only (NOBYPASSRLS); SSL required |
| **Lineage tip (D0)** | `dd48e85` |

| File | Purpose |
|------|---------|
| [01_RUNBOOK.md](./01_RUNBOOK.md) | Create / deploy / update (Container Apps preferred) |
| [02_SECRETS_MAP.md](./02_SECRETS_MAP.md) | Azure settings **keys** (values out-of-band) |
| [03_RESULTS.md](./03_RESULTS.md) | PASS / PARTIAL / FAIL |
| [04_EXPLICIT_OUT.md](./04_EXPLICIT_OUT.md) | Pages, Azure Postgres, cutover claim |

**Container path:** `apps/api/Dockerfile` (build from **repo root** with `--ignorefile apps/api/.dockerignore`).

```text
Human: Azure login + create RG/Container App + paste secrets (never chat/git)
Agent: Dockerfile + runbook + CORS notes + health evidence when URL exists
D1 public /health = BLOCKED until human provisions Azure
Product production cutover = NOT CLAIMED
```
