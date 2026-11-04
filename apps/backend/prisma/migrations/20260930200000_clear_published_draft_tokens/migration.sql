-- E-client-3 (SEC2-4): tokenul de draft deschide doar o CIORNA. Hash-urile ramase pe
-- cereri publicate/terminale sau pe ciorne sterse devin NULL. Doar date, schema neschimbata.
-- Rollback: nimic de facut; imaginea anterioara citeste NULL (rutele cu token dau 404,
-- inclusiv vechiul repost pe token). Hash-urile nu se pot reface (sha256 one-way).
UPDATE "requests" SET "draft_token_hash" = NULL
WHERE "draft_token_hash" IS NOT NULL AND ("status" <> 'DRAFT' OR "deleted_at" IS NOT NULL);
