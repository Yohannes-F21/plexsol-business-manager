-- Phase 5: project agreed prices + subscription categories

-- CreateTable
CREATE TABLE "subscription_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscription_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_categories_slug_key" ON "subscription_categories"("slug");

-- AlterTable projects: agreed development price (independent of payment status)
ALTER TABLE "projects"
  ADD COLUMN "agreed_price" DECIMAL(19,4),
  ADD COLUMN "currency_code" CHAR(3) NOT NULL DEFAULT 'ETB';

UPDATE "projects"
SET "agreed_price" = 0
WHERE "agreed_price" IS NULL;

ALTER TABLE "projects"
  ALTER COLUMN "agreed_price" SET NOT NULL;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_agreed_price_positive"
  CHECK ("agreed_price" >= 0);

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_currency_code_fkey"
  FOREIGN KEY ("currency_code") REFERENCES "currencies"("code")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Move subscription.category_id from expense_categories to subscription_categories
ALTER TABLE "subscriptions"
  DROP CONSTRAINT IF EXISTS "subscriptions_category_id_fkey";

UPDATE "subscriptions"
SET "category_id" = NULL
WHERE "category_id" IS NOT NULL;

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "subscription_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
