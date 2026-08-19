-- L0-B (2026-08-19): status terminal pentru sloturile nealese la acceptarea unei oferte
-- (ACTIVE fara oferta → refund; OFFER_SENT pierzator → pay-to-play). Chat read-only imediat (4.14).
-- Izolat: ALTER TYPE ADD VALUE nu poate fi folosit in aceeasi tranzactie cu utilizarea valorii (PG16).
-- Rollback: valorile de enum nu se pot sterge in PG; valoarea ramane neutilizata.
ALTER TYPE "claim_slot_status" ADD VALUE 'CANCELLED_REQUEST_ACCEPTED';
