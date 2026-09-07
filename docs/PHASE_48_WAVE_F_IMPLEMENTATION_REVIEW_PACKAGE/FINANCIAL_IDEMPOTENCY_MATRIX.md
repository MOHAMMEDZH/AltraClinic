# Financial Idempotency Matrix

| Key pattern | Purpose |
|-------------|---------|
| `earn:{performanceId}:{userId}:{invoiceLineId}` | unique earn post |
| `rev:{accrualId}:{refundId\|full}:{proportion}` | unique reverse |

Concurrent posts / retries → one durable row (savepoint + unique constraint).
