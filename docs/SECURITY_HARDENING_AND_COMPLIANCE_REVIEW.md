# Security Hardening and Compliance Review (Flexible Step 28)

| Field | Value |
|-------|--------|
| **Release** | 47 — Flexible Healthcare Super Admin MVP |
| **Step** | Flexible Step 28 — Security Hardening and Compliance Review |
| **Status** | **In Progress / Acceptance Pending External Review** — semantic evidence-map correction gate in progress; Case C Attempt 3 remains authoritative (`booking_test`, freeze `2026-08-12T22:25:39.061Z`, SHA `6dafb44`). Final acceptance awaits independent review of the corrected 704-record attached matrix evidence. No product/security/runtime change during this semantic-correction gate. |
| **Branch** | `cursor/step28-security-hardening-compliance-review` |
| **Base** | Step 27 HEAD `8aefd462e8bf6697459c4cad5d21077181f67b5a` |
| **Catalog invariant** | `68 / 136 / 68 / 13` |
| **Steps 01–27 + U01** | Accepted / Complete |
| **Step 29** | Not Authorized |

**Case C Attempt 3:** frozen `booking_test`, commit `6dafb4498819a4c0cd5d91dd3704eca3b9a0fb59`, duration ~56.3 min, all counters 0, `exitCode=0`. Per-ID evidence: `apps/api/src/modules/security-hardening/step28-matrix-evidence.ts` — canonical families AUTH–TH = **660** IDs; closure-only RLTEST+TENSA+CSP = **44** IDs; catalog total **704**. Validator: `step28-matrix-evidence.validation.unit.spec.ts`. Export tooling: `apps/api/scripts/step28-matrix-evidence-export.mjs`. Temporary exports deleted after reviewability delivery. N/A IDs: CSRF07, HDR15 (rigorous). Attempt 3 remains authoritative after evidence-extraction closure (docs/tests/metadata only).

---

## 2a. Final matrix evidence extraction (reviewability)

| Field | Value |
|-------|--------|
| Authoritative source | `apps/api/src/modules/security-hardening/step28-matrix-evidence.ts` |
| Validator | `apps/api/src/modules/security-hardening/tests/step28-matrix-evidence.validation.unit.spec.ts` |
| Canonical IDs | 660 (AUTH01–TH40) |
| Closure-only IDs | 44 (RLTEST01–08, TENSA01–20, CSP01–16) |
| Missing / duplicates / unknown / semantic mismatches | 0 |
| N/A | CSRF07, HDR15 |
| Linkage | exact-title / id-tag / suite-anchor / script-file (deterministic; documented in entry `linkageMode`) |
| Attempt 3 | Remains authoritative — no product/security/runtime or material one-pass harness change |

---

## 1. Authority order

1. Flexible Super Admin Implementation Playbook v4  
2. `docs/SUPER_ADMIN_ARCHITECTURE.md`  
3. `docs/PHASE_47_EXECUTION_PLAN.md`  
4. Accepted Step 03 Security Boundary Review (`docs/SUPER_ADMIN_SECURITY_BOUNDARY_REVIEW.md`)  
5. Accepted Step 04 Execution Plan Freeze  
6. Accepted auth / MFA / session / RBAC documents  
7. Accepted Step 12 Healthcare Catalog  
8. Accepted Steps 13–18 Plans / Entitlements / Overrides / Subscriptions / Provisioning / EER  
9. U01 Usage Metering and Limit Enforcement  
10. Accepted Step 19 Lifecycle  
11. Accepted Step 20 Flags / Settings  
12. Accepted Step 21 Audit  
13. Accepted Step 22 Operations  
14. Accepted Steps 23–27 Sales / Trials / Productivity / Notifications  
15. Repository implementation and executable evidence  

Evidence priority: verified runtime code overrides conflicting documentation.

---

## 2. Phase 0 — Accepted Step 27 checkpoint record

| Field | Value |
|-------|--------|
| Step 27 checkpoint branch | `cursor/step27-notifications-and-templates` (accepted HEAD used as Step 28 base) |
| Step 27 local SHA (Step 28 branch base) | `8aefd462e8bf6697459c4cad5d21077181f67b5a` |
| Authoritative Step 27 Case C freeze SHA | `bd7f35a1c3308b1c740f6ff5609b17fc3275f072` |
| Force push used | NO |
| Step 28 branch | `cursor/step28-security-hardening-compliance-review` |
| Catalog | `68 / 136 / 68 / 13` |
| Step 28 product scope | Security-only; no Step 29 |

---

## 3. Existing controls inventory

| Control area | Current control (repository) | Notes |
|--------------|------------------------------|-------|
| Platform vs clinic identity | Distinct platform JWT audience / principal; clinic tokens rejected on platform routes | G-ID-01 closed by Steps 05–08 |
| Platform authorization | `PlatformPermissionGuard` + platform permission catalog; **no** platform `super_admin` bypass | G-AUTHZ-01 (platform) closed |
| Tenant authorization | `PermissionGuard` / matrix; **legacy clinic `super_admin` bypass remains on tenant routes only** | Residual MEDIUM (F-TENANT-SA); not platform Critical |
| MFA secrets | AES-256-GCM envelope; `PLATFORM_MFA_ENCRYPTION_KEY` | G-MFA-01/02 closed; never log key material |
| Sessions / revocation | Platform session policy, refresh rotation, revocation paths from Steps 06–07 | Covered by SES matrices |
| CSRF | Cookie platform refresh/logout: double-submit CSRF cookie + Origin allowlist (`platform-auth-cookies.ts`) | Bearer-only routes: classic CSRF N/A after transport inspection |
| CORS / realtime | `getAllowedHttpCorsOrigins` / `realtimeCorsOriginOption` in `common/security/cors-origins.ts`; realtime gateway **must not** use `origin: '*'` with credentials | **G-CORS-01 FIXED in Step 28** |
| Security headers | `securityHeadersMiddleware`: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP `default-src 'none'` (+ frame-ancestors/base-uri/form-action none), CORP, DNS prefetch off; `Cache-Control: private, no-store` on `/platform` and `/auth`; HSTS only when `ENABLE_HSTS=true` | **F-HDR-01 FIXED** |
| Rate limits | `ApiRateLimitService`: auth `60/min` IP; exports `30/hour`; skipped when `NODE_ENV=test` | F-RL-TEST INFO / accepted for test isolation; production path unit-tested |
| Plans | Published Plan Versions immutable | G-PLAN-01 closed |
| Entitlements / EER | Managed snapshot authority; cache keys include **tenant + snapshot identity** | G-ENT-01 closed with residual docs |
| Limits | `CONFIGURED` / `UNLIMITED` / `UNCONFIGURED`; missing ≠ Unlimited | U01 + EER |
| Feature flags | May deny; **cannot grant** entitlements | Step 20 |
| Privileged access | Time-bound grants; platform path governed | G-PRIV-01 closed with residual wiring notes from prior steps |
| RLS / isolation | Tenant RLS + app-filter hybrid for platform control-plane tables | **G-RLS-01 residual accepted** with explicit release note (not silent) |
| Notifications | Strategy B: durable `ambiguous`; **no blind auto-resend**; converted Trial warnings suppressed | Step 27 |
| Test hooks | Require `NODE_ENV === 'test'` **and** exact selector | Production activation denied |
| Audit | Sensitive platform mutations audited; append-oriented evidence | Step 21 |

### Gap register disposition (Critical / High from Step 03)

| Gap | Disposition |
|-----|-------------|
| G-ID-01 | CLOSED (Steps 05–08); residual documented where applicable |
| G-AUTHZ-01 (platform) | CLOSED (Steps 05–08); no platform super_admin bypass |
| G-ENT-01 | CLOSED (Steps 05–18); residual documented |
| G-PRIV-01 | CLOSED (Steps 05–18); residual documented |
| G-MFA-01 / G-MFA-02 | CLOSED (Steps 05–18); residual documented |
| G-PLAN-01 | CLOSED (Steps 05–18); residual documented |
| G-RLS-01 | Residual **app-filter hybrid** accepted with **explicit release note** (not silent) |
| G-CORS-01 | **CLOSED by Step 28 fix** (was MEDIUM) |

Required gate counters for Step 28 acceptance:

```text
criticalUnresolvedWithoutReleaseBlock = 0
highUnresolvedWithoutReleaseBlock = 0
```

---

## 4. Threat model (TH01–TH40)

Severity: Critical / High / Medium / Low / Info.  
Status: Pass | Fixed | Residual | N/A.  
Release block: YES only if Critical/High unresolved without explicit release-block decision.

| ID | Threat | Severity | Surface | Status | Release block |
|----|--------|----------|---------|--------|---------------|
| TH01 | Platform token accepted by tenant endpoint | High | Tenant API / JWT aud | Pass | NO |
| TH02 | Tenant/Clinic token accepted by Platform endpoint | Critical | `/platform/*` | Pass | NO |
| TH03 | Cross-tenant direct-ID access | Critical | Tenant + platform metadata | Pass (app-filter/RLS hybrid; G-RLS-01 residual noted) | NO |
| TH04 | Role-name authorization bypass | Critical (platform) / Medium (tenant) | Guards | Pass platform; **Residual** tenant `super_admin` bypass | NO (residual release-noted, not platform Critical) |
| TH05 | Wildcard permission bypass | High | Platform RBAC | Pass | NO |
| TH06 | Stale/revoked session use | High | Sessions / refresh | Pass | NO |
| TH07 | MFA / step-up bypass | High | Platform MFA | Pass | NO |
| TH08 | CSRF | Medium | Cookie platform refresh path | Pass (double-submit + Origin allowlist); Bearer-only N/A after transport inspection | NO |
| TH09 | CORS credential abuse | Medium | HTTP + `/realtime` | **Fixed** (allowlist; no `*` + credentials) | NO |
| TH10 | Rate-limit bypass | Medium | Auth / exports / abuse routes | Pass in production path; test no-op accepted (INFO) | NO |
| TH11 | Published Plan Version mutation | Critical | Plans catalog | Pass | NO |
| TH12 | Unauthorized Add-on | High | Add-ons | Pass | NO |
| TH13 | Unauthorized Override | High | Overrides | Pass | NO |
| TH14 | Subscription manipulation | High | Subscriptions | Pass | NO |
| TH15 | Tenant self-grant | Critical | Tenant settings / identity features | Pass | NO |
| TH16 | Entitlement resolver bypass | Critical | EER | Pass | NO |
| TH17 | Stale EER cache authorization | High | EER cache | Pass | NO |
| TH18 | Cache key tenant collision | High | EER cache keys | Pass (tenant + snapshot identity) | NO |
| TH19 | Cache poisoning | High | EER / flag caches | Pass | NO |
| TH20 | Missing / UNCONFIGURED treated as Unlimited | Critical | Limits / U01 | Pass (`= NO`) | NO |
| TH21 | U01 limit bypass | High | Usage metering | Pass | NO |
| TH22 | Feature Flag used as entitlement grant | Critical | Flags + EER | Pass | NO |
| TH23 | Compatibility bypass | High | Facility / specialty compat | Pass | NO |
| TH24 | Provisioning privilege escalation | High | Tenant provisioning | Pass | NO |
| TH25 | Lifecycle bypass | High | Suspend / resume / archive | Pass | NO |
| TH26 | Audit omission / tampering | High | Audit center | Pass | NO |
| TH27 | Secrets in logs / errors | High | Logs / error filters | Pass | NO |
| TH28 | PHI leakage | Critical | Super Admin / logs / notifications | Pass | NO |
| TH29 | Notification secret leakage | High | Notification payloads / audit | Pass | NO |
| TH30 | CSV / export injection or widening | Medium | Exports | Pass | NO |
| TH31 | IDOR | High | Direct IDs | Pass | NO |
| TH32 | Mass assignment | High | DTOs / controllers | Pass | NO |
| TH33 | Prototype / object key abuse | Medium | JSON merge paths | Pass / N/A where no merge surface | NO |
| TH34 | Resource exhaustion | Medium | Rate limits / queries | Pass (with RL test isolation note) | NO |
| TH35 | Unsafe file / path handling | Medium | File ops if present | N/A or Pass on applicable surfaces only | NO |
| TH36 | Dependency / supply-chain risk | High | Lockfiles / tooling | Pass for review posture; ongoing hygiene (no Critical/High left unresolved without block) | NO |
| TH37 | Debug / test hook exposure | High | Test selectors | Pass (`NODE_ENV===test` ∧ exact selector) | NO |
| TH38 | Production fallback to test behavior | High | Env gates | Pass | NO |
| TH39 | Ambiguous notification resend regression | High | Delivery jobs | Pass (Strategy B; no blind auto-resend) | NO |
| TH40 | Stale Trial notification regression | High | Trial warnings | Pass (converted Trial warnings suppressed) | NO |

Most Pass status is supported by accepted prior-step suites (05–27 + U01) plus the Step 28 security-hardening package. TH09 and API header posture are Step 28 Fixed items.

---

## 5. Findings register

Required fields per finding: ID, severity, surface, reproduction, impact, authority violated, fix, regression, residual risk, release block, result.

### F-CORS-01 (was G-CORS-01)

| Field | Value |
|-------|--------|
| ID | F-CORS-01 |
| Severity | MEDIUM |
| Surface | `RealtimeGateway` Socket.IO CORS (`/realtime`) |
| Reproduction | Prior: `origin: '*'` with `credentials: true` allowed any Origin to participate in credentialed WS handshake policy. |
| Impact | Cross-origin credentialed realtime abuse risk. |
| Authority violated | Step 03 G-CORS-01; S-05 / browser boundary |
| Fix | Allowlist via `realtimeCorsOriginOption()` → `getAllowedHttpCorsOrigins()` in `apps/api/src/common/security/cors-origins.ts`; gateway never pairs `*` with credentials. |
| Regression | CORS01–CORS10 / Step 28 security-hardening package |
| Residual risk | Misconfigured `CORS_ORIGINS` / `SUPER_ADMIN_CORS_ORIGINS` in deploy env (ops). |
| Release block | NO |
| Result | **FIXED** |

### F-HDR-01

| Field | Value |
|-------|--------|
| ID | F-HDR-01 |
| Severity | MEDIUM |
| Surface | Nest HTTP API responses |
| Reproduction | Prior API lacked baseline security headers on JSON surface. |
| Impact | Weaker browser/proxy hardening (MIME sniffing, framing, referrer, permissions, CSP default deny, cache of auth surfaces). |
| Authority violated | Step 28 HDR review; defense-in-depth |
| Fix | `securityHeadersMiddleware` in `apps/api/src/common/security/security-headers.middleware.ts` wired from `main.ts`. HSTS opt-in only via `ENABLE_HSTS`. |
| Regression | HDR01–HDR16 |
| Residual risk | Super Admin browser CSP remains owned by `apps/super-admin` Vite headers (separate surface). |
| Release block | NO |
| Result | **FIXED** |

### F-RL-TEST

| Field | Value |
|-------|--------|
| ID | F-RL-TEST |
| Severity | INFO |
| Surface | `ApiRateLimitService.enforce` |
| Reproduction | When `NODE_ENV=test`, enforce returns allow-all. |
| Impact | Integration tests do not exercise Redis limiter; production path remains enforced and unit-tested. |
| Authority violated | None for production; test isolation trade-off |
| Fix | None required; accepted for test isolation. Document and keep production unit coverage. |
| Regression | RL production-path unit tests |
| Residual risk | Accidental `NODE_ENV=test` in a deployed environment would disable limits (deploy config control). |
| Release block | NO |
| Result | **ACCEPTED** |

### F-TENANT-SA

| Field | Value |
|-------|--------|
| ID | F-TENANT-SA |
| Severity | MEDIUM |
| Surface | Tenant `PermissionGuard` (`permission.guard.ts`) |
| Reproduction | Clinic JWT with role `super_admin` short-circuits tenant permission matrix checks. Platform sessions are rejected on this guard and use `PlatformPermissionGuard` instead. |
| Impact | Broader-than-matrix tenant permissions for legacy clinic `super_admin`; **does not** grant platform API access by role name alone. |
| Authority violated | Ideal SoD; Step 03 universal-bypass freeze for **new platform paths** (platform path closed) |
| Fix | Not removed in Step 28 (tenant residual). Explicit release note. |
| Regression | Platform boundary tests prove clinic `super_admin` ≠ platform principal |
| Residual risk | Tenant-route over-permission for legacy role; tracked residual |
| Release block | NO (not Critical for platform) |
| Result | **RESIDUAL — release noted** |

### F-RL-XFF

| Field | Value |
|-------|--------|
| ID | F-RL-XFF |
| Severity | HIGH |
| Surface | `ApiRateLimitService.extractIp` |
| Reproduction | Prior: first `X-Forwarded-For` hop trusted unconditionally → client could spoof IP and bypass/fragment public_ip rate limits. |
| Impact | Auth/login rate-limit key poisoning / bypass under untrusted edge. |
| Authority violated | Step 28 RL spoofed forwarding-header resistance |
| Fix | Honor `X-Forwarded-For` only when `TRUST_PROXY` / `TRUSTED_PROXY` is explicitly enabled; otherwise use socket/`request.ip`. |
| Regression | RL20 unit in `step28-security-hardening.unit.spec.ts` |
| Residual risk | Mis-set TRUST_PROXY without a real trusted proxy |
| Release block | NO |
| Result | **FIXED** |

### F-DEP-01 (supply-chain HIGH closure)

| Field | Value |
|-------|--------|
| ID | F-DEP-01 |
| Severity | HIGH (multiple packages; production audit) |
| Surface | npm production dependency tree (`npm audit --omit=dev`) |
| Reproduction | Pre-Step-28 audit reported High in multer, nodemailer, nanoid, brace-expansion, socket.io-parser, ws (among others). |
| Impact | DoS / injection classes in upload, email, realtime, and transitive ID helpers. |
| Authority violated | Step 28 DEP01–DEP20 |
| Fix | Targeted bumps + root `overrides` + lock pins: `nodemailer@9.0.5`, `multer@2.2.0`, `ws@8.21.3`, `socket.io-parser@4.2.7`, `brace-expansion@2.1.4`, `nanoid@5.1.16` (incl. `docx` nested). Gate: `scripts/step28-dep-audit.mjs`. |
| Regression | Step 28 dep audit in final one-pass |
| Residual risk | Moderate advisories remain (Nest 10 / qs / uuid via exceljs / react-router) — tracked, not Critical/High |
| Release block | NO |
| Result | **FIXED** (Critical=0 High=0 on omit=dev) |

### Totals (Step 28 review posture)

```text
critical = 0 (unresolved)
high = 0 (unresolved; F-RL-XFF and F-DEP-01 fixed)
medium = 1 residual (F-TENANT-SA) + fixed MEDIUM items (F-CORS-01, F-HDR-01)
low = 0
info = 1 (F-RL-TEST)
criticalUnresolvedWithoutReleaseBlock = 0
highUnresolvedWithoutReleaseBlock = 0
```

---

## 6. Matrix evidence map

Executable coverage families. Evidence sources: **accepted prior-step suites (Steps 05–27 + U01)** plus the **Step 28 security-hardening package** (AUTH/BND/API/…/CSEC and related runners). Individual ID results live in suite output; this map is the summary index.

| Family | Scope | Evidence source |
|--------|-------|-----------------|
| AUTH01–AUTH40 | Platform sensitive routes / permissions / deny | Prior RBAC + Step 28 AUTH |
| BND01–BND16 | Platform/Clinic principal, issuer/aud, revoke, cross-tenant | Steps 06–08 + Step 28 BND |
| API01–API32 | Direct API manipulation | Step 28 API + domain suites |
| MA01–MA16 | Mass assignment / protected fields | Step 28 MA |
| PVSEC01–PVSEC12 | Published Plan Version immutability | Steps 13+ + Step 28 PVSEC |
| OVR01–OVR16 | Add-on / Override abuse | Steps 15–18 + Step 28 OVR |
| SG01–SG20 | Tenant self-grant prevention | Steps 17–18 + Step 28 SG |
| FF01–FF12 | Feature Flag ≠ entitlement grant | Step 20 + Step 28 FF |
| ER01–ER24 | EER resolver bypass / managed deny | Step 18 + Step 28 ER |
| LIM01–LIM20 | U01 / limit semantics | U01 + Step 28 LIM |
| CACHE01–CACHE20 | Cache isolation / poisoning | Step 18 + Step 28 CACHE |
| SES01–SES18 | Session / MFA / step-up | Steps 06–07 + Step 28 SES |
| CSRF01–CSRF12 | Cookie CSRF + Bearer N/A rigor | Step 28 CSRF |
| CORS01–CORS10 | Origin allowlist; no `*`+credentials | Step 28 CORS (closes G-CORS-01) |
| HDR01–HDR16 | API security headers / CSP / cache | Step 28 HDR |
| RL01–RL20 | Rate limits / keying / windows | Step 28 RL + `ApiRateLimitService` |
| SEC01–SEC20 | Secrets scan (no values printed) | Step 28 SEC |
| LOG01–LOG16 | Log / error sanitization | Prior + Step 28 LOG |
| PRIV01–PRIV20 | Privacy review (no certification claims) | Prior + Step 28 PRIV |
| DEP01–DEP20 | Dependency review | Step 28 DEP tooling |
| IO01–IO24 | Input / output hardening | Step 28 IO |
| ISO01–ISO32 | Tenant isolation / IDOR | Domain + Step 28 ISO |
| AUDSEC01–AUDSEC32 | Audit completeness | Step 21 + Step 28 AUDSEC |
| HOOK01–HOOK16 | Test/debug hook containment | Step 28 HOOK |
| NOTSEC01–NOTSEC12 | Step 27 notification security regression | Step 27 + Step 28 NOTSEC |
| UISEC01–UISEC16 | Super Admin UI security | Step 28 UISEC |
| HTTPSEC01–HTTPSEC60 | Real HTTP security matrix | Step 28 HTTPSEC |
| FSEC01–FSEC24 | Security failure injection (fail-safe) | Step 28 FSEC |
| CSEC01–CSEC24 | Concurrency security | Step 28 CSEC |

---

## 7. Limit semantics (authoritative)

| Rule | Required result |
|------|-----------------|
| missing treated as Unlimited | **NO** |
| UNCONFIGURED treated as Unlimited | **NO** |
| Plan default used instead of effective limit | **NO** |
| Explicit Unlimited composition | Allowed only when composition yields Unlimited |
| Feature Flag alone grants entitlement | **NO** |

EER cache keys MUST include tenant identity and snapshot identity so Tenant A cannot read or poison Tenant B decisions.

---

## 8. Release blockers

| Blocker | Status |
|---------|--------|
| Critical unresolved without release block | **None** (`= 0`) |
| High unresolved without release block | **None** (`= 0`) |
| Residual notes (non-blocking) | F-TENANT-SA (tenant-local legacy bypass; TENSA01–20 prove no Release 47 self-grant); G-RLS-01 hybrid app-filter (explicit release note) |
| Step 28 Final Case C | **Passed** — Attempt 3 authoritative |
| Step 28 matrix evidence reviewability | **Passed** — complete per-ID catalog + validator |
| Step 29 | Not Authorized — not a Step 28 blocker |

---

## 9. Explicit non-claims

This review **does not** claim:

- HIPAA certification or HIPAA compliance attestation  
- GDPR certification or legal adequacy determination  
- Any other regulatory certification  
- That an **independent third-party penetration test** was performed  
- That residual Medium items are absent  
- That Step 29 release readiness / production handover is complete  

What this review **does** claim: repository-executable security hardening and compliance **review** against Playbook v4 gates S-01–S-08 and Step 28 matrices, with Critical/High unresolved-without-block counts at zero for the documented finding set, Case C Attempt 3 green, and complete per-ID matrix evidence reviewability.
