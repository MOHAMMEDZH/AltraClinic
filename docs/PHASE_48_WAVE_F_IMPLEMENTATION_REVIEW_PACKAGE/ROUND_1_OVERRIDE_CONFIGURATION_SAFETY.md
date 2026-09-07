# Round 1 Override Configuration Safety

Frozen first wave = user-default only.

Round 1: `branchId` / `clinicalServiceId` must be null at create and publish (`assertUserDefaultScopeOnly`).
No silent ignore of override config.

Tests: wave-f-round1 override rejection cases.
