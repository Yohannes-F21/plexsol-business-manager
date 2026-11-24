-- DEF-FS-05: email retry backoff via next_attempt_at
ALTER TABLE "email_jobs"
  ADD COLUMN "next_attempt_at" TIMESTAMPTZ(3);

CREATE INDEX "email_jobs_status_next_attempt_at_idx"
  ON "email_jobs"("status", "next_attempt_at");
