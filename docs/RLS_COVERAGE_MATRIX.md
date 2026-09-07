# RLS Coverage Matrix

Generated: 2026-08-14T19:53:22.286Z

| Prisma model | PostgreSQL table | Ownership | RLS | Force | Select | Insert | Update | Delete | Test | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Tenant | tenants | global | no | no | - | - | - | - | integration |  |
| Branch | branches | direct | yes | yes | yes | yes | yes | yes | integration |  |
| Region | regions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| UserRegionAccess | user_region_access | direct | yes | yes | yes | yes | yes | yes | integration |  |
| Department | departments | direct | yes | yes | yes | yes | yes | yes | integration |  |
| UserBranchAccess | user_branch_access | direct | yes | yes | yes | yes | yes | yes | integration |  |
| CustomRole | custom_roles | direct | yes | yes | yes | yes | yes | yes | integration |  |
| UserCustomRole | user_custom_roles | direct | yes | yes | yes | yes | yes | yes | integration |  |
| UserSavedFilter | user_saved_filters | direct | yes | yes | yes | yes | yes | yes | integration |  |
| StaffWeeklySchedule | staff_weekly_schedules | direct | yes | yes | yes | yes | yes | yes | integration |  |
| User | users | direct | yes | yes | yes | yes | yes | yes | integration |  |
| UserRoleAssignment | user_role_assignments | indirect | yes | yes | yes | yes | yes | yes | integration |  |
| StaffInvitation | staff_invitations | direct | yes | yes | yes | yes | yes | yes | integration |  |
| UserDashboardLayout | user_dashboard_layouts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| RefreshToken | refresh_tokens | direct | yes | yes | yes | yes | yes | yes | integration |  |
| LoginAttempt | login_attempts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PlatformUser | platform_users | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformUserRole | platform_user_roles | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformUserInvitation | platform_user_invitations | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformMfaResetRequest | platform_mfa_reset_requests | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformRefreshToken | platform_refresh_tokens | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformMfaRecoveryCode | platform_mfa_recovery_codes | unscoped | no | no | - | - | - | - | integration | Review manually |
| PasswordResetToken | password_reset_tokens | direct | yes | yes | yes | yes | yes | yes | integration |  |
| EmailVerificationToken | email_verification_tokens | direct | yes | yes | yes | yes | yes | yes | integration |  |
| MfaBackupCode | mfa_backup_codes | direct | yes | yes | yes | yes | yes | yes | integration |  |
| TrustedDevice | trusted_devices | direct | yes | yes | yes | yes | yes | yes | integration |  |
| Patient | patients | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PatientAddress | patient_addresses | indirect | yes | yes | yes | yes | yes | yes | integration |  |
| Appointment | appointments | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AppointmentServiceSnapshotRevision | appointment_service_snapshot_revisions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ProviderServiceEligibility | provider_service_eligibilities | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AppointmentResourceAllocation | appointment_resource_allocations | direct | yes | yes | yes | yes | yes | yes | integration | BEFORE INSERT/UPDATE association integrity trigger (tenant match appointment+resource; branch-scoped resource requires appointment.branchId) |
| PortalSchedulingIdempotencyLedger | portal_scheduling_idempotency_ledger | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ServiceResourceRequirement | service_resource_requirements | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AppointmentWaitlist | appointment_waitlist | direct | yes | yes | yes | yes | yes | yes | integration |  |
| SchedulingResource | scheduling_resources | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AppointmentTemplate | appointment_templates | direct | yes | yes | yes | yes | yes | yes | integration |  |
| BranchOperatingHours | branch_operating_hours | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ProviderWeeklySchedule | provider_weekly_schedules | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AppointmentReminderLog | appointment_reminder_logs | direct | yes | yes | yes | yes | yes | yes | integration |  |
| Encounter | encounters | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PatientProblem | patient_problems | direct | yes | yes | yes | yes | yes | yes | integration |  |
| EncounterEvent | encounter_events | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ClinicalNoteTemplate | clinical_note_templates | direct | yes | yes | yes | yes | yes | yes | integration |  |
| LabResult | lab_results | direct | yes | yes | yes | yes | yes | yes | integration |  |
| DentalRecord | dental_records | direct | yes | yes | yes | yes | yes | yes | integration |  |
| OrthodonticCase | orthodontic_cases | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ImplantRecord | implant_records | direct | yes | yes | yes | yes | yes | yes | integration |  |
| DentalClinicalNote | dental_clinical_notes | direct | yes | yes | yes | yes | yes | yes | integration |  |
| DentalToothCondition | dental_tooth_conditions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| DentalProcedureMaterial | dental_procedure_materials | direct | yes | yes | yes | yes | yes | yes | integration |  |
| BeautyProcedureMaterial | beauty_procedure_materials | direct | yes | yes | yes | yes | yes | yes | integration |  |
| TreatmentPlan | treatment_plans | direct | yes | yes | yes | yes | yes | yes | integration |  |
| TreatmentPhase | treatment_phases | direct | yes | yes | yes | yes | yes | yes | integration |  |
| TreatmentPlanItem | treatment_plan_items | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PeriodontalExam | periodontal_exams | direct | yes | yes | yes | yes | yes | yes | integration |  |
| BeautyRecord | beauty_records | direct | yes | yes | yes | yes | yes | yes | integration |  |
| BeautyAnnotation | beauty_annotations | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryCategory | inventory_categories | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventorySupplier | inventory_suppliers | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryItem | inventory_items | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryConsumptionLog | inventory_consumption_logs | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryStockMovement | inventory_stock_movements | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryBatch | inventory_batches | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryDisposalLog | inventory_disposal_logs | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PurchaseOrder | purchase_orders | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PurchaseOrderLine | purchase_order_lines | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryWarehouse | inventory_warehouses | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryWarehouseStock | inventory_warehouse_stock | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryStockTransfer | inventory_stock_transfers | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryStockTransferLine | inventory_stock_transfer_lines | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryStockCount | inventory_stock_counts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryStockCountLine | inventory_stock_count_lines | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryStockRequest | inventory_stock_requests | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InventoryStockRequestLine | inventory_stock_request_lines | direct | yes | yes | yes | yes | yes | yes | integration |  |
| QueueTicket | queue_tickets | direct | yes | yes | yes | yes | yes | yes | integration |  |
| QueueTicketEvent | queue_ticket_events | direct | yes | yes | yes | yes | yes | yes | integration |  |
| Invoice | invoices | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InvoiceLineItem | invoice_line_items | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InvoicePayment | invoice_payments | direct | yes | yes | yes | yes | yes | yes | integration |  |
| TenantBillingSequence | tenant_billing_sequences | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InvoiceRefund | invoice_refunds | direct | yes | yes | yes | yes | yes | yes | integration |  |
| CreditNote | credit_notes | direct | yes | yes | yes | yes | yes | yes | integration |  |
| InvoiceWriteOff | invoice_write_offs | direct | yes | yes | yes | yes | yes | yes | integration |  |
| CashSession | cash_sessions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PaymentPlan | payment_plans | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PaymentPlanInstallment | payment_plan_installments | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ServicePrice | service_prices | direct | yes | yes | yes | yes | yes | yes | integration |  |
| CanonicalClinicalServiceDefinition | canonical_clinical_service_definitions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ClinicalServiceTranslation | clinical_service_translations | unscoped | no | no | - | - | - | - | integration | Review manually |
| ClinicalServiceAlias | clinical_service_aliases | unscoped | no | no | - | - | - | - | integration | Review manually |
| TenantServicePresentationOverride | tenant_service_presentation_overrides | direct | yes | yes | yes | yes | yes | yes | integration |  |
| TenantServiceConfiguration | tenant_service_configurations | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ClinicalServicePriceVersion | clinical_service_price_versions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| LegacyClinicalServiceMapping | legacy_clinical_service_mappings | direct | yes | yes | yes | yes | yes | yes | integration |  |
| LegacyClinicalPriceMapping | legacy_clinical_price_mappings | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PaymentReceipt | payment_receipts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| CommissionRule | commission_rules | direct | yes | yes | yes | yes | yes | yes | integration |  |
| CommissionCalculation | commission_calculations | direct | yes | yes | yes | yes | yes | yes | integration |  |
| CommissionLineItem | commission_line_items | direct | yes | yes | yes | yes | yes | yes | integration |  |
| LoyaltyAccount | loyalty_accounts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| LoyaltyTransaction | loyalty_transactions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| LoyaltyReward | loyalty_rewards | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ClinicSubscription | clinic_subscriptions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PlatformTenant | platform_tenants | direct | no | no | - | - | - | - | integration | Platform control plane — no tenant RLS |
| PrivilegedAccessGrant | privileged_access_grants | global | no | no | - | - | - | - | integration | Platform control plane — no tenant RLS |
| PlatformSubscription | platform_subscriptions | global | no | no | - | - | - | - | integration | Platform control plane — no tenant RLS |
| PortalAccount | portal_accounts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| CaregiverAccessGrant | caregiver_access_grants | unscoped | no | no | - | - | - | - | integration | Review manually |
| AnalyticsReportRecord | analytics_reports | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AnalyticsMetricRecord | analytics_metrics | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AnalyticsFilterPresetRecord | analytics_filter_presets | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AnalyticsLayoutRecord | analytics_layouts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AnalyticsDashboardRecord | analytics_dashboards | direct | yes | yes | yes | yes | yes | yes | integration |  |
| OperationalReportRecord | operational_reports | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ReportShareRecord | report_shares | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ReportFilterPresetRecord | report_filter_presets | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ReportCustomDefinitionRecord | report_custom_definitions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| Notification | notifications | direct | yes | yes | yes | yes | yes | yes | integration |  |
| UserDeviceToken | user_device_tokens | direct | yes | yes | yes | yes | yes | yes | integration |  |
| NotificationTemplate | notification_templates | direct | yes | yes | yes | yes | yes | yes | integration |  |
| NotificationTemplateVersion | notification_template_versions | indirect | yes | yes | yes | yes | yes | yes | integration |  |
| NotificationPreference | notification_preferences | direct | yes | yes | yes | yes | yes | yes | integration |  |
| NotificationAutomationRule | notification_automation_rules | direct | yes | yes | yes | yes | yes | yes | integration |  |
| TenantChannelConfig | tenant_channel_configs | direct | yes | yes | yes | yes | yes | yes | integration |  |
| NotificationSavedFilter | notification_saved_filters | direct | yes | yes | yes | yes | yes | yes | integration |  |
| NotificationIntent | notification_intents | direct | yes | yes | yes | yes | yes | yes | integration |  |
| NotificationMessage | notification_messages | direct | yes | yes | yes | yes | yes | yes | integration |  |
| DeliveryJob | notification_delivery_jobs | direct | yes | yes | yes | yes | yes | yes | integration |  |
| DeliveryAttempt | notification_delivery_attempts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| NotificationReceipt | notification_receipts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| NotificationDeadLetter | notification_dead_letters | direct | yes | yes | yes | yes | yes | yes | integration |  |
| NotificationConsentDecision | notification_consent_decisions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| NotificationPreferenceSnapshot | notification_preference_snapshots | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AuditEntry | audit_entries | direct | yes | yes | yes | yes | yes | yes | integration |  |
| LicenseAuditEvent | license_audit_events | direct | yes | yes | yes | yes | yes | yes | integration |  |
| TenantLicenseLifecycleState | tenant_license_lifecycle_states | direct | yes | yes | yes | yes | yes | yes | integration |  |
| LicenseLifecycleTransition | license_lifecycle_transitions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| CommunicationDispatchLedger | communication_dispatch_ledger | direct | yes | yes | yes | yes | yes | yes | integration |  |
| Workflow | workflows | direct | yes | yes | yes | yes | yes | yes | integration |  |
| WorkflowTemplate | workflow_templates | direct | yes | yes | yes | yes | yes | yes | integration |  |
| WorkflowTask | workflow_tasks | direct | yes | yes | yes | yes | yes | yes | integration |  |
| WorkflowApproval | workflow_approvals | direct | yes | yes | yes | yes | yes | yes | integration |  |
| WorkflowAutomationRule | workflow_automation_rules | direct | yes | yes | yes | yes | yes | yes | integration |  |
| WorkflowExecutionLog | workflow_execution_logs | direct | yes | yes | yes | yes | yes | yes | integration |  |
| WorkflowSavedFilter | workflow_saved_filters | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AiModel | ai_models | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AiConversation | ai_conversations | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AiMessage | ai_messages | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AiPrompt | ai_prompts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AiPromptVersion | ai_prompt_versions | indirect | yes | yes | yes | yes | yes | yes | integration |  |
| AiUsageDaily | ai_usage_daily | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AiUserSettings | ai_user_settings | direct | yes | yes | yes | yes | yes | yes | integration |  |
| AiTenantSettings | ai_tenant_settings | direct | yes | yes | yes | yes | yes | yes | integration |  |
| MediaAsset | media_assets | direct | yes | yes | yes | yes | yes | yes | integration |  |
| OutboxEvent | outbox_events | outbox | yes | yes | yes | yes | yes | yes | integration |  |
| ImportExportJob | import_export_jobs | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ImportExportDeadLetter | import_export_dead_letters | direct | yes | yes | yes | yes | yes | yes | integration |  |
| ImportExportArtifact | import_export_artifacts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| IntegrationServiceAccount | integration_service_accounts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| IntegrationApiCredential | integration_api_credentials | direct | yes | yes | yes | yes | yes | yes | integration |  |
| IntegrationProviderRecord | integration_providers | direct | yes | yes | yes | yes | yes | yes | integration |  |
| IntegrationWebhookSubscription | integration_webhook_subscriptions | direct | yes | yes | yes | yes | yes | yes | integration |  |
| IntegrationWebhookSecret | integration_webhook_secrets | direct | yes | yes | yes | yes | yes | yes | integration |  |
| IntegrationWebhookDelivery | integration_webhook_deliveries | direct | yes | yes | yes | yes | yes | yes | integration |  |
| IntegrationWebhookAttempt | integration_webhook_attempts | direct | yes | yes | yes | yes | yes | yes | integration |  |
| IntegrationQuotaPolicy | integration_quota_policies | direct | yes | yes | yes | yes | yes | yes | integration |  |
| IntegrationUsageCounter | integration_usage_counters | direct | yes | yes | yes | yes | yes | yes | integration |  |
| IntegrationGatewayStat | integration_gateway_stats | direct | yes | yes | yes | yes | yes | yes | integration |  |
| HealthcareCatalogItem | healthcare_catalog_items | unscoped | no | no | - | - | - | - | integration | Review manually |
| HealthcareCatalogTranslation | healthcare_catalog_translations | unscoped | no | no | - | - | - | - | integration | Review manually |
| HealthcareCatalogAlias | healthcare_catalog_aliases | unscoped | no | no | - | - | - | - | integration | Review manually |
| HealthcareCatalogCompatibilityRule | healthcare_catalog_compatibility_rules | unscoped | no | no | - | - | - | - | integration | Review manually |
| HealthcareCatalogIdempotencyRecord | healthcare_catalog_idempotency | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformPlan | platform_plans | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformPlanTranslation | platform_plan_translations | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformPlanAlias | platform_plan_aliases | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformPlanVersion | platform_plan_versions | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformPlanVersionEntitlement | platform_plan_version_entitlements | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformPlanVersionLimit | platform_plan_version_limits | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformPlanVersionTranslation | platform_plan_version_translations | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformPlanIdempotencyRecord | platform_plan_idempotency | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformAddOn | platform_addons | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformAddOnTranslation | platform_addon_translations | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformAddOnVersion | platform_addon_versions | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformAddOnVersionTranslation | platform_addon_version_translations | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformAddOnVersionEntitlement | platform_addon_version_entitlements | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformAddOnVersionLimitEffect | platform_addon_version_limit_effects | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformAddOnVersionApplicability | platform_addon_version_applicability | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformCommercialOverride | platform_commercial_overrides | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformCommercialOverrideEffect | platform_commercial_override_effects | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformCommercialIdempotencyRecord | platform_commercial_idempotency | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSubscriptionCommercialConfig | platform_subscription_commercial_configs | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSubscriptionAddOnAssignment | platform_subscription_addon_assignments | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSubscriptionOverrideAssignment | platform_subscription_override_assignments | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSubscriptionCommercialSnapshot | platform_subscription_commercial_snapshots | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSubscriptionCommercialChange | platform_subscription_commercial_changes | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSubscriptionCommercialIdempotencyRecord | platform_subscription_commercial_idempotency | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformUsageMeterDefinition | platform_usage_meter_definitions | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformUsageObservation | platform_usage_observations | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PlatformUsageCounter | platform_usage_counters | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PlatformUsageReconciliationCheckpoint | platform_usage_reconciliation_checkpoints | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PlatformUsageIdempotencyRecord | platform_usage_idempotency | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PlatformTenantProvisioningRequest | platform_tenant_provisioning_requests | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PlatformTenantProvisioningCheckpoint | platform_tenant_provisioning_checkpoints | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformTenantProvisioningOwnedResource | platform_tenant_provisioning_owned_resources | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformTenantProvisioningIdempotencyRecord | platform_tenant_provisioning_idempotency | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformTenantLifecycleRequest | platform_tenant_lifecycle_requests | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PlatformTenantLifecycleIdempotencyRecord | platform_tenant_lifecycle_idempotency | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformFeatureFlag | platform_feature_flags | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformFeatureFlagTarget | platform_feature_flag_targets | direct | yes | yes | yes | yes | yes | yes | integration |  |
| PlatformFeatureFlagHistory | platform_feature_flag_history | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformFeatureFlagIdempotencyRecord | platform_feature_flag_idempotency | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformGlobalSetting | platform_global_settings | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformGlobalSettingHistory | platform_global_setting_history | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformGlobalSettingIdempotencyRecord | platform_global_setting_idempotency | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformAuditExportRecord | platform_audit_export_records | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformAuditExportIdempotencyRecord | platform_audit_export_idempotency | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformOperationsIdempotencyRecord | platform_operations_idempotency | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSalesRepresentative | platform_sales_representatives | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSalesCustomerOwnership | platform_sales_customer_ownership | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSalesCustomerOwnershipHistory | platform_sales_customer_ownership_history | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSalesIdempotencyRecord | platform_sales_idempotency | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSalesLead | platform_sales_leads | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSalesLeadStageHistory | platform_sales_lead_stage_history | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSalesLeadOwnershipHistory | platform_sales_lead_ownership_history | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSalesLeadNote | platform_sales_lead_notes | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSalesTrial | platform_sales_trials | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSalesTrialExtensionHistory | platform_sales_trial_extension_history | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSalesTrialConversion | platform_sales_trial_conversions | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformSalesCommissionSnapshot | platform_sales_commission_snapshots | unscoped | no | no | - | - | - | - | integration | Review manually |
| PlatformNotificationPreference | platform_notification_preferences | unscoped | no | no | - | - | - | - | integration | Review manually |

## Deployment order

1. `npm run db:migrate:deploy`
2. `npm run db:triggers:apply`
3. `npm run db:rls:apply`
4. `npm run db:seed` (non-production only)
