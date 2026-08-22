# Round 4 Real Production Paths

A. CreateInvoiceFromAppointmentHandler → SP id → finalized invoice → accrual
B. correctionEventId reverse+repost atomic
C. COLLECTED payment → basis-aware refund reverse
D. package allocation → allocated share accrual
E. inventory usage/batch → owner report