# K5 — Rollback Runbook (hybrid)

**Rollback decision authority:** **Release Manager** (Step 29 §8.4)  
**App rollback executor:** Platform Operations  
**DB restore / compensation:** Database/Backup Operator (only under Release Manager authorization)  
**Phase 49 claim:** procedure packaging — does **not** claim a production rollback was executed

---

## 1. When to roll back vs forward-fix

| Situation | Preference |
|-----------|------------|
| Bad app/config artifact; schema compatible with previous app | **App rollback** (redeploy prior artifact) |
| Migration bug fixable with a new forward migration; data intact | **Forward-fix** (`PRODUCTION_MIGRATION_WORKFLOW.md`) |
| Corrupt / unsafe schema or data state; pre-deploy backup verified | **DB restore** to approved target (K3 / `DISASTER_RECOVERY.md`) — RM authorize |
| Ambiguous notification deliveries | Do **not** blind-resend; follow portal/notification ops stance |
| Cross-tenant leakage / audit hole | Contain first; Release Manager may **RELEASE BLOCK** — see `SECURITY_RUNBOOKS.md` |

Default bias: **forward-fix** for migrations; **app rollback** for non-schema faults; **restore** only when RM authorizes and backup evidence exists.

---

## 2. DB migration rollback policy (honest limits)

Aligned to `docs/PRODUCTION_MIGRATION_WORKFLOW.md` and Step 29:

- Prisma **does not** auto-rollback applied migrations.
- “Down” migrations are **not** assumed present for every change — maintain them only where critical and tested.
- Prefer a **new forward migration** over destructive reverse in production.
- Full data restore is a **cutover/incident** action (K3 scripts + external host), not a casual undo.
- After restore: re-apply `db:rls:apply` / `db:triggers:apply` if required; invalidate entitlement caches.
- Preserve **append-only audit** history — do not wipe audit to “clean” a rollback (Step 29 §12; Security runbooks).

K3 note: full-data restore of local `booking_test` can fail on fixture FK debt — that is **test fixture debt**, not a license to skip pre-deploy backup/verify in production.

---

## 3. App rollback + verification

1. **Release Manager** decides rollback (or written waiver to continue / forward-fix).
2. Platform Operations redeploys the **last known-good** release artifact (external CD/topology).
3. Database/Backup Operator executes restore or compensation **only if** RM authorized.
4. Platform Operations invalidates entitlement caches if cross-tenant/stale-cache risk.
5. Verify (K4 health map):

| Endpoint | Expect |
|----------|--------|
| `GET /health/live` | 200 / live |
| `GET /health/ready` | 200 / ready (deps OK) |
| `GET /health` | Aggregate healthy |
| Optional | `/metrics` scrape path if configured externally |

6. Smoke: auth boundary, one entitlement/limit path, audit write.
7. Platform Operations + Platform Security sign post-rollback verification.

---

## 4. Authorization (Step 29)

| Action | Authority |
|--------|-----------|
| Decide rollback vs forward-fix vs continue | **Release Manager** |
| Execute app artifact rollback | Platform Operations |
| Execute DB restore | Database/Backup Operator **after** RM authorize |
| Break-glass / privileged access during incident | Release Manager + Platform Security concurrence |
| Escalate leakage / release-block | Platform Security on-call → Eng lead → **Release Manager** |

```text
No Release Manager authorization = no production DB restore
Step 29 acceptance does not auto-authorize rollback or cutover
```
