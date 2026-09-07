# Workforce Commercial Rule Matrix

| Rule | Behavior | Evidence |
|------|----------|----------|
| commissionEnabled=false | no automatic / post accrual for user | wave-f-workforce |
| DRAFT plan | not used for resolve | plan service |
| Publish ACTIVE | supersedes prior user-default ACTIVE | plan service |
| ACTIVE immutable rates | DB trigger | migration |
| Percentage 0–100 | CHECK + DTO | schema/DTO |
| Default basis | SERVICE_NET_AFTER_DISCOUNT | schema default |
| Default trigger | INVOICE_OR_CHARGE_FINALIZED | schema default |
