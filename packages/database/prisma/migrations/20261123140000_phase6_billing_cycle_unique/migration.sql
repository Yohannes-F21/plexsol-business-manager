-- Phase 6: idempotent billing-cycle generation
CREATE UNIQUE INDEX "maintenance_billing_cycles_maintenance_agreement_id_period_start_key"
ON "maintenance_billing_cycles"("maintenance_agreement_id", "period_start");
