# Etapa 9 — contractul dintre agenți (obligatoriu pentru toți agenții etapei)

Cinci agenți lucrează în paralel în aceeași copie de lucru (`E:\Cozy Fable`, ramura `claude/reparatii-etapa-09`). Fiecare își citește secțiunea din `docs/implementation/plan-reparatii-2026-11-13/etapa-09.md` (pași, „Unde în cod”, „Cum se verifică”, „Întrebări și răspunsuri” — răspunsurile PO sunt hotărâri finale). Dacă un punct de aici ți se pare greșit: respectă-l cât poți și scrie la „DECIZIE NECESARĂ”.

## Cine ce face

| Agent | Problemă | Zona lui (fișierele „ale lui”) |
|---|---|---|
| `e9-3d` | 44 (`l1`) configuratorul 3D: încadrare, sertare prea mari, limite | `apps/frontend/src/components/configurator/piece3d/**`, `packages/shared/src/questionnaire/piece3d/**` |
| `e9-notif` | 45 (`g1`) evenimente fără e-mail sau notificare | `apps/backend/src/modules/notifications/**`, evenimentele noi din `chat.service.ts`, `fulfillment.service.ts`, `quotes.service.ts`; în interfață: `apps/frontend/src/app/[locale]/_components/notification-bell.tsx`, `apps/frontend/src/hooks/use-socket.ts` |
| `e9-wallet` | 46 (`h3`) portofelul: istoric, anularea comenzii în așteptare | `apps/backend/src/modules/billing/**`, `apps/backend/src/modules/companies/companies.service.ts`, `apps/frontend/src/app/[locale]/marketplace/wallet/**`, migrarea lui |
| `e9-trace` | 47 (`e3`) clarificarea și editarea după preluare nu lasă urme | `apps/backend/src/modules/claims/clarifications.service.ts`, `apps/backend/src/modules/requests/request-expiration.processor.ts`, `apps/frontend/src/app/[locale]/_components/client-clarifications.tsx`, migrarea lui (dacă e nevoie) |
| `e9-drafts` | 48 (`f6`) ciornele anonime nu se șterg; cererea expirată nu se poate edita | `apps/backend/src/modules/requests/requests.service.ts`, `requests.controller.ts`, `apps/backend/src/infra/storage/**`, jobul nou de curățare, migrarea lui (dacă e nevoie) |

Fișiere COMUNE în etapa asta (pe lângă cele din ghid): doar Edit punctual, doar ca să ADAUGI rândurile problemei tale, citind fișierul chiar înainte de Edit; nu reformatezi, nu reordonezi:
- `apps/backend/src/modules/requests/requests.service.ts` — al lui `e9-drafts`; `e9-notif` (evenimente) și `e9-trace` (urmele editării) doar adaugă;
- `apps/backend/src/modules/notifications/notification-emails.service.ts` — al lui `e9-notif`; ceilalți doar adaugă e-mailul evenimentului lor;
- `apps/backend/src/infra/event-bus/event-bus.service.ts` (uniunea `DomainEvent`), `notification-bell.tsx`, `use-socket.ts` — ale lui `e9-notif`; ceilalți doar adaugă evenimentul lor;
- `apps/backend/prisma/schema.prisma`, `apps/backend/prisma/seed.ts`, `apps/backend/src/common/settings/setting-defaults.ts`, `apps/backend/src/modules/admin/admin.service.ts` (doar `SETTING_VALUE_RULES`), `apps/backend/src/modules/audit/audit-snapshot.ts` (listele de chei), `apps/frontend/src/app/[locale]/admin/settings/_components/setting-catalog.ts`, `packages/shared/src/{error-codes,enums,index,request.schemas}.ts`, `apps/frontend/src/lib/error-messages.ts`.

Migrări (scrise de mână, doar adăugări; NU le aplica — le aplică coordonatorul), cu numele rezervate (folosești unul doar dacă problema ta chiar are nevoie):
- `e9-wallet`: `apps/backend/prisma/migrations/20261114160000_wallet_history_order_cancel/migration.sql`
- `e9-drafts`: `apps/backend/prisma/migrations/20261114170000_draft_retention/migration.sql`
- `e9-trace`: `apps/backend/prisma/migrations/20261114180000_clarification_edit_traces/migration.sql`
- `e9-notif`: `apps/backend/prisma/migrations/20261114190000_notification_events/migration.sql`

Reguli de fier pentru `e9-3d`: fluxurile versionate și instantaneele (`packages/shared/src/questionnaire/__snapshots__/*.json`) rămân identice — o regulă nouă de geometrie nu are voie să schimbe ce se salvează / ce cost au cererile deja publicate; dacă planul cere o regulă care ar schimba curățarea configurațiilor existente, aplic-o doar configurațiilor noi sau editate (ca în etapele 5 și 8: `initialPieceConfig`, „intenția”, „Push” doar pe ciorne) și scrie la „DECIZIE NECESARĂ” ce ai ales.

Vocabular: textele noi folosesc termenii din `docs/glosar.md` (există un test care oprește termenii vechi: `apps/frontend/src/messages/glossary.test.ts`).

Mașina: Docker și Postgres sunt pornite, dar testele de integrare le rulează doar coordonatorul (aceeași bază de test); agenții scriu `*.integration.spec.ts` și NU îl rulează. Toate comenzile de test prin `low.cjs` (ghidul §4), țintite.

## Adaos (are întâietate față de rândurile de mai sus când se contrazic)

### Evenimente noi — nume și conținut fixate
Coordonatorul a adăugat deja aceste nume în uniunea `DomainEvent` (`event-bus.service.ts`); nu le mai adăuga tu:

| Eveniment | Cine îl emite | Ținte (`targetUserIds`) | Câmpuri în payload |
|---|---|---|---|
| `request.published` | `e9-notif` (în `requests.service.ts`, la publicare) | clientul | `requestId`, `requestTitle`, `clientUserId`, `expiresAt` |
| `request.new_in_area` | `e9-notif` | membrii firmelor care văd cererea | `requestId`, `requestTitle`, `companyId` (un eveniment pe firmă) |
| `clarification.asked` | `e9-trace` (în `clarifications.service.ts`) | clientul | `requestId`, `requestTitle`, `claimSlotId`, `companyId`, `companyName`, `clientUserId`, `actorUserId` |
| `clarification.answered` | `e9-trace` | toți membrii firmei | aceleași câmpuri |
| `request.edited_after_claim` | `e9-trace` (în `requests.service.ts`, la editarea după preluare) | toți membrii firmei, câte un eveniment pe fiecare preluare activă | aceleași câmpuri (`actorUserId` = clientul) |

- Evenimentele se scriu prin outbox, în aceeași tranzacție cu schimbarea (modelul: `request.company_withdrew` din `withdrawals.service.ts`).
- `e9-trace` DOAR emite cele trei evenimente ale lui. E-mailul, clopoțelul (titlul din `notification-bell.tsx`), înregistrarea în `use-socket.ts` și regula „cine din firmă primește e-mail” pentru TOATE cele cinci le scrie `e9-notif`. `e9-trace` nu atinge `notification-emails.service.ts`, `notification-bell.tsx`, `use-socket.ts`.
- `actorUserId` = cine a făcut acțiunea; `e9-notif` îl scoate din destinatari (clopoțel + e-mail) și îl adaugă și la evenimentele existente din fișierele lui (mesaj, acceptare, finalizare).

### Formularul în mod editare (interfață)
- Fișierele modului de editare al formularului (`apps/frontend/src/components/configurator/**` fără `piece3d/**`, `apps/frontend/src/stores/configurator-*.ts`, pagina de editare a cererii) sunt ale lui `e9-drafts` („Republică cu modificări”).
- `e9-trace` își scrie dialogul de confirmare ca fișier NOU și face un singur Edit punctual în locul unde se apasă salvarea editării (recitește fișierul chiar înainte).
- `apps/frontend/src/app/[locale]/requests/[id]/page.tsx`: al lui `e9-drafts`; `apps/frontend/src/app/[locale]/marketplace/claims/[claimSlotId]/page.tsx`: al lui `e9-trace`.
- Panoul firmei cu valoarea ofertelor (componenta care afișează suma din `companies.service.ts`): al lui `e9-wallet`.

### Foldere
- Fragmente i18n: `C:\Users\Wolf\AppData\Local\Temp\claude\51a4fe9ce30fc601\021e0df7-d6c7-42ac-993b-05ae92e81192\scratchpad\reparatii\etapa-09\i18n` (commitul de bază ți-l dă sarcina).
- Rapoarte: `…\reparatii\etapa-09\rapoarte\<id-agent>.md`. Scrie fișierul de raport DEVREME (schelet) și adu-l la zi pe parcurs, ca munca să nu se piardă dacă ești întrerupt.
