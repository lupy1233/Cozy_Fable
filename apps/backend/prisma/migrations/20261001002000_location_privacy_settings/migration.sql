-- E-client-9 (confidentialitate pre-claim): migrare DOAR de date, fara schimbare de schema.
-- marketplace_distance_display: KM (km intregi din punctul aproximat) | BAND (doar banda de distanta)
-- company_locations_max: plafonul de locatii per firma
-- company_location_changes_per_day: schimbari de locatii (adaugare/editare/stergere) pe 24h rolling
-- Valori implicite = DECIZIE NECESARA PO (modificabile din Admin -> Setari).
INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES
  ('marketplace_distance_display', 'KM', now()),
  ('company_locations_max', '10', now()),
  ('company_location_changes_per_day', '20', now())
ON CONFLICT ("key") DO NOTHING;

-- Rollback: redeploy imaginea anterioara; apoi DELETE FROM "system_settings" WHERE "key" IN ('marketplace_distance_display', 'company_locations_max', 'company_location_changes_per_day');
