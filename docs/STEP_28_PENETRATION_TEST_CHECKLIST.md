# Step 28 — Penetration-Test Checklist

| Field | Value |
|-------|--------|
| **Document** | Executable security review checklist (Flexible Step 28) |
| **Status** | In Progress with Step 28 |
| **Branch** | `cursor/step28-security-hardening-compliance-review` |
| **Authority** | Playbook v4; `docs/SECURITY_HARDENING_AND_COMPLIANCE_REVIEW.md` |

## Honest scope statement

This checklist records **repository-executable security review** (automated matrices, integration/unit suites, config inspection, and dependency tooling supported by the repo).

It is **not** an independent third-party penetration test. No external red-team engagement, paid bug bounty, or certified pentest firm report is claimed by this document.

Marking legend:

| Mark | Meaning |
|------|---------|
| Executed / Pass | Covered by repository tests or verified code inspection with pass result |
| Executed / Fail | Covered and failing (must fix or release-block) |
| N/A | Not applicable on this transport/surface; reason required |
| Requires external/manual assessment | Beyond honest repo executable scope |

---

## 1. Authentication / session / MFA

| Item | Result | Notes |
|------|--------|-------|
| Platform vs clinic audience separation | Executed / Pass | Distinct platform principal; clinic JWT insufficient for `/platform/*` |
| Wrong issuer / audience rejection | Executed / Pass | BND04–BND05 family |
| Expired / revoked session | Executed / Pass | SES + BND06–BND07 |
| MFA secret at rest (AES-256-GCM) | Executed / Pass | `PLATFORM_MFA_ENCRYPTION_KEY`; no secret values in docs |
| MFA / step-up bypass attempts | Executed / Pass | TH07 / SES |
| Cookie refresh CSRF (platform) | Executed / Pass | Double-submit + Origin allowlist |
| Bearer-only classic CSRF | N/A | After transport inspection: non-cookie ambient Bearer routes |
| Physical device theft / offline attacker | Requires external/manual assessment | Outside repo suite |

## 2. Authorization / IDOR / privilege escalation

| Item | Result | Notes |
|------|--------|-------|
| PlatformPermissionGuard enforcement | Executed / Pass | No platform `super_admin` bypass |
| Role-name alone on platform | Executed / Pass | Clinic `super_admin` rejected as platform principal |
| Tenant legacy `super_admin` bypass | Executed / Pass (residual documented) | F-TENANT-SA MEDIUM on tenant routes only |
| Cross-tenant direct-ID read/mutate | Executed / Pass | ISO / BND11–BND12 |
| Wildcard permission bypass | Executed / Pass | AUTH / TH05 |
| List / export filter widening | Executed / Pass | BND13–BND14 |
| Social engineering of operators | Requires external/manual assessment | Process, not code |

## 3. Tenant isolation

| Item | Result | Notes |
|------|--------|-------|
| Tenant A ≠ Tenant B data paths | Executed / Pass | RLS + app filters |
| Platform control-plane hybrid (G-RLS-01) | Executed / Pass (residual noted) | App-filter hybrid accepted with explicit release note |
| Cross-tenant cached entitlement | Executed / Pass | CACHE; keys include tenant + snapshot identity |
| Network segmentation / VPC misconfig | Requires external/manual assessment | Deploy topology |

## 4. Mass assignment

| Item | Result | Notes |
|------|--------|-------|
| Protected field injection (tenantId, approvedBy, publishedAt, provenance, etc.) | Executed / Pass | MA01–MA16 |
| Internal-only / audit fields via API | Executed / Pass | API + MA |

## 5. CSRF / CORS

| Item | Result | Notes |
|------|--------|-------|
| No `origin: '*'` with credentials (realtime) | Executed / Pass | G-CORS-01 / F-CORS-01 Fixed |
| HTTP CORS allowlist (`getAllowedHttpCorsOrigins`) | Executed / Pass | Rejects `*` when credentials enabled |
| Unsafe Origin reflection | Executed / Pass | Allowlist decision only |
| Platform cookie CSRF double-submit | Executed / Pass | CSRF01–CSRF12 applicable paths |
| CDN / reverse-proxy Origin rewrite abuse | Requires external/manual assessment | Edge config |

## 6. Rate limiting

| Item | Result | Notes |
|------|--------|-------|
| Auth routes 60/min IP | Executed / Pass | `ApiRateLimitService` |
| Exports 30/hour | Executed / Pass | Export scope |
| Production enforce path unit-tested | Executed / Pass | |
| `NODE_ENV=test` no-op | N/A (accepted INFO) | F-RL-TEST — test isolation; not a production bypass proof |
| Spoofed forwarding headers in real prod proxy | Requires external/manual assessment | Depends on trusted-proxy deploy |

## 7. Injection / XSS / CSP / headers

| Item | Result | Notes |
|------|--------|-------|
| API security headers middleware | Executed / Pass | F-HDR-01 Fixed |
| CSP `default-src 'none'` on API JSON | Executed / Pass | Not a substitute for SPA CSP |
| Super Admin SPA CSP / XSS | Executed / Pass (suite) + Requires external/manual for full browser matrix | UISEC + HDR; full browser adversarial XSS needs manual |
| SQL injection on Prisma paths | Executed / Pass | Parameterized access patterns in suites |
| CSV formula injection | Executed / Pass | IO / export families |
| HTML template injection in notifications | Executed / Pass | NOTSEC / privacy suites |

## 8. Secrets / logging / privacy

| Item | Result | Notes |
|------|--------|-------|
| No secrets printed in docs/evidence | Executed / Pass | Hygiene requirement |
| MFA / tokens / keys absent from logs | Executed / Pass | LOG01–LOG16 |
| No PHI in Super Admin notifications/search/dashboard | Executed / Pass | PRIV / S-08 |
| HIPAA / GDPR certification | N/A | Explicit non-claim — legal/certification out of scope |
| Production secret store / KMS review | Requires external/manual assessment | Ops |

## 9. Entitlement / limit / cache

| Item | Result | Notes |
|------|--------|-------|
| Tenant self-grant impossible | Executed / Pass | SG01–SG20 |
| Feature Flag cannot grant entitlement | Executed / Pass | FF01–FF12 |
| missing / UNCONFIGURED ≠ Unlimited | Executed / Pass | LIM |
| Published Plan Version immutable | Executed / Pass | PVSEC |
| Unauthorized Add-on / Override | Executed / Pass | OVR |
| Cache poisoning / cross-tenant keys | Executed / Pass | CACHE01–CACHE20 |
| Stale cache after commercial change | Executed / Pass | Invalidation families |

## 10. Notifications (Step 27 regression)

| Item | Result | Notes |
|------|--------|-------|
| Ambiguous → no blind auto-resend | Executed / Pass | Strategy B / NOTSEC01 |
| No false DELIVERED | Executed / Pass | NOTSEC02 |
| Manual retry permission + reason | Executed / Pass | NOTSEC03 |
| Converted Trial stale warning suppressed | Executed / Pass | NOTSEC05 / TH40 |
| Provider / invite / MFA secrets absent | Executed / Pass | NOTSEC06–08 |
| `realExternalDeliveriesDuringTests = 0` | Executed / Pass | Test policy |

## 11. Exports / files

| Item | Result | Notes |
|------|--------|-------|
| Export filter widening denied | Executed / Pass | BND14 / ISO |
| Path traversal on applicable file surfaces | N/A or Executed / Pass | Only where file surfaces exist; no invented features |
| Large export DoS | Executed / Pass (bounded) + Requires external/manual for prod load | Query/DoS proof in Step 28 |

## 12. Dependencies / supply chain

| Item | Result | Notes |
|------|--------|-------|
| Repo-supported dependency/security tooling review | Executed / Pass | DEP01–DEP20 posture; no secret upload |
| Critical/High reachable vulns unresolved without block | Executed / Pass | Required `= 0` unresolved without release block |
| Full transitive malware / typosquat hunt | Requires external/manual assessment | Continuous ops |
| Blind mass upgrades | N/A | Explicitly out of policy |

## 13. Test / debug hooks

| Item | Result | Notes |
|------|--------|-------|
| Hooks require `NODE_ENV===test` AND exact selector | Executed / Pass | HOOK01–HOOK16 |
| Production cannot activate failure selectors | Executed / Pass | TH37–TH38 |

## 14. Failure injection / concurrency

| Item | Result | Notes |
|------|--------|-------|
| Fail-safe when auth/RBAC/audit/EER/cache unavailable | Executed / Pass | FSEC01–FSEC24 applicable |
| Concurrent revoke / publish / override / limit races | Executed / Pass | CSEC01–CSEC24 |
| Multi-region active-active chaos | Requires external/manual assessment | Infra |

---

## Summary counters (review posture)

```text
independentThirdPartyPenetrationTest = NO
criticalUnresolvedWithoutReleaseBlock = 0
highUnresolvedWithoutReleaseBlock = 0
```

Categories marked **Requires external/manual assessment** remain open as operational follow-ups; they are not silently marked Pass.
