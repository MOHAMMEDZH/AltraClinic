# Round 1 Real Production Path Matrix

HTTP Nest paths (no mocked core services):
- eligibility / plan create / publish
- SERVICE_NET_AFTER_DISCOUNT post
- COLLECTED_REVENUE post-collected
- reverse / settle / owner-report
- mismatch rejection
- legacy cutover GoneException

Evidence: `wave-f-http.postgres.integration.spec.ts`, `wave-f-round1.postgres.integration.spec.ts`
