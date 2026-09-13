# C5 — STOP-the-line (before real tenant pilot)

These items **must be cleared** before inviting a real tenant onto the pilot.  
Do **not** soften into PASS inside this packet.

| # | STOP item | Why | Clear when |
|---|-----------|-----|------------|
| S1 | **Full-data backup with owner URL (C3b)** | C3 schema-only only; FORCE RLS blocks migrate-admin `COPY` | Owner (or BYPASS-capable dump role) dump → verify → disposable restore **PASS** |
| S2 | **API deployed with `/health` against pilot** (or documented host) | C4 health **SKIP** — no pilot API process on agent host | Live `GET /health/live` + `/health/ready` (and aggregate `/health`) against the pilot API host |
| S3 | **D-17 topology recorded** | Deploy/CD/ingress remain **EXTERNAL** / not invented | Platform Ops fills topology + edge CSP notes (Step 29 §10) |
| S4 | **Secrets rotated** (no chat-leaked passwords in use) | Owner password was exposed in chat historically | Confirm rotation + gitignored URLs only; never re-paste into tickets/chat |

```text
Any open STOP = do not claim real tenant pilot go-live
Neon primary wipe still NOT AUTHORIZED without CTO
self-granted program PA = NO
```
