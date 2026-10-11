-- E-admin-platform-15: CHECK-urile balance >= 0 / reserved >= 0 (20260823150000, NOT VALID)
-- devin VALIDATE — acopera si randurile vechi.
-- OPS1-23: prod ruleaza cu RUN_MIGRATIONS=false; migrarile revizuite se aplica o data, dupa
-- backup. La 2026-09-16 prod nu avea randuri negative.
-- Pre-verificare (trebuie 0, altfel VALIDATE esueaza):
--   SELECT count(*) FROM company_credit_wallets WHERE balance < 0 OR reserved < 0;
ALTER TABLE "company_credit_wallets" VALIDATE CONSTRAINT "company_credit_wallets_balance_nonneg";
ALTER TABLE "company_credit_wallets" VALIDATE CONSTRAINT "company_credit_wallets_reserved_nonneg";

-- Rollback: nimic de facut (VALIDATE nu schimba date; lock SHARE UPDATE EXCLUSIVE).
