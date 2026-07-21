-- AlterTable: add cash balance columns to companies
ALTER TABLE "companies" ADD COLUMN "cash_balance_usd" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN "cash_balance_bs" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Backfill balance for existing companies based on completed transactions
UPDATE "companies" SET
  "cash_balance_usd" = COALESCE((
    SELECT SUM(CASE WHEN c.flow_direction = 'INFLOW' THEN t.amount_usd ELSE -t.amount_usd END)
    FROM "transactions" t
    INNER JOIN "categories" c ON c.id = t.category_id
    WHERE t.company_id = companies.id AND t.is_removed = false AND t.status = 'COMPLETED'
  ), 0),
  "cash_balance_bs" = COALESCE((
    SELECT SUM(CASE WHEN c.flow_direction = 'INFLOW' THEN t.amount_bs ELSE -t.amount_bs END)
    FROM "transactions" t
    INNER JOIN "categories" c ON c.id = t.category_id
    WHERE t.company_id = companies.id AND t.is_removed = false AND t.status = 'COMPLETED'
  ), 0);
