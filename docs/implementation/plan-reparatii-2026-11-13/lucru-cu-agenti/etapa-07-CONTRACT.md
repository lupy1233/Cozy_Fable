# Etapa 7 — contractul dintre agenți (obligatoriu pentru toți agenții etapei)

Șase agenți lucrează în paralel în aceeași copie de lucru (`E:\Cozy Fable`, ramura `claude/reparatii-etapa-07`). Fiecare își citește secțiunea din `docs/implementation/plan-reparatii-2026-11-13/etapa-07.md` (pași, „Unde în cod”, „Cum se verifică”, „Întrebări și răspunsuri” — răspunsurile PO sunt hotărâri finale). Dacă un punct de aici ți se pare greșit: respectă-l cât poți și scrie la „DECIZIE NECESARĂ”.

## Cine ce face

| Agent | Probleme | Zona lui (fișierele „ale lui”) |
|---|---|---|
| `e7-msg` | 30 (`a7`) mesaje la preluare și la retragerea ofertei + 37 (`g4`) documentele PDF | `apps/backend/src/modules/claims/claims.service.ts`, `apps/backend/src/modules/billing/billing-documents.service.ts`, `apps/backend/src/modules/quotes/quote-pdf.service.ts`, `quotes.controller.ts`, `Dockerfile.app`, `apps/frontend/src/app/[locale]/_components/offer-card.tsx`, `apps/frontend/src/app/[locale]/marketplace/[id]/page.tsx` |
| `e7-addr` | 31 (`b12`) adresa | `apps/frontend/src/components/configurator/address-autocomplete.tsx`, `details-step.tsx`, câmpurile de adresă din schema Prisma / shared / DTO-uri, migrarea lui |
| `e7-view` | 32 (`d5`) clientul își vede tot ce a completat + 34 (`e4`) ștergerea cererii și retragerea firmei | `apps/frontend/src/app/[locale]/requests/[id]/page.tsx`, `apps/frontend/src/components/configurator/review-facts-card.tsx`, `apps/backend/src/modules/requests/requests.service.ts`, `apps/backend/src/modules/claims/withdrawals.service.ts` |
| `e7-3d` | 33 (`d4`) imaginea 3D în Sumar | `apps/frontend/src/components/configurator/piece3d/configurator3d-step.tsx`, `review-room-card.tsx`, `review-step.tsx`, `apps/frontend/src/stores/configurator-store.ts` |
| `e7-links` | 35 (`f4`) linkurile din e-mail fără sesiune | gărzile și întoarcerea după login: `apps/frontend/src/lib/use-login-redirect.ts`, `lib/session-lost*.ts(x)`, `lib/safe-redirect.ts`, paginile de autentificare, `apps/frontend/src/app/[locale]/dashboard/page.tsx`, `requests/[id]/offers/page.tsx`, `marketplace/claims/[claimSlotId]/page.tsx` |
| `e7-chat` | 36 (`g3`) conversația nu arată erori | `apps/backend/src/modules/chat/**`, `apps/frontend/src/app/[locale]/_components/chat-panel.tsx` |

Fișiere COMUNE în etapa asta (pe lângă cele din ghid): doar Edit punctual, doar ca să ADAUGI rândurile problemei tale, citind fișierul chiar înainte de Edit; nu reformatezi, nu reordonezi:
- `apps/frontend/src/app/[locale]/requests/[id]/page.tsx` — al lui `e7-view`; `e7-addr` (afișarea adresei) și `e7-links` (tratarea 401 / întoarcerea) doar adaugă;
- `apps/frontend/src/components/configurator/review-facts-card.tsx` — al lui `e7-view`; `e7-addr` doar adaugă rândurile adresei;
- `apps/frontend/src/app/[locale]/marketplace/[id]/page.tsx` — al lui `e7-msg`; `e7-links` doar adaugă;
- `apps/backend/src/modules/requests/requests.service.ts` — al lui `e7-view`; `e7-addr` doar adaugă câmpurile adresei unde se scriu / citesc;
- `apps/backend/prisma/schema.prisma`, `packages/shared/src/request.schemas.ts`, `packages/shared/src/error-codes.ts`, `packages/shared/src/enums.ts`, `packages/shared/src/index.ts`, `apps/frontend/src/lib/error-messages.ts`, `apps/backend/src/modules/notifications/**` (doar evenimentul tău).

Migrări (scrise de mână, doar adăugări; NU le aplica — le aplică coordonatorul): `e7-addr` → `apps/backend/prisma/migrations/20261114140000_request_address_details/migration.sql`. Dacă alt agent descoperă că are nevoie de o migrare: se oprește pe punctul acela și scrie la „DECIZIE NECESARĂ”.

Fluxurile de chestionar din `packages/shared/src/questionnaire/flows/**` sunt înghețate (etapa 6 tocmai a adăugat versiunile noi): nu se ating.

Mașina: Docker și Postgres sunt pornite, dar testele de integrare le rulează doar coordonatorul (aceeași bază de test); agenții scriu `*.integration.spec.ts` și NU îl rulează. Toate comenzile de test prin `low.cjs` (ghidul §4), țintite.
