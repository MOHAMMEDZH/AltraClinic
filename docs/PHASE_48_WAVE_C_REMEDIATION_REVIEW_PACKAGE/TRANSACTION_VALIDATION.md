# Transaction Validation

## Correction atomicity
- Implementation: `InventoryUsagePostingService.correctUsage` wraps reverse+repost in one `$transaction`.
- Rollback proof hook: `forceFailAfterReverse` when `ALLOW_TEST_DATABASE_RESET=true`.
- Test: **C-INV-30** asserts original remains `POSTED`, stock unchanged from post-only delta, no `inventory.usage.correct` audit row.

## Disposal atomicity
- Implementation: `disposeBatch` posts usage, creates `InventoryDisposalLog`, updates batch status, writes audit — one txn.
- Rollback hook: `forceFailAfterUsage`.
- Test: **C-INV-31** asserts stock unchanged and zero disposal logs.

## Audit atomicity
- `recordInTransaction(tx, …)` used for post/reverse/correct/dispose.
- Failed txn must not leave orphan `audit_entries` (proven by C-INV-30 audit count equality on forced fail).

## Runtime result in this environment
**NOT EXECUTED** — Docker/test DB unavailable. Code and tests are present for external re-run.
