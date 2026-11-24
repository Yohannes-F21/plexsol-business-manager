-- Phase 7: worker leases, idempotency, execution logs, reminder defaults

ALTER TABLE "subscriptions"
  ALTER COLUMN "reminder_days_before" SET DEFAULT ARRAY[30, 7, 3, 1, 0]::INTEGER[];

ALTER TABLE "scheduled_events"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "claimed_by" TEXT,
  ADD COLUMN "claimed_at" TIMESTAMPTZ(3),
  ADD COLUMN "lease_expires_at" TIMESTAMPTZ(3),
  ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "max_attempts" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "last_error" TEXT;

CREATE UNIQUE INDEX "scheduled_events_idempotency_key_key"
  ON "scheduled_events"("idempotency_key");

CREATE INDEX "scheduled_events_lease_expires_at_idx"
  ON "scheduled_events"("lease_expires_at");

ALTER TABLE "email_jobs"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "claimed_by" TEXT,
  ADD COLUMN "claimed_at" TIMESTAMPTZ(3),
  ADD COLUMN "lease_expires_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "email_jobs_idempotency_key_key"
  ON "email_jobs"("idempotency_key");

CREATE INDEX "email_jobs_lease_expires_at_idx"
  ON "email_jobs"("lease_expires_at");

CREATE TABLE "job_execution_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "worker_id" TEXT NOT NULL,
  "job_kind" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "message" TEXT,
  "detail" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_execution_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "job_execution_logs_job_kind_job_id_created_at_idx"
  ON "job_execution_logs"("job_kind", "job_id", "created_at");

CREATE INDEX "job_execution_logs_created_at_idx"
  ON "job_execution_logs"("created_at");
