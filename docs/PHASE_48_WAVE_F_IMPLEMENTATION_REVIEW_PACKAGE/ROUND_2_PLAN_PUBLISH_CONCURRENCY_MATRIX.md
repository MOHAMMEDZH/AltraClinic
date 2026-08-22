# ROUND_2_PLAN_PUBLISH_CONCURRENCY_MATRIX

## Lock
`pg_advisory_xact_lock(hashtext(tenantId:userId))` then post-lock DRAFT reread.

## Test
| ID | Result |
|----|--------|
| F5-R2-T7 concurrent publishes → single ACTIVE | PASS |
| audit details.postLockReread | true |
