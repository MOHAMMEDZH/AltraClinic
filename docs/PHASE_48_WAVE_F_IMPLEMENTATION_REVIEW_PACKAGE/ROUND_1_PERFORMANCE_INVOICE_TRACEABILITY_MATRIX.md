# ROUND_1_TRACEABILITY_MATRIX

| Check | Fail-closed |
|-------|-------------|
| `performance.patientId` set ⇒ equals `invoice.patientId` | Yes |
| Both branchIds set ⇒ equal | Yes |
| Durable link | `encounterId` match **or** `line.serviceCode` = last segment of clinical `stableKey` |
| Neither link possible | Reject; zero accrual writes |

Called before every accrual create (invoice path + collected path).
