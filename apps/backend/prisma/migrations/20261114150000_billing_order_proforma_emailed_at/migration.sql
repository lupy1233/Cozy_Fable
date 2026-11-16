-- g4 (etapa 7, problema 37): momentul in care primul e-mail cu proforma ATASATA a plecat.
-- Doar adaugare, nullable: comenzile vechi raman cu NULL → pagina nu promite proforma pe e-mail.
-- Rollback: ALTER TABLE "mock_billing_orders" DROP COLUMN "proforma_emailed_at";
ALTER TABLE "mock_billing_orders" ADD COLUMN "proforma_emailed_at" TIMESTAMPTZ;
