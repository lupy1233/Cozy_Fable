-- b12 (etapa 7, problema 31): "Bloc, scara, apartament" intr-o coloana separata de strada.
-- Doar adaugare, nullable: ciornele si cererile vechi raman valide (NULL = nimic completat).
-- Rollback: ALTER TABLE "requests" DROP COLUMN "address_details";
ALTER TABLE "requests" ADD COLUMN "address_details" VARCHAR(100);
