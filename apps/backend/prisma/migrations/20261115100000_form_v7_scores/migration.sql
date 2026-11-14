-- etapa 10 (formularul v7): randuri de scor pentru valorile noi ale formularului (DESIGN §7d).
-- 0 puncte (PO c9-3: restul raspunsurilor noi nu schimba costul; adminul le poate regla), cu exceptia
-- canapelei: locuri 2 / 3 / 4 = 0 / 1 / 2, sezlong 1, extensibila 2, lada 0 (d3 + c9-3; E10-N17, E10-N18).
-- "Fara corpuri suspendate" scade costul doar prin piesa care nu se mai creeaza (nu exista puncte negative).
-- Adminul poate doar edita randuri existente, deci le adaugam aici; o pondere deja pusa nu se suprascrie.
-- Cererile publicate si locurile preluate NU se recalculeaza (costul e inghetat la preluare).
-- Aceleasi randuri in prisma/seed.ts (o baza noua iese identica cu una migrata).
--
-- Rollback (doar daca versiunile noi de formular NU au fost comutate / nicio cerere nu le foloseste):
--   DELETE FROM "project_sizing_config" WHERE "key" IN (
--     'KITCHEN_WALL_CABINETS', 'KITCHEN_SINK_MOUNTING', 'KITCHEN_SINK_MATERIAL', 'KITCHEN_FRIDGE',
--     'BED_FABRIC', 'WARDROBE_INTERIOR', 'BATHROOM_BASIN_TYPE', 'BATHROOM_BASIN_SUPPLY',
--     'LAUNDRY_LOADING', 'HALLWAY_WIDTH', 'SOFA_SEATS', 'SOFA_LAYOUT', 'SOFA_SLEEPER', 'SOFA_STORAGE');
INSERT INTO "project_sizing_config" ("id", "key", "option", "weight") VALUES
  (gen_random_uuid()::text, 'KITCHEN_WALL_CABINETS', 'WALL_CABINETS', 0),
  (gen_random_uuid()::text, 'KITCHEN_WALL_CABINETS', 'NO_WALL_CABINETS', 0),
  (gen_random_uuid()::text, 'KITCHEN_WALL_CABINETS', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'KITCHEN_SINK_MOUNTING', 'INSET', 0),
  (gen_random_uuid()::text, 'KITCHEN_SINK_MOUNTING', 'UNDERMOUNT', 0),
  (gen_random_uuid()::text, 'KITCHEN_SINK_MOUNTING', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'KITCHEN_SINK_MATERIAL', 'STAINLESS', 0),
  (gen_random_uuid()::text, 'KITCHEN_SINK_MATERIAL', 'COMPOSITE', 0),
  (gen_random_uuid()::text, 'KITCHEN_SINK_MATERIAL', 'CERAMIC', 0),
  (gen_random_uuid()::text, 'KITCHEN_SINK_MATERIAL', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'KITCHEN_FRIDGE', 'BUILT_IN', 0),
  (gen_random_uuid()::text, 'KITCHEN_FRIDGE', 'FREESTANDING', 0),
  (gen_random_uuid()::text, 'KITCHEN_FRIDGE', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'BED_FABRIC', 'WOVEN', 0),
  (gen_random_uuid()::text, 'BED_FABRIC', 'BOUCLE', 0),
  (gen_random_uuid()::text, 'BED_FABRIC', 'VELVET', 0),
  (gen_random_uuid()::text, 'BED_FABRIC', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'WARDROBE_INTERIOR', 'HANGING_RODS', 0),
  (gen_random_uuid()::text, 'WARDROBE_INTERIOR', 'SHELVES', 0),
  (gen_random_uuid()::text, 'WARDROBE_INTERIOR', 'DRAWERS', 0),
  (gen_random_uuid()::text, 'WARDROBE_INTERIOR', 'SHOE_RACK', 0),
  (gen_random_uuid()::text, 'WARDROBE_INTERIOR', 'ACCESSORIES', 0),
  (gen_random_uuid()::text, 'WARDROBE_INTERIOR', 'LED_LIGHTING', 0),
  (gen_random_uuid()::text, 'WARDROBE_INTERIOR', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'BATHROOM_BASIN_TYPE', 'COUNTERTOP_BASIN', 0),
  (gen_random_uuid()::text, 'BATHROOM_BASIN_TYPE', 'INSET_BASIN', 0),
  (gen_random_uuid()::text, 'BATHROOM_BASIN_TYPE', 'INTEGRATED_BASIN', 0),
  (gen_random_uuid()::text, 'BATHROOM_BASIN_TYPE', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'BATHROOM_BASIN_SUPPLY', 'CLIENT', 0),
  (gen_random_uuid()::text, 'BATHROOM_BASIN_SUPPLY', 'FIRM', 0),
  (gen_random_uuid()::text, 'BATHROOM_BASIN_SUPPLY', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'LAUNDRY_LOADING', 'FRONT', 0),
  (gen_random_uuid()::text, 'LAUNDRY_LOADING', 'TOP', 0),
  (gen_random_uuid()::text, 'LAUNDRY_LOADING', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'HALLWAY_WIDTH', 'NARROW', 0),
  (gen_random_uuid()::text, 'HALLWAY_WIDTH', 'WIDE', 0),
  (gen_random_uuid()::text, 'HALLWAY_WIDTH', 'FIRM_DECIDES', 0),
  (gen_random_uuid()::text, 'SOFA_SEATS', 'SEATS_2', 0),
  (gen_random_uuid()::text, 'SOFA_SEATS', 'SEATS_3', 1),
  (gen_random_uuid()::text, 'SOFA_SEATS', 'SEATS_4', 2),
  (gen_random_uuid()::text, 'SOFA_LAYOUT', 'STRAIGHT', 0),
  (gen_random_uuid()::text, 'SOFA_LAYOUT', 'CHAISE_LEFT', 1),
  (gen_random_uuid()::text, 'SOFA_LAYOUT', 'CHAISE_RIGHT', 1),
  (gen_random_uuid()::text, 'SOFA_SLEEPER', 'YES', 2),
  (gen_random_uuid()::text, 'SOFA_STORAGE', 'YES', 0)
ON CONFLICT ("key", "option") DO NOTHING;
