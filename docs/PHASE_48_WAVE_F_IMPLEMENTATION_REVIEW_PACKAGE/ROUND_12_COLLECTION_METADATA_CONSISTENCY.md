# ROUND 12 — Collection Metadata Consistency (R12-C)

## Problem

Round 11 external package summary reported **377** manifest rows while the finalized
`06_MANIFEST_SHA256.txt` contained **378** entries.

## Policy (explicit)

1. Manifest rows are counted **after** finalization (exclude self-hash of the manifest file).
2. `SELF_POLICY`: `06_MANIFEST_SHA256.txt` and `18_FINAL_FILE_COUNT.txt` are **not** listed
   inside the manifest hash list.
3. Final regular-file count = manifest rows + 2 (the excluded metadata files) when those two
   files are present in the archive tree.
4. Summary, manifest verification, and `18_FINAL_FILE_COUNT.txt` must agree exactly.

## Agreement example (Round 11 corrected arithmetic)

| Metric | Value |
|--------|-------|
| Manifest rows (finalized) | 378 |
| Files excluded from self-hash (06 + 18) | 2 |
| Final regular files | 380 |

R12-C-T1 records this arithmetic policy in the Round 12 suite (documentation hygiene only;
no production behavior change).
