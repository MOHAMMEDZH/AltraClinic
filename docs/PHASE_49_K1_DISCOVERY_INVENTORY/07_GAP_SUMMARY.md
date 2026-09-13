# K1 — Gap Summary (ranked → K2–K7 inputs)

**Lineage:** `9eac595+` · Inventory only · **Phase 49 PA = ACCEPTED** (CTO @ `5bfda08`; merge `1501190`)

---

## Ranked gaps (top → later)

| Rank | Gap | Domain | Proposed slice | Notes |
|------|-----|--------|----------------|-------|
| **1** | No Phase 49 secrets/config surface checklist + evidence format; Step 28 scan/audit **not in required PR CI**; ConfigModule validation still roadmap | Secrets/config | **K2** | Reuse Step 28 scan/audit/onepass; do not invent new scanner brand |
| **2** | No Phase 49 restore-drill evidence on `9eac595+`; dual path (ops `pg_dump` vs Backup Center flag-OFF) unclear for cutover | Backup/restore | **K3** | Reuse scripts + DR docs; clarify SoR boundary |
| **3** | No unified deploy/rollback SSOT for Production Hardening (topology external; CI ≠ deploy) | Deploy/rollback | **K5** | Compose Step 29 + migration workflow + portal/security runbooks |
| **4** | Observability present; alert→on-call external; `dashboards-and-alerting` not in onepass | Observability/alerting | **K4** | Reuse Phase 45 + health; no APM/SIEM product |
| **5** | Tenant isolation strong in QA; missing thin Phase 49 production-check packaging | Tenant isolation | **K6** | Reuse Platform DB + selected phase48 runners |
| 6 | Incident content exists in SECURITY_RUNBOOKS; missing Phase 49 SEV/first-15 one-pager | Incident | **K7** | Thin wrap + review/PA precheck |
| 7 | Step 29 cutover gates still pending execution at prod time | Cross-cutting | K3/K5/K7 | Document; do not claim cutover done |
| 8 | Offsite/PITR/on-call tooling external | Backup / Obs | K3/K4 | Accept external boundary |

---

## Precursors that are already strong (do not rebuild)

```text
Step 28 secrets scan / dep audit / security onepass
Step 29 release readiness + ownership matrix
Platform DB Security CI + RLS scripts
Wave I pack matrix / onepass (CLOSED — reuse only)
Observability module + api.observability + health contributors
SECURITY_RUNBOOKS.md (incident classes)
backup-postgres.* / verify-backup.sh / DISASTER_RECOVERY.md
Backup Restore Center docs (flag-gated product)
```

---

## Explicit non-gaps (OUT)

| Item | Why |
|------|-----|
| Phase 50 UX polish | OUT |
| Phase 51 commercial launch | OUT |
| Wave A–I SoR reopen | CLOSED |
| Second test framework | FORBIDDEN |
| Self-granted Phase 49 PA | FORBIDDEN |

---

## Suggested authorize order (unchanged from K0)

```text
K2 Secrets/config → K3 Backup/restore → K4 Observability/alerting
→ K5 Deploy/rollback → K6 Tenant isolation checks → K7 Incident + review/PA precheck
```

CTO may reorder; **do not start any K2–K7 without explicit authorize.**
