# Etapa 5 — contractul dintre agenți (obligatoriu pentru toți agenții etapei)

Scris de coordonator înainte de lucru, ca șapte agenți să poată lucra în paralel în aceeași copie de lucru. Numele de mai jos sunt finale. Dacă un punct ți se pare greșit sau imposibil: respectă-l cât poți, scrie la „DECIZIE NECESARĂ” ce nu merge și spune în raport; nu inventa alt nume pe cont propriu.

## 0. Cine ce face

| Agent | Probleme | Zona lui (fișierele „ale lui”) |
|---|---|---|
| `e5-form` | 20 (`c10`) + 24 (`c3`) | `apps/frontend/src/components/configurator/step-renderer.tsx` (+ testele lui), textele coșului și ale listei de deschidere (doar prin fragment i18n) |
| `e5-3d` | 23 (`b7`) | `packages/shared/src/questionnaire/piece3d/**`, `apps/frontend/src/components/configurator/piece3d/**` |
| `e5-size` | 21 (`d3`) | `apps/backend/src/modules/sizing/**`, `apps/backend/src/modules/requests/configurator.service.ts`, `apps/backend/src/modules/requests/publish-rules.ts`, `apps/backend/src/modules/requests/dto/**`, `packages/shared/src/questionnaire/engine.ts`, `packages/shared/src/questionnaire/mapping.ts`, `apps/frontend/src/stores/configurator-store.ts`, `apps/frontend/src/components/configurator/room-flow-runner.tsx`, `apps/frontend/src/components/configurator/room-spec-card.tsx`, migrarea lui |
| `e5-exec-be` | 22 (`e1`), serverul | `apps/backend/src/modules/fulfillment/**`, `packages/shared/src/reviews.schemas.ts`, migrarea lui |
| `e5-exec-fe` | 22 (`e1`), interfața | `apps/frontend/src/app/[locale]/_components/client-fulfillment.tsx`, `claim-completion-card.tsx`, `apps/frontend/src/app/[locale]/requests/[id]/page.tsx`, `requests/[id]/offers/page.tsx`, `apps/frontend/src/app/[locale]/marketplace/claims/[claimSlotId]/page.tsx`, `apps/frontend/src/hooks/use-fulfillment.ts` |
| `e5-auth` | 25 (`f3`) | `apps/backend/src/modules/auth/**`, `apps/backend/src/infra/event-bus/**`, `apps/frontend/src/lib/api.ts`, `apps/frontend/src/lib/providers.tsx`, `apps/frontend/src/hooks/use-auth.ts`, `apps/frontend/src/hooks/use-socket.ts`, `apps/frontend/src/app/[locale]/(auth)/login/**`, `apps/frontend/src/app/[locale]/marketplace/[id]/page.tsx`, `apps/frontend/src/app/[locale]/marketplace/claims/page.tsx` |
| `e5-area` | 26 (`a6`) | `apps/backend/src/modules/requests/requests.service.ts`, `requests.controller.ts`, `apps/backend/src/modules/marketplace/**`, `apps/frontend/src/app/[locale]/_components/request-visibility-card.tsx`, `apps/frontend/src/components/configurator/review-step.tsx`, `configurator-wizard.tsx`, `apps/frontend/src/hooks/use-requests.ts` |

Fișiere COMUNE în etapa asta (pe lângă cele din ghid): ai voie doar cu Edit punctual, doar ca să ADAUGI rândurile problemei tale, citind fișierul chiar înainte de Edit; nu reformatezi, nu reordonezi, nu ștergi:
`apps/backend/prisma/schema.prisma`, `apps/backend/prisma/seed.ts`, `apps/backend/src/common/settings/setting-defaults.ts`, `apps/backend/src/modules/admin/admin.service.ts` (doar `SETTING_VALUE_RULES`), `apps/backend/src/modules/notifications/**` (doar maparea evenimentului tău), `apps/backend/src/modules/requests/requests.service.ts` (al lui `e5-area`; `e5-size` doar adaugă câmpul lui acolo unde se scriu / citesc camerele), `packages/shared/src/request.schemas.ts`, `packages/shared/src/enums.ts`, `packages/shared/src/error-codes.ts`, `packages/shared/src/index.ts`, `apps/frontend/src/hooks/use-socket.ts` (al lui `e5-auth`; ceilalți doar adaugă înregistrarea evenimentului lor), `apps/frontend/src/app/[locale]/_components/notification-bell.tsx`, `apps/frontend/src/app/[locale]/admin/settings/_components/setting-catalog.ts`, `apps/frontend/src/lib/error-messages.ts`.

Migrări (scrise de mână, mici, doar adăugări; NU folosi `prisma migrate diff` pe tot fișierul, pentru că prinde și schimbările altui agent; NU le aplica pe nicio bază — le aplică coordonatorul):
- `e5-size`: `apps/backend/prisma/migrations/20261114100000_piece_weights_room_approx_length/migration.sql`
- `e5-exec-be`: `apps/backend/prisma/migrations/20261114110000_execution_stages_delivery_min_days/migration.sql`
- Ceilalți agenți nu au nevoie de migrare. Dacă totuși îți trebuie una, oprește-te și scrie la „DECIZIE NECESARĂ”.

## 1. Problema 22 (`e1`) — după acceptare: server ↔ interfață

Hotărârile PO (finale): e1-1 clientul primește datele persoanei responsabile de cerere (nume, e-mail, telefon dacă există) + adresa și CUI-ul firmei, doar după acceptare și doar pentru firma câștigătoare; e1-2 etape informative pe care firma le bifează, vizibile clientului, care NU blochează livrarea; e1-3 „Marchează ca livrată” merge doar după un număr minim de zile de la acceptare (pornește cu 7, se schimbă din Admin).

### 1.1 Date noi
- Enum `ExecutionStage`: `MEASUREMENTS`, `CONTRACT`, `PRODUCTION`, `INSTALLATION` (în Prisma și în `packages/shared/src/enums.ts` ca `EXECUTION_STAGES`, în ordinea asta).
- Tabel `request_execution_stages`: `id` uuid PK, `request_id` uuid FK → `requests` (cascade), `stage` `ExecutionStage`, `completed_at` timestamptz NOT NULL, `completed_by_user_id` uuid FK → `users`, `created_at`; unic pe (`request_id`, `stage`). Un rând = etapă bifată; debifarea șterge rândul.
- Setare `delivery_min_days_after_accept` (întreg, 0–365; 0 = fără limită), valoare 7: rând nou prin migrare (`INSERT … ON CONFLICT DO NOTHING`) + `seed.ts` + `setting-defaults.ts` + regula din `SETTING_VALUE_RULES`. Intrarea din pagina de Admin (`setting-catalog.ts`) și textele ei le pune `e5-exec-fe`.

### 1.2 Firma
- `GET company/requests/:id/completion` (există) — `CompanyCompletionDto` primește în plus:
  - `acceptedAt: string | null` (momentul acceptării ofertei firmei);
  - `earliestDeliveryAt: string | null` (`acceptedAt` + zilele din setare; `null` dacă setarea e 0 sau nu există acceptare);
  - `autoCompleteAt: string | null` (când se finalizează singură o livrare neconfirmată — calculat de server cu regula existentă, inclusiv ceasul repornit după închiderea unui caz; `null` dacă cererea nu e în `DELIVERED_BY_COMPANY`);
  - `stages: ExecutionStageDto[]` — mereu toate cele 4 etape, în ordinea din enum.
- `ExecutionStageDto = { stage: ExecutionStage; done: boolean; completedAt: string | null; completedByName: string | null }`.
- `PUT company/requests/:id/stages/:stage`, corp `{ done: boolean }` → întoarce `CompanyCompletionDto` adus la zi. Idempotent (bifat de două ori = o singură bifă). Cine are voie: membrii firmei care pot lucra pe preluare (aceeași regulă de acces ca la fișa de lucru: OWNER / MANAGER sau angajatul căruia îi e atribuită). Doar cât cererea e `ACCEPTED`, `IN_EXECUTION` sau `DELIVERED_BY_COMPANY` și oferta firmei e cea acceptată; altfel `409 EXECUTION_STAGE_NOT_EDITABLE` (cod nou).
- `POST company/requests/:id/deliver` (există): înainte de `earliestDeliveryAt` → `409 DELIVERY_TOO_EARLY` (cod nou), cu `details: { earliestDeliveryAt }`. Verificarea se face pe server, sub aceeași blocare ca restul metodei.
- La bifarea unei etape (`done: true`): eveniment prin outbox `execution.stage_updated` către client (doar clopoțel, fără e-mail), cu `{ requestId, stage, companyName }`. La debifare nu se anunță nimic.

### 1.3 Clientul
- `GET requests/:id/fulfillment` (nou; doar clientul cererii) → `ClientFulfillmentDto`:
  ```ts
  {
    requestId: string;
    acceptedAt: string | null;
    deliveredAt: string | null;
    completedAt: string | null;
    autoCompleteAt: string | null;
    company: { name: string; cui: string | null; addressText: string | null; city: string | null; county: string | null } | null;
    contact: { name: string; email: string; phone: string | null } | null;
    stages: ExecutionStageDto[]; // [] cât nu există ofertă acceptată
  }
  ```
  `company` și `contact` sunt `null` cât cererea nu are o ofertă acceptată (verificare pe server: nimic din datele firmei nu pleacă înainte de acceptare și niciodată pentru altă firmă decât cea câștigătoare). `contact` = persoana atribuită preluării câștigătoare; dacă lipsește sau contul ei nu mai e activ → cel care a preluat; dacă nici el nu e activ → proprietarul firmei.
- Pagina cererii la client: „Expiră” apare doar cât cererea e `IN_MARKETPLACE`; după acceptare apare „Acceptată pe …” (din `ClientFulfillmentDto.acceptedAt`).
- Panoul „Ce urmează” al clientului arată contactul, datele firmei și etapele (cu data bifării).

### 1.4 Fișa firmei
- Când oferta firmei e cea acceptată, insigna de sus și blocul de termen arată starea PROIECTULUI (din `requestStatus`): Acceptată / Livrată — așteaptă confirmarea clientului (cu `autoCompleteAt`) / Finalizată; nu „Ofertă trimisă”. Plus un bloc „Ce urmează” pentru firmă, cu etapele de bifat.
- Dialogul „Marchează ca livrată” spune ce urmează (clientul confirmă sau se finalizează automat la `autoCompleteAt`); înainte de `earliestDeliveryAt` butonul e dezactivat, cu explicația și data.
- 401 pe paginile lui `e5-exec-fe`: o eroare `ApiError` cu `status === 401` nu se afișează ca „nu există”, ci ca încărcare — ascultătorul global al lui `e5-auth` duce omul la login.

## 2. Problema 21 (`d3`) — nume fixe
- Câmp opțional pe cameră, în afara răspunsurilor: `approxLengthM` (număr, metri), permis doar când cererea are `hasOwnProject`; coloană `request_rooms.approx_length_m NUMERIC(5,2) NULL`. Se folosește la treapta `ROOM_SIZE` doar când lungimea derivată din dimensiuni e 0. Gol = „sub 2 m”, ca azi.
- Cele 7 ponderi (`key = 'ROOM_TYPE'`): `PIECE_SOFA` 3, `PIECE_SIDEBOARD` 2, `PIECE_BATHROOM_VANITY` 2, `PIECE_ENTRYWAY` 2, `PIECE_WALL_CABINET` 1, `PIECE_ARMCHAIR` 1, `PIECE_OTTOMAN` 1 — în `seed.ts` ȘI în migrare (`INSERT … ON CONFLICT (key, option) DO NOTHING`), pentru că adminul poate doar edita rânduri existente.
- Costul rămâne minim 1 credit, fără maxim (doar documente).

## 3. Problema 25 (`f3`) — nume fixe
- Cel mult 5 sesiuni active pe cont (`MAX_ACTIVE_SESSIONS = 5`, constantă); a șasea autentificare o revocă pe cea mai veche. O sesiune = o familie de tokenuri (`family_id` = `sid`).
- `auth_expired` ajunge doar la socketurile sesiunilor revocate (după `sid`), nu la toate ale contului. Celelalte locuri care azi închid toate sesiunile (schimbarea parolei, blocarea contului) rămân „toate”.
- Interfață: când reîmprospătarea sesiunii eșuează, un singur semnal global → `/login?redirect=<pagina curentă>&reason=expired` (prin funcția sigură de redirect existentă), doar de pe paginile care cer cont; fără buclă pe paginile de autentificare, fără redirect de pe paginile publice.

## 4. Problema 26 (`a6`) — nume fixe
- `RequestVisibilityDto.coverage: 'COVERED' | 'NONE' | 'UNKNOWN'` (`UNKNOWN` = cererea nu are coordonate).
- `POST requests/drafts/:token/coverage` (nou; pentru Sumar) → `{ coverage }`, cu geocodare pe server și limită de apeluri.
- La publicarea unei cereri cu `coverage = 'NONE'`: eveniment prin outbox `request.no_coverage` către administratori (clopoțel + e-mail).
- „Firmă care acoperă” = firmă aprobată, cu abonament activ cu acces la piață, cu cel puțin o locație a cărei rază acoperă punctul aproximat al cererii — aceeași formulă ca piața, fără excluderi.
