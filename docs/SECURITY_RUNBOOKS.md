# Security Runbooks (Flexible Step 28)

| Field | Value |
|-------|--------|
| **Release** | 47 — Flexible Healthcare Super Admin MVP |
| **Step** | 28 — Security Hardening and Compliance Review |
| **Status** | Accepted / Complete with Step 28 |
| **Related** | `docs/SECURITY_HARDENING_AND_COMPLIANCE_REVIEW.md` |

**Rules:** Never paste real secrets, tokens, MFA seeds, connection strings, or PHI into tickets, chat, or this document. Use redaction and secret-manager references only.

**Ownership default:** Platform Security on-call → escalate to Platform Engineering lead → Release Manager for release-blocking decisions. Step 29 handover does not authorize itself from these runbooks.

---

## 1. Credential / secret exposure

### Detection
- Secret scanning alert, accidental commit, log/error containing key-shaped material, leaked `.env`, or support paste of tokens/MFA material.
- SEC/LOG matrix failures or hygiene check: `secret values present in evidence ≠ 0`.

### Containment
1. Revoke/rotate the exposed credential immediately in the authoritative secret store (do not commit replacements).
2. Invalidate related sessions/API keys/platform refresh cookies as applicable.
3. Remove the secret from git history only under explicit operational authority (coordinate; do not unilateral force-push `main`).
4. Block further deploys that embed the old value.

### Evidence preservation
- Preserve commit SHAs, file paths, timestamps, correlation IDs, and scanner finding IDs.
- Store redacted excerpts only; never re-copy full secret values into the incident channel.

### Rollback
- Roll forward with rotated secrets preferred.
- If a bad config deploy introduced exposure, roll back the deploy artifact without restoring the leaked secret.

### Ownership / escalation
- **Owner:** Platform Security  
- **Escalate:** Engineering lead + Release Manager if production tenants may be affected  
- **Release:** Treat unresolved production exposure as release-blocking until rotated and sessions revoked

---

## 2. Suspicious / revoked Platform session

### Detection
- Repeated authz denials, refresh reuse/rotation anomalies, access after explicit revoke/suspend, or MFA/step-up failures followed by success from unexpected IP/UA.
- SES/BND alerts or audit rows for platform login/refresh/revoke.

### Containment
1. Revoke the platform session (and sibling sessions for the principal if policy requires).
2. Force re-authentication with MFA; consider step-up for subsequent sensitive actions.
3. Temporarily disable the platform user if compromise is likely.
4. Review recent sensitive mutations by that actor (RBAC, plans, overrides, lifecycle, retries).

### Evidence preservation
- Export/query audit for actorId, sessionId, correlation IDs, IP/UA hashes as stored, timestamps.
- Preserve rate-limit and auth denial counters without collecting raw tokens.

### Rollback
- Revert unauthorized mutations via governed compensating actions (not by disabling audit/MFA).
- Restore user access only after credential reset and security review.

### Ownership / escalation
- **Owner:** Platform Security / Identity  
- **Escalate:** Security Administrator role holders; Release Manager if blast radius includes catalog or multi-tenant changes

---

## 3. Cross-tenant incident

### Detection
- ISO/BND failures, customer report of foreign tenant data, cache key collision suspicion, or platform list/detail returning unexpected tenant scope.
- Audit shows targetTenant mismatch vs actor intent.

### Containment
1. Suspend the offending principal or integration credential.
2. Freeze related exports and privileged-access grants touching the involved tenants.
3. Do **not** broaden RLS bypass or disable tenant filters as mitigation.
4. If a specific route is implicated, feature-flag/deny that route only if an existing kill-switch exists — do not invent entitlement grants.

### Evidence preservation
- Capture request IDs, route, principal type (platform vs clinic), tenant A/B IDs, before/after row counts (`business mutation delta`, `entitlement mutation delta`).
- Preserve DB snapshots or logical exports under ops backup procedures (no PHI expansion into Super Admin).

### Rollback
- Compensating writes to restore tenant isolation invariants.
- Invalidate EER/entitlement caches for involved tenants (tenant + snapshot identity keys).

### Ownership / escalation
- **Owner:** Platform Security + Tenant Ops  
- **Escalate:** Immediate Release Manager notification; treat confirmed cross-tenant leakage as **RELEASE BLOCKED** until contained

---

## 4. Entitlement / cache poisoning

### Detection
- CACHE/ER/LIM failures; tenant appears entitled without subscription/override source; cross-tenant cache hit; Feature Flag suspected as sole grant.
- Snapshot identity drift vs managed EER authority.

### Containment
1. Invalidate entitlement caches for affected tenant(s) using authoritative invalidation paths.
2. Re-resolve from managed EER snapshot / commercial SoR (Subscription, Add-on, Override, lifecycle).
3. Disable any non-authoritative debug refresh endpoints if implicated.
4. Confirm Feature Flags are deny-only and did not create capability.

### Evidence preservation
- Record cache key shape (tenant + snapshot identity), SoR versions, explainEntitlement outputs **without** secrets/PHI.
- Audit trail of commercial changes preceding the incident.

### Rollback
- Restore prior published Plan Version assignment only via governed subscription path.
- Never “fix” by setting missing/UNCONFIGURED → Unlimited.

### Ownership / escalation
- **Owner:** Entitlements / EER engineers  
- **Escalate:** Platform Security if cross-tenant; Release Manager if systemic cache key defect

---

## 5. Audit failure

### Detection
- Sensitive mutation succeeds with `first success audit delta ≠ expected`, FSEC03/FSEC24 failures, or AUDSEC gaps.
- Operators observe missing audit for publish, override approve, lifecycle, or notification manual retry.

### Containment
1. Fail closed: stop the affected write path if audit cannot be durably recorded (preferred).
2. If a bug allowed mutation without audit, freeze that API and revoke sessions of actors who used it during the window.
3. Do not disable audit to “restore service.”

### Evidence preservation
- Transaction logs, correlation IDs, intended audit payload shapes (redacted), DB transaction outcomes.
- Note replay: `replay additional success audit delta` must remain 0 after fix.

### Rollback
- Roll back the mutating deploy; retain any partial audit rows already written.
- Backfill is exceptional and must itself be audited under dual control.

### Ownership / escalation
- **Owner:** Audit Center maintainers  
- **Escalate:** Release Manager — unresolved audit hole on sensitive actions is release-blocking

---

## 6. Ambiguous notification / manual retry

### Detection
- Provider returns ambiguous; job stuck; operator pressure to “just resend”; NOTSEC regressions; converted Trial still receiving expiry warnings.

### Containment
1. **Do not** blind auto-resend (Strategy B). Leave durable `ambiguous` until governed manual retry.
2. Manual retry only with permission + reason; record audit.
3. Suppress Trial warnings for converted Trials (C07 / TH40 posture).
4. Ensure test providers cannot send externally (`realExternalDeliveriesDuringTests = 0` in CI).

### Evidence preservation
- Intent / message / job / attempt IDs, provider status classes (not raw provider secrets), preference rows, actor + reason for retry.
- Confirm no invite secrets, MFA material, or PHI in templates/logs.

### Rollback
- Revert notification adapter/scheduler deploy if it reintroduced auto-resend.
- Preserve intents/attempts/prefs/audit (Step 27 rollback stance).

### Ownership / escalation
- **Owner:** Notifications maintainers  
- **Escalate:** Platform Security if secret/PHI leakage; Support lead for customer comms

---

## 7. Critical / High dependency issue

### Detection
- DEP tooling reports Critical/High on a reachable dependency path; advisory for packages used by auth, crypto, or request parsing.

### Containment
1. Assess reachability (runtime path vs unused transitive).
2. Apply minimal patched version or remove unused path — **no blind mass upgrades**.
3. If unfixed and reachable, mark **RELEASE BLOCKED**.
4. Do not upload proprietary source to external scanners without explicit authorization.

### Evidence preservation
- Package name, version, dependency path, advisory ID, reachability notes, lockfile diff hash.
- Never commit registry auth tokens.

### Rollback
- Revert lockfile upgrade if it breaks build; keep release blocked until a safe upgrade path exists.

### Ownership / escalation
- **Owner:** Platform Engineering  
- **Escalate:** Release Manager for Critical/High unresolved without block decision

---

## 8. Rate-limit abuse

### Detection
- Spike of `rate_limit.denied`, auth 401/429 storms, export flooding, or RL matrix failures in production.
- Suspected `NODE_ENV=test` mis-set in a deployed environment (would no-op limits — treat as config incident).

### Containment
1. Confirm `NODE_ENV` and proxy trust configuration in the affected environment.
2. Tighten edge/IP controls for abusive sources; keep app limits enabled.
3. Temporarily disable only the abused public route via existing ops controls if available.
4. Do not raise limits ad hoc to “stop the pages.”

### Evidence preservation
- Scope (`public_ip`, `export`, etc.), windows (auth 60/min IP; exports 30/hour), sample request paths, tenant IDs if present, audit `rate_limit.denied` metadata.
- No Authorization header capture.

### Rollback
- Restore prior rate-limit config if an erroneous change caused outage; keep abuse blocks at the edge as needed.

### Ownership / escalation
- **Owner:** API / SRE  
- **Escalate:** Security if credential stuffing; Release Manager if limits disabled in prod

---

## 9. Plan Version mutation attempt

### Detection
- PVSEC failure, audit for attempted PATCH on published version, OCC conflict storms, or entitlement composition drift without new version.

### Containment
1. Deny/block the mutating API if a bypass is suspected.
2. Verify published versions unchanged (identity, entitlements, limits, modules, compatibility).
3. Revoke actor sessions; review SoD (publisher vs creator).
4. Legal modification path remains **clone / new version** only.

### Evidence preservation
- Plan Version IDs, rowVersion/OCC tokens, actor permissions, before/after hashes of immutable fields.
- Audit rows for publish vs illegal mutate attempts.

### Rollback
- If corruption occurred, restore from backup/governed catalog repair — never “edit published in place.”
- Invalidate EER caches for tenants on affected versions.

### Ownership / escalation
- **Owner:** Plans & Subscription maintainers  
- **Escalate:** Platform Security + Release Manager (catalog integrity is release-blocking)

---

## 10. Release-blocking security issue

### Detection
- Any Critical/High finding with `release block = YES`, Case C failure, `criticalUnresolvedWithoutReleaseBlock ≠ 0`, `highUnresolvedWithoutReleaseBlock ≠ 0`, confirmed cross-tenant leak, audit disabled, or production test-hook activation.

### Containment
1. Declare **RELEASE BLOCKED** in the release channel; do not start Flexible Step 29.
2. Stop promotion of the affected artifact.
3. Apply smallest coherent fix with failing regression first (Step 28 fix policy).
4. Re-run affected matrices and, if product code changed after a Case C attempt, invalidate that attempt and rerun one-pass from command 1.

### Evidence preservation
- Finding ID, severity, surface, reproduction, fix SHA, regression IDs, Case C attempt metadata.
- Hygiene: purge temporary pentest/scanner dumps; keep sanitized docs only.

### Rollback
- Roll back to last accepted Step 27 / last known-good security baseline without widening permissions, disabling MFA/audit/entitlements, enabling managed LEGACY fallback, or restoring stale notification auto-resend.

### Ownership / escalation
- **Owner:** Release Manager (decision) + Platform Security (technical)  
- **Escalate:** Product/CTO only for accepted residual risk with written release note  
- **Exit criteria:**

```text
criticalUnresolvedWithoutReleaseBlock = 0
highUnresolvedWithoutReleaseBlock = 0
```

Step 29 remains **Not Authorized** until Step 28 is Accepted / Complete.

---

## 11. Super Admin CSP / production header ownership

### Authority (repository)
- **SSOT:** `apps/super-admin/src/security/csp-policy.ts` (`SUPER_ADMIN_CSP_POLICY`, `CSP_OWNERSHIP`)
- **Shipped in build:** HTML meta CSP in `apps/super-admin/index.html` (copied into `dist/index.html` on `vite build`)
- **Dev/preview headers:** `apps/super-admin/vite.config.ts` imports the same SSOT

### Production serving owner
- **External to this repository** — no nginx/CDN/Dockerfile/static-host config for Super Admin lives in-repo.
- Deploy owner MUST emit equivalent (or stricter) `Content-Security-Policy` response headers at the edge/ingress in addition to the meta policy.
- Manual validation required before production cutover (Step 29 ops): fetch production HTML and response headers; confirm CSP present; confirm en-US and ar-SY still load fonts/API/WS.

### Detection
- Missing CSP header on production Super Admin origin; CSP report-uri violations; XSS probes succeeding.

### Containment
1. Restore edge CSP from SSOT (or stricter).
2. Do not widen `script-src` to CDNs without security review.
3. Rotate any session cookies if XSS is confirmed.

### Ownership / escalation
- **Owner:** Deploy/Platform Ops for edge headers; Frontend Platform for SSOT/meta
- **Escalate:** Platform Security if production CSP absent

