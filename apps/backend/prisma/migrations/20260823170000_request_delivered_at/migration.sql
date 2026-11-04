-- Pasul 5 audit #2 (decizia PO 2026-08-23): auto-COMPLETED la 14 zile de la livrare.
-- delivered_at = momentul in care firma a marcat livrarea; sursa ceasului pentru workerul
-- delivery-autocomplete si pentru sweep-ul de reconciliere (aditiv, fara backfill —
-- cererile deja DELIVERED_BY_COMPANY intra in ciclu la urmatoarea marcare sau prin sweep
-- doar daca au delivered_at).
ALTER TABLE "requests" ADD COLUMN "delivered_at" TIMESTAMPTZ;
