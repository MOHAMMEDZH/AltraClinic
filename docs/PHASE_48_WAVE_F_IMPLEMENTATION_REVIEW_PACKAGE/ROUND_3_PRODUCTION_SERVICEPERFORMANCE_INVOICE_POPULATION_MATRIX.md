# ROUND_3_PRODUCTION_SERVICEPERFORMANCE_INVOICE_POPULATION_MATRIX
- Resolver: resolveAuthoritativeServicePerformanceForAppointment
- Domain: InvoiceLineItem.servicePerformanceId
- Writer: PrismaInvoiceRepository.save
- Appointment path: CreateInvoiceFromAppointmentHandler
- Later bind: InvoiceLinePerformanceAttributionService.bindInvoiceLine
- Immutability: invoice_line_items_service_performance_immutable
- Tests: R3-F3-T1..T7/T9
