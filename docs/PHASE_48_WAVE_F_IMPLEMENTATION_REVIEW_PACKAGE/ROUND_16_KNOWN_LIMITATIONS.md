# Round 16 — Known Limitations

1. Complete-set specials bitmask DP is practical for realistic histories (few non-exact effects). Histories with >24 simultaneous non-exact anomalies are rejected as unrealizable/corrupt — this is **not** a product limit on total refund count.
2. Which refund identity absorbs the saturation residual depends on serialized application order; validation accepts any order-consistent multiset.
3. Production Acceptance still requires a new external actual-file review (this round is READY FOR EXTERNAL REVIEW ONLY).
4. No Round 16 schema migration; historical DB rows created under Round 15 residual behavior are not rewritten (append-only).
5. Gate PRIOR_E_PG uses pattern `wave-e-` (7 suites / 133 tests). Round 15 INDEX included an extra non-Wave-E suite in that bucket; Wave E R3/unit/PG targeted gates all PASS.
