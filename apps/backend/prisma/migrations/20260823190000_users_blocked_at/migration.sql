-- Pasul 6 audit #2 (D-L1-2, PO 2026-08-23): blocarea contului de catre admin.
-- blocked_at setat → login/refresh/me refuza cu ACCOUNT_BLOCKED, sesiunile se revoca;
-- unblock → NULL (reversibil). Aditiv, fara backfill.
ALTER TABLE "users" ADD COLUMN "blocked_at" TIMESTAMPTZ;
