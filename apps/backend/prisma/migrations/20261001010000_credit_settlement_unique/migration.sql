-- E-admin-platform-15: plasa DB a biletului de decontare: max un RESERVE si max o decontare
-- (REFUND/CONSUME) per slot. Calea de cod unica = ClaimSettlementService.settle().
-- Pre-verificare pe prod (trebuie 0 randuri, altfel indexul nu se construieste):
--   SELECT claim_slot_id, count(*) FROM credit_transactions WHERE type IN ('REFUND','CONSUME') AND claim_slot_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
--   SELECT claim_slot_id, count(*) FROM credit_transactions WHERE type = 'RESERVE' AND claim_slot_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
-- Indexurile traiesc DOAR in SQL (Prisma nu modeleaza indexuri partiale) — un reset din
-- schema le pierde (IMPACT schema Prisma).
CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_one_reserve_per_slot"
  ON "credit_transactions" ("claim_slot_id")
  WHERE "type" = 'RESERVE' AND "claim_slot_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "credit_transactions_one_settlement_per_slot"
  ON "credit_transactions" ("claim_slot_id")
  WHERE "type" IN ('REFUND', 'CONSUME') AND "claim_slot_id" IS NOT NULL;

-- Rollback (aditiv, compatibil cu slotul vechi):
--   DROP INDEX IF EXISTS "credit_transactions_one_settlement_per_slot";
--   DROP INDEX IF EXISTS "credit_transactions_one_reserve_per_slot";
