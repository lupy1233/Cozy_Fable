-- b8 (plan reparatii 2026-11-13, etapa 2; PO g0-8): ajutorul de proiectare se cere pe camera.
-- request_rooms.needs_design_help = clientul cere ajutor la camera asta; camera pleaca la firme
-- doar cu tipul, schitele si mesajul. requests.includes_paid_design devine derivat pe server
-- (true daca macar o camera are needs_design_help).
-- Strict aditiv (compatibil blue/green): o coloana NOT NULL cu DEFAULT; imaginea veche o ignora.

ALTER TABLE "request_rooms" ADD COLUMN "needs_design_help" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: azi o cerere publicata in modul "Am nevoie de ajutor" are includes_paid_design = true
-- si camere fara raspunsuri (answers = {} — interfata trimite doar tipul camerei); interfata
-- deduce modul exact asa (paid design + nicio camera cu chei in answers). Camerele legacy
-- (answers NULL, flow_version NULL — formularul vechi, cu articole scrise de client) NU se
-- bifeaza: firma ar vedea "cere ajutor" langa articole. Pe camera: o camera dintr-o cerere cu proiectare
-- care nu are niciun raspuns la chestionar (doar, eventual, fisiere: pasii de tip upload
-- 'sketch' / 'snapshot3d') era deja trimisa ca brief fara raspunsuri → primeste true.
UPDATE "request_rooms" rr
SET "needs_design_help" = true
FROM "requests" r
WHERE rr."request_id" = r."id"
  AND r."includes_paid_design" = true
  -- doar camerele din configurator; cele din formularul vechi (flow_version NULL) raman nebifate
  AND rr."flow_version" IS NOT NULL
  AND (
    jsonb_typeof(rr."answers") = 'null'
    OR (jsonb_typeof(rr."answers") = 'object' AND (rr."answers" - 'sketch' - 'snapshot3d') = '{}'::jsonb)
  );

-- Rollback:
-- 1. redeploy imaginea anterioara a aplicatiei (ea citeste includes_paid_design ca bifa pe cerere,
--    valoare care ramane corecta: serverul nou o scrie derivata din camere);
-- 2. ALTER TABLE "request_rooms" DROP COLUMN "needs_design_help";
