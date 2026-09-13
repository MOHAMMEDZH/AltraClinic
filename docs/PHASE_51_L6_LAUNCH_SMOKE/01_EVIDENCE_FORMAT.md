# L6 — Evidence format

## Directory (uncommitted)

```text
apps/api/.ci-evidence/phase51-l6-<shortsha>/
  00_SUMMARY.md          # PASS / FAIL / SKIP table + honesty notes
  01_observability.txt   # stdout/stderr excerpt from observability wrapper
  02_tenant_isolation.txt # stdout/stderr excerpt OR skip reason
```

**Do not commit** `.ci-evidence` unless CTO authorizes separately.

`<shortsha>` = `git rev-parse --short HEAD` at run time (or packaging tip if documenting a prior run).

---

## What to capture

| Field | Required |
|-------|----------|
| Date (UTC) | YES |
| Branch + HEAD SHA | YES |
| Command invoked | YES |
| Working directory | YES (`apps/api` unless noted) |
| Result: **PASS** / **FAIL** / **SKIP** | YES |
| SKIP reason (DB down, timeout, etc.) | If SKIP |
| Exit code | If executed |
| Suite counts (if printed) | Prefer |

---

## How to cite

In L7 review / PA precheck (later): point to uncommitted path + SHA, e.g.

```text
apps/api/.ci-evidence/phase51-l6-<shortsha>/00_SUMMARY.md
```

PR CI Progressive Inventory + Inventory E2E on accepting lineage remain complementary authoritative gates — not replaced by L6 local smoke.

---

## Honesty rules

- Unavailable Postgres → **SKIP** tenant isolation (fail-closed wrapper may exit non-zero; record as SKIP/FAIL honestly per wrapper message — do not rewrite as PASS).  
- Do not claim Step 28/29 or full `phase48-onepass` unless actually run.  
- Do not claim commercial launch or Phase 51 PA from smoke alone.
