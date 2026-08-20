# Wave D Test Plan

Round 1 scope: close confirmed blockers B1-B6 only.

## Targeted suites

1. `wave-d-dental.postgres.integration.spec.ts`
   - B1 completion status safety
   - B2 reference integrity
   - B3 correction serialization + rollback
   - B6 audit/foreign-ref gaps
2. `wave-d-rls.postgres.integration.spec.ts`
   - B4 full table lifecycle under NOBYPASSRLS
3. `wave-d-pricing-production-path.postgres.integration.spec.ts`
   - B5 publish + booking production path
4. Existing Wave D HTTP/operatory/lab/pricing-unit unit suites

## Full regressions

- Wave D clean + upgrade validators
- Wave A/B/C and permissions package regression commands
- API build gate (baseline TS6059 only)
