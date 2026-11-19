-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingFrequency" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "MaintenanceAgreementStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "BillingCycleStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionBillingPeriod" AS ENUM ('MONTHLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('BANK_TRANSFER', 'CASH', 'CARD', 'MOBILE_MONEY', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'WARNING', 'ACTION_REQUIRED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ScheduledEventType" AS ENUM ('SUBSCRIPTION_REMINDER', 'MAINTENANCE_DUE_REMINDER', 'OVERDUE_PAYMENT_EMAIL');

-- CreateEnum
CREATE TYPE "ScheduledEventStatus" AS ENUM ('PENDING', 'AWAITING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailJobStatus" AS ENUM ('PENDING', 'AWAITING_APPROVAL', 'APPROVED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('SUCCESS', 'TEMPORARY_FAILURE', 'PERMANENT_FAILURE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'CORRECT', 'ALLOCATE', 'APPROVE', 'CANCEL');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "code" CHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimal_places" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_reporting" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "from_currency_code" CHAR(3) NOT NULL,
    "to_currency_code" CHAR(3) NOT NULL,
    "rate" DECIMAL(19,8) NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "source" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_agreements" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "billing_frequency" "BillingFrequency" NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" "MaintenanceAgreementStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "maintenance_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_billing_cycles" (
    "id" UUID NOT NULL,
    "maintenance_agreement_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "amount_allocated" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status" "BillingCycleStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "maintenance_billing_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_payments" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "amount_etb" DECIMAL(19,4) NOT NULL,
    "exchange_rate_id" UUID,
    "payment_method_id" UUID,
    "paid_at" TIMESTAMPTZ(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "amount_allocated" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "client_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "client_payment_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "project_id" UUID,
    "billing_cycle_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "category_id" UUID,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "billing_period" "SubscriptionBillingPeriod" NOT NULL,
    "start_date" DATE NOT NULL,
    "expiration_date" DATE NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "reminder_days_before" INTEGER[] DEFAULT ARRAY[30, 14, 7, 1]::INTEGER[],
    "url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_renewals" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "renewed_at" TIMESTAMPTZ(3) NOT NULL,
    "previous_expiration_date" DATE NOT NULL,
    "new_expiration_date" DATE NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "expense_id" UUID NOT NULL,
    "confirmed_by_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_renewals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "currency_code" CHAR(3) NOT NULL,
    "amount_etb" DECIMAL(19,4) NOT NULL,
    "exchange_rate_id" UUID,
    "description" TEXT NOT NULL,
    "incurred_at" TIMESTAMPTZ(3) NOT NULL,
    "payment_method_id" UUID,
    "is_subscription_renewal" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_events" (
    "id" UUID NOT NULL,
    "type" "ScheduledEventType" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "scheduled_for" TIMESTAMPTZ(3) NOT NULL,
    "status" "ScheduledEventStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "scheduled_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_jobs" (
    "id" UUID NOT NULL,
    "template_id" UUID,
    "scheduled_event_id" UUID,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT,
    "status" "EmailJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "email_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_delivery_attempts" (
    "id" UUID NOT NULL,
    "email_job_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL,
    "provider_response" TEXT,
    "error_message" TEXT,
    "attempted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "exchange_rates_to_currency_code_effective_at_idx" ON "exchange_rates"("to_currency_code", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_from_currency_code_to_currency_code_effectiv_key" ON "exchange_rates"("from_currency_code", "to_currency_code", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_name_key" ON "payment_methods"("name");

-- CreateIndex
CREATE INDEX "clients_name_idx" ON "clients"("name");

-- CreateIndex
CREATE INDEX "projects_client_id_idx" ON "projects"("client_id");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_agreements_project_id_key" ON "maintenance_agreements"("project_id");

-- CreateIndex
CREATE INDEX "maintenance_agreements_status_idx" ON "maintenance_agreements"("status");

-- CreateIndex
CREATE INDEX "maintenance_billing_cycles_maintenance_agreement_id_due_dat_idx" ON "maintenance_billing_cycles"("maintenance_agreement_id", "due_date");

-- CreateIndex
CREATE INDEX "maintenance_billing_cycles_status_due_date_idx" ON "maintenance_billing_cycles"("status", "due_date");

-- CreateIndex
CREATE INDEX "client_payments_client_id_paid_at_idx" ON "client_payments"("client_id", "paid_at");

-- CreateIndex
CREATE INDEX "payment_allocations_client_payment_id_idx" ON "payment_allocations"("client_payment_id");

-- CreateIndex
CREATE INDEX "payment_allocations_project_id_idx" ON "payment_allocations"("project_id");

-- CreateIndex
CREATE INDEX "payment_allocations_billing_cycle_id_idx" ON "payment_allocations"("billing_cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_slug_key" ON "expense_categories"("slug");

-- CreateIndex
CREATE INDEX "subscriptions_expiration_date_status_idx" ON "subscriptions"("expiration_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_renewals_expense_id_key" ON "subscription_renewals"("expense_id");

-- CreateIndex
CREATE INDEX "subscription_renewals_subscription_id_renewed_at_idx" ON "subscription_renewals"("subscription_id", "renewed_at");

-- CreateIndex
CREATE INDEX "expenses_incurred_at_idx" ON "expenses"("incurred_at");

-- CreateIndex
CREATE INDEX "expenses_category_id_idx" ON "expenses"("category_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "scheduled_events_status_scheduled_for_idx" ON "scheduled_events"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "scheduled_events_type_entity_id_idx" ON "scheduled_events"("type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_key_key" ON "email_templates"("key");

-- CreateIndex
CREATE INDEX "email_jobs_status_created_at_idx" ON "email_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "email_delivery_attempts_email_job_id_idx" ON "email_delivery_attempts"("email_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_delivery_attempts_email_job_id_attempt_number_key" ON "email_delivery_attempts"("email_job_id", "attempt_number");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_from_currency_code_fkey" FOREIGN KEY ("from_currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_to_currency_code_fkey" FOREIGN KEY ("to_currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_agreements" ADD CONSTRAINT "maintenance_agreements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_agreements" ADD CONSTRAINT "maintenance_agreements_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_billing_cycles" ADD CONSTRAINT "maintenance_billing_cycles_maintenance_agreement_id_fkey" FOREIGN KEY ("maintenance_agreement_id") REFERENCES "maintenance_agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_billing_cycles" ADD CONSTRAINT "maintenance_billing_cycles_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_exchange_rate_id_fkey" FOREIGN KEY ("exchange_rate_id") REFERENCES "exchange_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_payments" ADD CONSTRAINT "client_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_client_payment_id_fkey" FOREIGN KEY ("client_payment_id") REFERENCES "client_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_billing_cycle_id_fkey" FOREIGN KEY ("billing_cycle_id") REFERENCES "maintenance_billing_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_renewals" ADD CONSTRAINT "subscription_renewals_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_renewals" ADD CONSTRAINT "subscription_renewals_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_renewals" ADD CONSTRAINT "subscription_renewals_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_renewals" ADD CONSTRAINT "subscription_renewals_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_exchange_rate_id_fkey" FOREIGN KEY ("exchange_rate_id") REFERENCES "exchange_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_events" ADD CONSTRAINT "scheduled_events_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_jobs" ADD CONSTRAINT "email_jobs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_jobs" ADD CONSTRAINT "email_jobs_scheduled_event_id_fkey" FOREIGN KEY ("scheduled_event_id") REFERENCES "scheduled_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_jobs" ADD CONSTRAINT "email_jobs_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_delivery_attempts" ADD CONSTRAINT "email_delivery_attempts_email_job_id_fkey" FOREIGN KEY ("email_job_id") REFERENCES "email_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- Plexsol financial / domain invariants (PostgreSQL constraints & triggers)
-- =============================================================================

-- Positive money amounts
ALTER TABLE "maintenance_agreements"
  ADD CONSTRAINT "maintenance_agreements_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "maintenance_billing_cycles"
  ADD CONSTRAINT "maintenance_billing_cycles_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "maintenance_billing_cycles"
  ADD CONSTRAINT "maintenance_billing_cycles_allocated_non_negative"
  CHECK ("amount_allocated" >= 0);

ALTER TABLE "maintenance_billing_cycles"
  ADD CONSTRAINT "maintenance_billing_cycles_allocated_not_over"
  CHECK ("amount_allocated" <= "amount");

ALTER TABLE "maintenance_billing_cycles"
  ADD CONSTRAINT "maintenance_billing_cycles_period_valid"
  CHECK ("period_end" >= "period_start");

ALTER TABLE "client_payments"
  ADD CONSTRAINT "client_payments_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "client_payments"
  ADD CONSTRAINT "client_payments_amount_etb_non_negative"
  CHECK ("amount_etb" >= 0);

ALTER TABLE "client_payments"
  ADD CONSTRAINT "client_payments_allocated_non_negative"
  CHECK ("amount_allocated" >= 0);

ALTER TABLE "client_payments"
  ADD CONSTRAINT "client_payments_allocated_not_over"
  CHECK ("amount_allocated" <= "amount");

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_amount_positive"
  CHECK ("amount" > 0);

-- Exactly one allocation target: project XOR billing cycle
ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_exactly_one_target"
  CHECK (
    (("project_id" IS NOT NULL)::int + ("billing_cycle_id" IS NOT NULL)::int) = 1
  );

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "subscription_renewals"
  ADD CONSTRAINT "subscription_renewals_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_amount_etb_non_negative"
  CHECK ("amount_etb" >= 0);

ALTER TABLE "exchange_rates"
  ADD CONSTRAINT "exchange_rates_rate_positive"
  CHECK ("rate" > 0);

ALTER TABLE "exchange_rates"
  ADD CONSTRAINT "exchange_rates_distinct_currencies"
  CHECK ("from_currency_code" <> "to_currency_code");

ALTER TABLE "email_jobs"
  ADD CONSTRAINT "email_jobs_max_attempts_positive"
  CHECK ("max_attempts" > 0);

ALTER TABLE "email_jobs"
  ADD CONSTRAINT "email_jobs_attempt_count_bounds"
  CHECK ("attempt_count" >= 0 AND "attempt_count" <= "max_attempts");

ALTER TABLE "email_delivery_attempts"
  ADD CONSTRAINT "email_delivery_attempts_number_positive"
  CHECK ("attempt_number" > 0);

-- Exactly one reporting currency (ETB expected by application seed)
CREATE UNIQUE INDEX "currencies_one_reporting_idx"
  ON "currencies" (("is_reporting"))
  WHERE "is_reporting" = true;

-- ---------------------------------------------------------------------------
-- Allocation ownership + over-allocation triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION plexsol_refresh_payment_allocated(p_payment_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE "client_payments" cp
  SET "amount_allocated" = COALESCE((
    SELECT SUM(pa."amount") FROM "payment_allocations" pa
    WHERE pa."client_payment_id" = p_payment_id
  ), 0)
  WHERE cp."id" = p_payment_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION plexsol_refresh_cycle_allocated(p_cycle_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_cycle_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE "maintenance_billing_cycles" bc
  SET
    "amount_allocated" = COALESCE((
      SELECT SUM(pa."amount") FROM "payment_allocations" pa
      WHERE pa."billing_cycle_id" = p_cycle_id
    ), 0),
    "status" = CASE
      WHEN COALESCE((
        SELECT SUM(pa."amount") FROM "payment_allocations" pa
        WHERE pa."billing_cycle_id" = p_cycle_id
      ), 0) <= 0 THEN
        CASE WHEN bc."status" = 'CANCELLED' THEN bc."status"::"BillingCycleStatus"
             WHEN bc."due_date" < CURRENT_DATE THEN 'OVERDUE'::"BillingCycleStatus"
             ELSE 'PENDING'::"BillingCycleStatus" END
      WHEN COALESCE((
        SELECT SUM(pa."amount") FROM "payment_allocations" pa
        WHERE pa."billing_cycle_id" = p_cycle_id
      ), 0) >= bc."amount" THEN 'PAID'::"BillingCycleStatus"
      ELSE 'PARTIALLY_PAID'::"BillingCycleStatus"
    END
  WHERE bc."id" = p_cycle_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION plexsol_payment_allocation_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_client UUID;
  v_payment_amount NUMERIC(19,4);
  v_payment_currency CHAR(3);
  v_target_client UUID;
  v_cycle_amount NUMERIC(19,4);
  v_cycle_currency CHAR(3);
  v_sum_payment NUMERIC(19,4);
  v_sum_cycle NUMERIC(19,4);
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM plexsol_refresh_payment_allocated(OLD."client_payment_id");
    PERFORM plexsol_refresh_cycle_allocated(OLD."billing_cycle_id");
    RETURN OLD;
  END IF;

  SELECT cp."client_id", cp."amount", cp."currency_code"
  INTO v_payment_client, v_payment_amount, v_payment_currency
  FROM "client_payments" cp
  WHERE cp."id" = NEW."client_payment_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_allocations: client payment % not found', NEW."client_payment_id";
  END IF;

  IF NEW."project_id" IS NOT NULL THEN
    SELECT p."client_id" INTO v_target_client
    FROM "projects" p
    WHERE p."id" = NEW."project_id"
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'payment_allocations: project % not found', NEW."project_id";
    END IF;

    IF v_target_client <> v_payment_client THEN
      RAISE EXCEPTION 'payment_allocations: payment client does not own project %', NEW."project_id"
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW."billing_cycle_id" IS NOT NULL THEN
    SELECT p."client_id", bc."amount", bc."currency_code"
    INTO v_target_client, v_cycle_amount, v_cycle_currency
    FROM "maintenance_billing_cycles" bc
    JOIN "maintenance_agreements" ma ON ma."id" = bc."maintenance_agreement_id"
    JOIN "projects" p ON p."id" = ma."project_id"
    WHERE bc."id" = NEW."billing_cycle_id"
    FOR UPDATE OF bc;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'payment_allocations: billing cycle % not found', NEW."billing_cycle_id";
    END IF;

    IF v_target_client <> v_payment_client THEN
      RAISE EXCEPTION 'payment_allocations: payment client does not own billing cycle %', NEW."billing_cycle_id"
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_cycle_currency <> v_payment_currency THEN
      RAISE EXCEPTION 'payment_allocations: currency mismatch between payment (%) and billing cycle (%)',
        v_payment_currency, v_cycle_currency
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Exclude the current row (already visible in AFTER triggers), then add NEW.amount.
  SELECT COALESCE(SUM(pa."amount"), 0) INTO v_sum_payment
  FROM "payment_allocations" pa
  WHERE pa."client_payment_id" = NEW."client_payment_id"
    AND pa."id" <> NEW."id";

  IF v_sum_payment + NEW."amount" > v_payment_amount THEN
    RAISE EXCEPTION 'payment_allocations: over-allocation on payment % (allocated %, payment %)',
      NEW."client_payment_id", v_sum_payment + NEW."amount", v_payment_amount
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."billing_cycle_id" IS NOT NULL THEN
    SELECT COALESCE(SUM(pa."amount"), 0) INTO v_sum_cycle
    FROM "payment_allocations" pa
    WHERE pa."billing_cycle_id" = NEW."billing_cycle_id"
      AND pa."id" <> NEW."id";

    IF v_sum_cycle + NEW."amount" > v_cycle_amount THEN
      RAISE EXCEPTION 'payment_allocations: over-allocation on billing cycle % (allocated %, cycle %)',
        NEW."billing_cycle_id", v_sum_cycle + NEW."amount", v_cycle_amount
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM plexsol_refresh_payment_allocated(OLD."client_payment_id");
    PERFORM plexsol_refresh_cycle_allocated(OLD."billing_cycle_id");
  END IF;

  PERFORM plexsol_refresh_payment_allocated(NEW."client_payment_id");
  PERFORM plexsol_refresh_cycle_allocated(NEW."billing_cycle_id");

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_allocations_guard_aiud
AFTER INSERT OR UPDATE OR DELETE ON "payment_allocations"
FOR EACH ROW
EXECUTE FUNCTION plexsol_payment_allocation_guard();
