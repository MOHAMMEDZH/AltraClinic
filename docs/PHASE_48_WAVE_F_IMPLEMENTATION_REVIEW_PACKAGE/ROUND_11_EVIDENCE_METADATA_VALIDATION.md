# ROUND 11 — Evidence Metadata Validation

## Collection rules for the next external package

1. Do **not** claim a final SHA-256 for `06_COPIED_FILES_MANIFEST.tsv` inside that same file as if it were a content hash of the finalized file.
2. Manifest self-row must use `SELF` / `NOT_HASHED` / `FINAL_FILE` / `SELF_NOT_HASHED`.
3. Total file count is computed only after every package file is finalized, by recounting regular files in the destination tree.
4. Archive entry count must distinguish files vs directories when reported.
5. Every non-self manifest size/SHA-256 must verify.
6. Exclusions must honestly list secrets, `.env*`, `node_modules`, `.git`, coverage, dumps, generated package trees.
7. External `promt.zip.sha256.txt` is the authoritative ZIP hash (no self-referential embedded ZIP hash).

## Executable checks

- R11-C-T1 — sample manifest self-row policy
- R11-C-T2 — recounted regular-file count equals reported count

These are collection/metadata rules, not production financial code changes.
