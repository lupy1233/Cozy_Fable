-- E-company-24: plata prin transfer bancar (marcaj "Am platit", reminder) + email de facturare al firmei + marcaj copie contabil pe outbox. Strict aditiva.
ALTER TABLE "mock_billing_orders" ADD COLUMN "payment_claimed_at" TIMESTAMPTZ NULL;
ALTER TABLE "mock_billing_orders" ADD COLUMN "transfer_reminder_sent_at" TIMESTAMPTZ NULL;
ALTER TABLE "companies" ADD COLUMN "billing_email" VARCHAR(254) NULL;
ALTER TABLE "domain_event_outbox" ADD COLUMN "billing_contact_emailed_at" TIMESTAMPTZ NULL;
-- DECIZIE NECESARA PO: zilele pana la reminder / anulare automata; 0 = oprit
INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES ('bank_transfer_reminder_days', '0', now()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES ('bank_transfer_expiry_days', '0', now()) ON CONFLICT ("key") DO NOTHING;
-- Rollback: redeploy imaginea anterioara (coloanele noi sunt ignorate de ea); abia apoi, intr-un release separat:
-- DELETE FROM "system_settings" WHERE "key" IN ('bank_transfer_reminder_days','bank_transfer_expiry_days');
-- ALTER TABLE "domain_event_outbox" DROP COLUMN "billing_contact_emailed_at";
-- ALTER TABLE "companies" DROP COLUMN "billing_email";
-- ALTER TABLE "mock_billing_orders" DROP COLUMN "transfer_reminder_sent_at";
-- ALTER TABLE "mock_billing_orders" DROP COLUMN "payment_claimed_at";
