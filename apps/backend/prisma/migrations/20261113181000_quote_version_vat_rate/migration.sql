-- Etapa 4, dupa revizuire (M1, 2026-11-14): cota de TVA inghetata pe varianta de oferta.
-- Scrisa la crearea fiecarei variante noi din system_settings.vat_rate; variantele existente raman
-- NULL (cititorii folosesc cota curenta ca rezerva). Strict aditiv, fara backfill.
-- Rollback: ALTER TABLE "quote_versions" DROP COLUMN "vat_rate_percent"; (codul vechi o ignora)

-- AlterTable
ALTER TABLE "quote_versions" ADD COLUMN "vat_rate_percent" DECIMAL(5,2);
