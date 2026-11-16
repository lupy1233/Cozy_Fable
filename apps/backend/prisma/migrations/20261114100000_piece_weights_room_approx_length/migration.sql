-- d3 (etapa 5, problema 21): costul in credite
-- 1) Lungimea aproximativa a camerei, doar cu "Am deja un proiect" (PO d3-2). Gol = "sub 2 m", ca azi.
ALTER TABLE "request_rooms" ADD COLUMN "approx_length_m" NUMERIC(5,2);

-- 2) Ponderile de tip pentru cele 7 piese noi (PO g0-10, provizorii). Adminul poate doar edita
-- randuri existente, deci le adaugam aici; o pondere deja pusa nu se suprascrie.
-- Cererile publicate si locurile preluate NU se recalculeaza (costul e inghetat la preluare).
INSERT INTO "project_sizing_config" ("id", "key", "option", "weight") VALUES
  (gen_random_uuid()::text, 'ROOM_TYPE', 'PIECE_SOFA', 3),
  (gen_random_uuid()::text, 'ROOM_TYPE', 'PIECE_SIDEBOARD', 2),
  (gen_random_uuid()::text, 'ROOM_TYPE', 'PIECE_BATHROOM_VANITY', 2),
  (gen_random_uuid()::text, 'ROOM_TYPE', 'PIECE_ENTRYWAY', 2),
  (gen_random_uuid()::text, 'ROOM_TYPE', 'PIECE_WALL_CABINET', 1),
  (gen_random_uuid()::text, 'ROOM_TYPE', 'PIECE_ARMCHAIR', 1),
  (gen_random_uuid()::text, 'ROOM_TYPE', 'PIECE_OTTOMAN', 1)
ON CONFLICT ("key", "option") DO NOTHING;
