# Sarcina `e5-exec-be` — problema 22 (`e1`), partea de server

Citește secțiunea „## 22.” din `E:\Cozy Fable\docs\implementation\plan-reparatii-2026-11-13\etapa-05.md` și §1 din contract (numele de acolo sunt finale; interfața o scrie în paralel agentul `e5-exec-fe`, doar după contract).

## Ce ai de făcut
1. **Schema + migrarea** `20261114110000_execution_stages_delivery_min_days`: enum `ExecutionStage`, tabelul `request_execution_stages`, rândul de setare `delivery_min_days_after_accept` = 7 (vezi contractul §1.1; model pentru rândul de setare: migrarea `20260930120000_claims_open_after_first_offer_setting`). Plus `seed.ts`, `common/settings/setting-defaults.ts`, `SETTING_VALUE_RULES` din `admin.service.ts` (fișiere comune: doar Edit punctual).
2. **`markDelivered`** (`fulfillment.service.ts`): înainte de `acceptedAt` + zilele din setare → `409 DELIVERY_TOO_EARLY` cu `details: { earliestDeliveryAt }`. Verificarea stă sub aceeași blocare ca restul metodei; 0 în setare = fără limită. `acceptedAt` e pe ofertă (`quotes.accepted_at`).
3. **Etapele**: `PUT company/requests/:id/stages/:stage` (contractul §1.2) — idempotent, cu aceeași regulă de acces ca fișa de lucru a preluării (găsește garda / funcția existentă; nu inventa o regulă nouă), doar în stările permise, altfel `409 EXECUTION_STAGE_NOT_EDITABLE`. La bifare: eveniment prin outbox `execution.stage_updated` către client (clopoțel, fără e-mail) — urmează un eveniment existent către client (de ex. `delivery.marked`) ca model, inclusiv înregistrarea în modulul de notificări.
4. **`CompanyCompletionDto`** primește `acceptedAt`, `earliestDeliveryAt`, `autoCompleteAt`, `stages` (contractul §1.2). `autoCompleteAt` folosește regula existentă a finalizării automate (inclusiv `autoCompleteClockStart`, adăugat în etapa 1) — nu o rescrie, refolosește-o.
5. **`GET requests/:id/fulfillment`** → `ClientFulfillmentDto` (contractul §1.3). Verificări PE SERVER: doar clientul cererii; `company` / `contact` / `stages` doar când există o ofertă acceptată și doar pentru firma ei; contactul = persoana atribuită → cel care a preluat → proprietarul firmei (primul cu cont activ). Nimic din datele firmei nu pleacă înainte de acceptare.
6. Tipurile în `packages/shared` (`reviews.schemas.ts` sau un fișier nou exportat din `index.ts`), `EXECUTION_STAGES` în `enums.ts`, codurile noi în `error-codes.ts` + textele lor RO / EN (`apiErrors`, prin fragment i18n `e5-exec-be`).

## Teste
- Unit: contactele apar doar pentru clientul cererii, doar pentru firma cu oferta acceptată, doar după acceptare (înainte: `company`, `contact` = `null`); ordinea de rezervă a contactului.
- Unit: livrarea prea devreme → 409 cu data; la limită trece; setarea 0 → trece oricând.
- Unit: bifare / debifare idempotente; stare nepermisă → 409; angajat fără acces → refuzat.
- Integrare (`*.integration.spec.ts`, se rulează de coordonator — Postgres e oprit acum; scrie-l, nu-l rula): bifarea aceleiași etape de două ori în paralel lasă un singur rând.

## Reguli stricte
- Nu schimba decontarea creditelor, finalizarea automată sau stările cererii (nimeni nu scrie `IN_EXECUTION` azi — nu începe tu).
- Regulile noi pot strica fixture-urile testelor vechi din `fulfillment` (de ex. „livrat” imediat după acceptare): adu-le la zi, inclusiv specurile de integrare care trec prin `markDelivered` (caută `deliver` în `apps/backend/src/**/*.integration.spec.ts`).
- După schema Prisma: `pnpm -F backend exec prisma generate`; după tipuri shared: `pnpm -F @marketplace/shared build` (ambele prin `low.cjs`). Fă build-ul de shared DEVREME (imediat ce ai scris tipurile din contract), ca agentul de interfață să le poată folosi.

## Fișierele tale
`apps/backend/src/modules/fulfillment/**`, `packages/shared/src/reviews.schemas.ts` (+ fișier nou în shared dacă alegi), migrarea ta; restul sunt fișiere comune (Edit punctual). În raport spune explicit: rutele finale, forma exactă a DTO-urilor, codurile de eroare noi, numele evenimentului — și orice abatere de la contract.
