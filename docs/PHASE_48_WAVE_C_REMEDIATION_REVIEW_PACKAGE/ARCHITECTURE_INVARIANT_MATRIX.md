# Architecture Invariant Matrix (Wave C Remediation)

| invariant/blocker | implementation file(s) | DB enforcement | production entry point | test ID(s) | result |
|---|---|---|---|---|---|
| B1 usedBy fail-closed | consume-inventory.handler.ts, inventory-usage-posting.service.ts | N/A (app) | POST /inventory/usage | C-INV-01, C-INV-03, C-INV-33 | PASS (Wave C packs) |
| B1 related UUID tenant isolation | inventory-usage-posting.service.ts assertRelatedTenantReferences | N/A (raw UUID columns) | POST /inventory/usage | wave-c-tenant-references | PASS |
| B2 inventory AuditEntry | audit-trail-inventory-audit-log.ts, posting service | audit_entries SoR | posting/reverse/correct/dispose | C-INV-25, C-INV-26, C-INJ-12 | PASS |
| B3 atomic correction | inventory-usage-posting.service.ts correctUsage | single $transaction | POST /inventory/usage/:id/correct | C-INV-30 | PASS |
| B4 atomic disposal | disposeBatch on posting service | single $transaction | POST /inventory/batch/:batchId/dispose | C-INV-31 | PASS |
| B5 platform forms RO | rls-policies.sql; clinical-form-version.service.ts | RLS deny platform mutation | clinical-forms version create/publish | C-CONSENT-19; wave-c-rls versions | PASS |
| B6 photo consent write path | media-category.vo.ts, media-asset.entity.ts | column persisted | POST /media/upload → MediaAsset.create | C-CONSENT-20 | PASS |
| B7 ledger append-only | triggers.sql + migration | BEFORE UPDATE/DELETE trigger | DB | C-INV-32, C-INV-24, billing production path | PASS |
| B8 injectable immutable + multi-batch | triggers.sql; posting allocateInjectableDoses | trigger + RLS | posting with injectable | C-INJ-02, C-INJ-02b | PASS |
| B9 routes = matrix | inventory.controller.ts; clinical-forms.controller.ts; three matrices; permission-routes validator | N/A | VOID + injectable usage | validator + permission-contract + HTTP | PASS |
| R5 B1 injectable RBAC | inventory.controller.ts; posting.validateInputs | N/A | POST /inventory/usage | HTTP assistant 403; C-INJ-RBAC | PASS |
| R5 B2 form refs / signatory | clinical-form-reference.validation.ts | N/A | createDraft / sign / upsert | wave-c-consent | PASS |
| R5 H4 form DTOs | clinical-forms.dto.ts | N/A | clinical-forms write routes | wave-c-clinical-forms-http | PASS |
| R5 H5 media patient tenant | upload-media.handler.ts | N/A | upload execute | wave-c-media-patient | PASS |
| B10 owner report dims + PHI | owner-report service; controller PHI derivation | N/A | GET /inventory/usage/owner-report | C-INV-27, C-INV-28, C-INV-36, HTTP PHI | PASS |
| B11 signed/void immutable | triggers.sql; patient-form-instance.service | trigger + void* columns | POST /clinical-forms/instances/:id/void | C-CONSENT-20 | PASS |
