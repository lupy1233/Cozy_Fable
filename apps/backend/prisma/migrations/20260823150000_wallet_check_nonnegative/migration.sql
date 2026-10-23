-- Plasa de siguranta anti dubla-decontare (audit 2026-08-23): portofelul de credite nu
-- poate deveni negativ. Toata apararea logica e in cod (biletul de decontare = updateMany
-- conditionat); CHECK-urile transforma orice regresie viitoare din frauda tacuta in
-- eroare 500 vizibila.
-- NOT VALID: migrarile se aplica la boot pe prod — nu validam randurile istorice (un rand
-- negativ mostenit nu ar bloca pornirea), dar orice scriere noua sub zero e respinsa.
ALTER TABLE "company_credit_wallets"
  ADD CONSTRAINT "company_credit_wallets_balance_nonneg" CHECK ("balance" >= 0) NOT VALID;
ALTER TABLE "company_credit_wallets"
  ADD CONSTRAINT "company_credit_wallets_reserved_nonneg" CHECK ("reserved" >= 0) NOT VALID;
