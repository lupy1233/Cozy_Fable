-- E-admin-platform-25: sarbatori mobile RO 2025-2030 (Vinerea Mare, a doua zi de Paste, a doua zi de Rusalii)
-- in toate mediile, fara seed manual. Sursa: src/infra/calendar/movable-holidays.ts (verificat in teste).
-- Idempotent: ON CONFLICT (date) DO NOTHING nu suprascrie randurile editate din admin.
INSERT INTO "business_calendar_holidays" ("id", "date", "name", "is_working_day", "created_at") VALUES
  (gen_random_uuid()::text, DATE '2025-04-18', 'Vinerea Mare', false, now()),
  (gen_random_uuid()::text, DATE '2025-04-21', 'A doua zi de Paste', false, now()),
  (gen_random_uuid()::text, DATE '2025-06-09', 'A doua zi de Rusalii', false, now()),
  (gen_random_uuid()::text, DATE '2026-04-10', 'Vinerea Mare', false, now()),
  (gen_random_uuid()::text, DATE '2026-04-13', 'A doua zi de Paste', false, now()),
  (gen_random_uuid()::text, DATE '2026-06-01', 'A doua zi de Rusalii', false, now()),
  (gen_random_uuid()::text, DATE '2027-04-30', 'Vinerea Mare', false, now()),
  (gen_random_uuid()::text, DATE '2027-05-03', 'A doua zi de Paste', false, now()),
  (gen_random_uuid()::text, DATE '2027-06-21', 'A doua zi de Rusalii', false, now()),
  (gen_random_uuid()::text, DATE '2028-04-14', 'Vinerea Mare', false, now()),
  (gen_random_uuid()::text, DATE '2028-04-17', 'A doua zi de Paste', false, now()),
  (gen_random_uuid()::text, DATE '2028-06-05', 'A doua zi de Rusalii', false, now()),
  (gen_random_uuid()::text, DATE '2029-04-06', 'Vinerea Mare', false, now()),
  (gen_random_uuid()::text, DATE '2029-04-09', 'A doua zi de Paste', false, now()),
  (gen_random_uuid()::text, DATE '2029-05-28', 'A doua zi de Rusalii', false, now()),
  (gen_random_uuid()::text, DATE '2030-04-26', 'Vinerea Mare', false, now()),
  (gen_random_uuid()::text, DATE '2030-04-29', 'A doua zi de Paste', false, now()),
  (gen_random_uuid()::text, DATE '2030-06-17', 'A doua zi de Rusalii', false, now())
ON CONFLICT ("date") DO NOTHING;

-- Rollback: nu e necesar (codul vechi citeste randurile ca override-uri). Daca se cere:
-- DELETE FROM "business_calendar_holidays" WHERE "date" IN (DATE '2029-04-06', DATE '2029-04-09', DATE '2029-05-28', DATE '2030-04-26', DATE '2030-04-29', DATE '2030-06-17');
