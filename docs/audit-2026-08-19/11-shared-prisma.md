# Aria: shared + prisma schema

Audit read-only 2026-08-19. Scop: `packages/shared/src/*.ts` (fara questionnaire/, room-meta.ts, studio.schemas.ts), `apps/backend/prisma/schema.prisma` + `migrations/`, `docs/04`, `docs/ERROR_CODES.md`, `docs/07`.
Metoda: scripturi node in scratchpad (`exports.js`, `exports2.js`, `prisma.js`, `errors.js`, `migrations.js`) care parcurg `apps/backend/src`, `apps/frontend/src`, `packages/shared/src`, `messages/{en,ro}.json` si toate `migration.sql`. Cifrele de mai jos = numar de fisiere/aparitii gasite de grep pe cuvant intreg.

Cifre cheie:
- 252 exporturi in aria shared; 38 complet moarte (0 referinte BE/FE si nereferite de niciun export viu), inca ~25 scheme zod "vii" doar pentru ca le deriva un tip `z.infer` (nu ruleaza niciodata la runtime).
- 88 coduri ERROR_CODES: 11 definite si niciodata aruncate; 31 aruncate dar fara mesaj i18n in FE (8 dintre ele vizibile utilizatorului final); 15 nedocumentate in docs/ERROR_CODES.md. RO si EN au aceeasi acoperire (57 coduri mapate, identic).
- 30 enum-uri partajate shared ↔ Prisma: toate valorile identice (0 discrepante). 9 valori de enum moarte (niciodata scrise in cod).
- 50 modele Prisma: 0 modele complet nefolosite (RequestRoomItem e scris doar prin nested create). 2 coloane moarte (`users.anonymized_at` — 0 referinte; `project_size_thresholds.credit_cost` — scris de admin, citit de nimeni) + ~10 coloane scrise dar niciodata citite (lista in DE STERS).
- Migrari: 28 foldere, toate conventionale, toate cu `migration.sql`; 0 coloane/indexi/valori enum din schema lipsa in SQL si invers. Schema == migrari.
- docs/04: 5 tabele descrise care nu exista (teams, admin_notes, request_/message_/quote_attachments), 2 tabele noi nedescrise (studio_drafts, request_studio_scenes), 6 denumiri de coloane diferite, 2 valori claim_slots.status lipsa.

## BINE FACUT

- Enum-urile shared (`enums.ts`) si Prisma sunt identice valoare cu valoare pentru toate cele 30 de perechi; `@@map` snake_case prezent pe toate modelele/enum-urile; niciun camp camelCase fara `@map`.
- Toate `DateTime` au `@db.Timestamptz()` (sau `@db.Date` unde e data calendaristica: `quote_versions.delivery_date`, `business_calendar_holidays.date`). Invarianta 3.3 respectata la nivel de schema.
- Bani pe `Decimal(12,2)` (quote_versions.price/design_fee, quote_version_room_prices.price, mock_billing_orders.*), `vat_rate Decimal(5,2)`; preturile de catalog (planuri/pachete) `Int` in RON intregi — corect. Fara `Float` pe bani.
- Migrarile reflecta exact schema: fiecare tabel/coloana/index/unique/valoare de enum din `schema.prisma` apare in SQL si invers; folderele respecta `YYYYMMDDHHMMSS_nume`; `migration_lock.toml` prezent; fiecare migrare manuala are comentariu de rollback.
- Indexi partiali scrisi de mana pentru invariantele de concurenta: `claim_slots_one_active_unoffered_per_assignee` (1 claim activ fara oferta / assigned_to) si `claim_slots_one_active_per_company_per_request`; trigger `audit_logs_immutable` (Î15) — toate in migrari, nu doar in cod.
- Backend-ul valideaza cu class-validator DTO-uri cu `MaxLength` pe toate string-urile de input (scan pe `modules/**/dto`: singurele `@IsString()` fara limita sunt filtrele query din inspiration, parse-uite in array-uri) — nu exista input user nelimitat care sa ajunga in coloane TEXT, cu exceptiile de mai jos (Idempotency-Key, User-Agent).
- `ERROR_CODES` e singura sursa pentru coduri: 0 coduri aruncate in BE care sa lipseasca din shared; 0 chei `apiErrors.*` in FE care sa nu fie coduri reale (doar `GENERIC` ca fallback); 0 coduri in docs care sa lipseasca din shared.
- Idempotency: hash-ul include `userId`, deci cheia reutilizata de alt user da 409, nu returneaza raspunsul altcuiva.
- `refresh_tokens.user_id`, `company_members.user_id`, `claim_slots.claimed_by_user_id` → `ON DELETE RESTRICT`: stergerea hard a unui user e blocata daca are istoric (bun pentru audit); `assigned_to_user_id` SET NULL corect.
- FE nu afiseaza niciodata codul brut: toate afisajele folosesc `t.has(\`apiErrors.${code}\`) ? ... : INTERNAL_ERROR` sau `message`-ul serverului ca fallback (login/register).

## DE MODIFICAT — `[P0|P1|P2] cale:linie — problema → recomandare`

- **[P0] apps/backend/prisma/schema.prisma:502 (Request.deletedAt) + apps/backend/src/modules/requests/requests.service.ts:507-547 + apps/backend/src/modules/marketplace/marketplace.service.ts:174-185 + apps/backend/src/modules/claims/claims.service.ts:105-120** — `deleteForClient` (Î17) seteaza doar `deleted_at`, NU schimba `status`; listarea marketplace (SQL raw) si `POST /claims` (SELECT ... FOR UPDATE) filtreaza doar pe `status IN (IN_MARKETPLACE, CLAIMED_PARTIAL)` si nu verifica `deleted_at IS NULL`. O cerere stearsa de client ramane vizibila in marketplace si CLAIMABILA (se rezerva credite pe o cerere inexistenta). Invarianta 3.12 cere middleware Prisma care filtreaza automat `deleted_at IS NULL` — nu exista (`infra/prisma/prisma.service.ts` e un `PrismaClient` gol, 0 `$use/$extends`). → Minim: `AND r.deleted_at IS NULL` in marketplace.service + check `deleted_at` in claims.service (si in `getDetail`); ideal: la delete seteaza si un status terminal (ex. EXPIRED) sau implementeaza middleware-ul din 3.12. Nici `chat.service`/`quotes.service` nu verifica `deletedAt` pe cerere.
- **[P1] apps/backend/src/modules/claims/claims.service.ts:100-160** — la claim nu se verifica gating-ul (4.10, `published_at + gating_delay <= now()`) — verificarea exista doar in SQL-ul de listare din marketplace. Codul `GATING_NOT_OPEN` e definit dar niciodata aruncat. O firma Silver care afla id-ul cererii poate da claim inainte sa-i fie deschisa. → Recalculeaza gating-ul in tranzactia de claim si arunca `GATING_NOT_OPEN`.
- **[P1] apps/backend/prisma/schema.prisma:772-780 (ProjectSizeThreshold.creditCost) + apps/backend/src/modules/admin/admin.service.ts:194-205 + apps/backend/src/modules/sizing/sizing.service.ts:72** — `credit_cost` e editabil din Admin (PUT thresholds) dar costul real se calculeaza cu `creditCostFromBaseScore` (1 credit = 1.000 RON, decizie PO r5); coloana nu mai e citita de nimeni → admin crede ca seteaza costul si nu se intampla nimic. Contrazice si docs/07 D-v6-5 ("1/2/4 credite configurabil din Admin"). → Scoate campul din UI/DTO admin + `@ignore`/drop coloana, sau documenteaza ca e doar informativ; actualizeaza docs/07.
- **[P1] apps/backend/src/modules/billing/payments.service.ts:101-129** — `confirm()` verifica `status !== 'PENDING'` IN AFARA tranzactiei si face `update({ where: { id } })` neconditionat → admin-confirm + webhook simultane pot ambele trece de check si livra creditele/abonamentul de 2 ori (Idempotency-Key nu ajuta, sunt chei diferite). Numarul de factura = `max+1` fara serializare → la concurenta a doua comanda pica pe `@@unique([invoiceSeries, invoiceNumber])` cu 500, nu cu retry. → `updateMany({ where: { id, status: 'PENDING' } })` si verificare `count === 1` in tranzactie; secventa Postgres per serie sau `SELECT ... FOR UPDATE` pe o linie de contor.
- **[P1] apps/backend/prisma/schema.prisma:821-839 (Subscription)** — docs/04 §5.6 "companies 1—1 subscription (activa)" nu e impus nici in DB (fara index partial unique pe `(company_id) WHERE status='ACTIVE'`) nici in `payments.service.ts:145` (creeaza un nou rand ACTIVE fara sa inchida/prelungeasca pe cel curent). Guard-ul ia `orderBy expiresAt desc`, deci functioneaza, dar o firma care cumpara din nou in timpul abonamentului PIERDE zilele ramase (noul expira la now+30d). Statusurile `EXPIRED`/`CANCELLED` nu sunt scrise niciodata (expirarea e doar `expiresAt > now()`). → Decide: prelungire (expiresAt = max(expiresAt, now) + 30d) sau inlocuire explicita (vechiul → CANCELLED/EXPIRED) + index partial unique.
- **[P1] apps/backend/prisma/schema.prisma:1262-1289 (MockBillingOrder) + :856-870 (CreditTransaction)** — `company Company @relation(..., onDelete: Cascade)`: stergerea hard a unei firme sterge facturile emise si registrul de credite (date financiare cu obligatie legala de pastrare). Azi firmele sunt doar soft-deleted, deci riscul e latent, dar schema nu protejeaza. → `onDelete: Restrict` pe `mock_billing_orders.company_id`, `credit_transactions.company_id` (si `penalty_events`/`audit`-like), pastrand Cascade doar pe datele fara valoare de pastrare (locatii, portofoliu, permisiuni).
- **[P1] apps/backend/prisma/schema.prisma:502-549 (Request.clientUserId) + :1311-1320 (Notification.userId)** — `requests.client_user_id` si `notifications.user_id` nu au `@relation`/FK catre `users` (User nu are `requests`/`notifications`). Fara integritate referentiala si fara cascade la stergere cont; `Request.clientUserId` nullable acopera draftul anonim, deci FK-ul e posibil. La fel `quote_versions.created_by_user_id`, `quote_change_requests.client_user_id`, `reviews.client_user_id`, `claim_withdrawals.requested_by/reviewed_by_user_id`, `clarification_requests.requested_by_user_id`, `penalty_events.user_id/claim_slot_id`, `credit_transactions.claim_slot_id`, `claim_slots.quote_id` (comentariul "FK reala vine in Sprint 6" e stale), `mock_billing_orders.plan_id/credit_package_id`, `inspiration_photos.attachment_id`. → Adauga relatii Prisma cu `onDelete` explicit (SetNull pentru actori, Restrict pentru financiar) sau documenteaza in docs/04 ca sunt referinte "soft" intentionate.
- **[P1] docs/02-technical-invariants.md §3.12 vs apps/backend/prisma/schema.prisma:340 (User.anonymizedAt)** — `UserAnonymizationService.anonymizeUser` nu exista in backend (0 aparitii `anonymiz`), `users.anonymized_at` nu e scris/citit nicaieri, `users.deleted_at`/`companies.deleted_at` nu sunt scrise niciodata (nu exista endpoint de stergere cont/firma). Invarianta 3.12 (GDPR) e neimplementata la lansare. → DECIZIE PO: flux de stergere/anonimizare cont in MVP sau amana explicit; pana atunci coloanele sunt moarte.
- **[P1] packages/shared/src/*.schemas.ts vs apps/backend/src/modules/**/dto/*.ts** — dubla sursa de validare: shared are ~45 scheme zod "pentru RHF + reutilizabile in DTO", dar backend-ul valideaza exclusiv cu class-validator; doar 4 scheme zod din aria mea ruleaza efectiv (`loginSchema`, `registerSchema`, `companyOnboardingSchema` in FE via zodResolver; `contactPreferencesSchema` in BE `.safeParse`) + `configuratorContentSchema` (omit in details-step). Restul exista doar ca sursa de `z.infer`. Drift deja vizibil: `companyLocationSchema.coverageRadiusKm` `positive().max(1000)` vs DTO `Min(0.1)`; `companyMemberInviteSchema/companyMemberRoleSchema` enum inline in loc de `COMPANY_MEMBER_ROLES`. → Alege o directie: (a) `nestjs-zod`/`createZodDto` din schemele shared in BE si sterge DTO-urile class-validator, sau (b) pastreaza class-validator si reduce shared la tipuri/constante + schemele chiar folosite in FE. Azi e cel mai mare generator de cod mort din shared (vezi DE STERS).
- **[P1] packages/shared/src/error-codes.ts + apps/frontend/src/messages/{en,ro}.json** — coduri aruncate de BE fara mesaj i18n nicaieri (utilizatorul vede "A aparut o eroare" generic): user-facing: `MANAGER_UNASSIGNED_CAP_REACHED` (claim, cap manager D2 — namespace Marketplace), `REQUEST_NOT_DELETABLE` (client sterge cererea), `REVIEW_NOT_ALLOWED_YET`, `REVIEW_ALREADY_SUBMITTED` (client review), `DELIVERY_NOT_ALLOWED`, `COMPLETION_NOT_ALLOWED` (fulfillment), `CREDIT_PACKAGE_INACTIVE` (cumparare credite; wallet/page.tsx nici nu afiseaza eroarea mutatiei), `UNAUTHORIZED`. Admin-only fara mapare: `PAYMENT_*`, `WITHDRAWAL_ALREADY_DECIDED`, `DISPUTE_ALREADY_DECIDED`, `SETTING_KEY_UNKNOWN`. → Adauga cheile in namespace-urile potrivite (sau un namespace global `apiErrors` + fallback, ca sa nu mai fie duplicate in 7 namespace-uri: `VALIDATION_ERROR`/`INTERNAL_ERROR` sunt definite de 6 ori).
- **[P2] docs/ERROR_CODES.md** — 15 coduri reale nedocumentate: `CONFIGURATOR_ANSWERS_INVALID`, `CONFIGURATOR_FLOW_VERSION_UNSUPPORTED`, `CONFIGURATOR_STATE_TOO_LARGE`, `WITHDRAWAL_ALREADY_DECIDED`, `CLAIM_NOT_WITHDRAWABLE`, `REQUEST_NOT_DELETABLE`, `QUOTE_ALREADY_SENT`, `CHANGE_REQUEST_NOT_PENDING`, `DELIVERY_NOT_ALLOWED`, `COMPLETION_NOT_ALLOWED`, `BOARD_NAME_TAKEN`, `STUDIO_DRAFT_{NAME_TAKEN,LIMIT_REACHED,INVALID,TOO_LARGE}`; `FILE_LIMIT_REACHED` documentat "10/cerere" dar capul e dinamic (`maxAttachmentsForRequest` = 10 + 8×camere). → Sincronizeaza docs cu `error-codes.ts` (sau genereaza docs din fisier).
- **[P2] docs/04-data-model.md** — diferente evidente fata de schema: (1) §5.1 listeaza `teams`, `admin_notes`, `request_attachments`, `message_attachments`, `quote_attachments` — nu exista; schema are `attachments` generic (entity_type/entity_id); (2) lipsesc `studio_drafts`, `request_studio_scenes`, `geocoding_cache`, `idempotency_keys`, `business_calendar_holidays`, `attachments` (ultimele 4 apar doar in docs/02/sprint-0); (3) §5.2 `project_sizing_config(category, option_key, option_label, points, is_active)` vs schema `(key, option, weight)`; `project_size_thresholds(min_points, max_points, claim_cost_credits)` vs `(min_score, max_score, credit_cost)`; (4) §5.3 `requests.project_score` vs `size_score`; `requests.anonymized_at` e in docs pe requests, in schema pe users; (5) §5.5 `claim_slots.status` fara `WITHDRAWN`, `SLA_EXPIRED`; `request status: PUBLISHED/IN_MARKETPLACE` (decis IN_MARKETPLACE in Sprint 0); lipsesc enum-urile `quote_status`, `quote_change_request_status`, `clarification_status`, `review_dispute_status`, `billing_order_*`, `chat_thread_type`, `subscription_*`, `credit_transaction_type`; (6) §5.6 "requests 1—1 request_contact_preferences" — e 1—N (1..4 contacte). → Actualizeaza docs/04 (e "sursa de adevar VERBATIM" per CLAUDE.md, azi nu mai e).
- **[P2] docs/07-decisions-log.md D-v6-6 + apps/backend/prisma/seed.ts:159-160 + schema PenaltyScope.EMPLOYEE** — blocul pe angajat la 9 puncte e descopat (memorie sprint 7), dar docs/07 il pastreaza ca decizie finala, seed-ul scrie `employee_penalty_threshold`/`employee_block_months` (niciodata citite), `PenaltyScope.EMPLOYEE` si `ASSIGNED_USER_PENALTY_BLOCKED` sunt moarte. → Adnoteaza decizia in docs/07 ("amanat post-MVP") si scoate cheile din seed sau documenteaza-le ca rezervate.
- **[P2] apps/backend/prisma/schema.prisma — `updated_at @updatedAt` lipsa pe modele mutabile**: `User` (profil/2FA/email prefs), `Company` (status, suspendare), `CompanyLocation`, `CompanyPortfolioItem`, `CompanyOfferFieldPermission`, `InspirationPhoto` (published/featured/soft delete), `Subscription`, `ChatThread` (read_only/negotiation flags), `QuoteChangeRequest`, `PhysicalConsultationInvite`, `ClaimWithdrawal`, `ClarificationRequest`, `ReviewDispute`, `MockBillingOrder`, `Notification` (read_at), `Attachment` (status), `PenaltyRule`, `CreditPackage`, `SubscriptionPlan`, `ProjectSizeThreshold`, `RefreshToken`. Imutabilele (Message, CreditTransaction, AuditLog, RequestVersion, QuoteVersion...) sunt corect fara. → Adauga `updatedAt` macar pe User/Company/Subscription/InspirationPhoto/MockBillingOrder (debug + sincronizare).
- **[P2] apps/backend/prisma/schema.prisma — indexi**: (a) redundanti (coloana de inceput e deja acoperita de un `@@unique`): `company_members@@index([companyId])` vs `@@unique([companyId,userId])`; `company_offer_field_permissions@@index([companyId])`; `request_company_exclusions@@index([requestId])`; `request_versions@@index([requestId])`; `quote_versions@@index([quoteId])`; `studio_drafts@@index([userId])`; `inspiration_boards@@index([userId])`; (b) lipsa fata de query-uri reale: `audit_logs` — admin viewer filtreaza `userId`/`action` (admin.service.ts:88-96), index doar pe `(entity_type, entity_id)` si `created_at`; `messages` — `where chatThreadId orderBy createdAt` (chat.service.ts:216) → `@@index([chatThreadId, createdAt])`; `notifications` — `orderBy createdAt` per user → `@@index([userId, createdAt])`; `claim_slots` — dashboard firma `companyId+status` → `@@index([companyId, status])`; `companies.cui` — unicitatea `CUI_ALREADY_REGISTERED` e doar in service (race → 2 firme cu acelasi CUI) → index partial unique `(cui) WHERE status <> 'REJECTED' AND deleted_at IS NULL` prin migrare manuala. → Ajusteaza la urmatoarea migrare.
- **[P2] apps/backend/src/common/idempotency/idempotency.interceptor.ts:40-48 + schema IdempotencyKey.key/AuditLog.userAgent** — `Idempotency-Key` e acceptat la orice lungime si stocat in `idempotency_keys.key TEXT`; `audit_logs.user_agent` stocheaza header-ul brut nelimitat. Singurele inputuri user fara limita care ajung in DB. `responseStatus` e salvat dar la replay nu se re-seteaza statusul (201 → 200). → Valideaza UUID v4 (cum cere 3.2) / max 128; trunchiaza UA la 512; seteaza statusul la replay.
- **[P2] apps/backend/prisma/schema.prisma:975-990 (IdempotencyKey), :783-794 (GeocodingCache), :483-499 (RefreshToken)** — nu exista niciun job de curatare: randurile expirate din `idempotency_keys` se sterg doar daca aceeasi cheie e refolosita, `geocoding_cache` expirat si `refresh_tokens` revocate raman la nesfarsit; `@@index([expiresAt])` pe idempotency_keys e azi nefolosit de nicio interogare. → Job BullMQ repetabil `deleteMany({ expiresAt < now })` (si `revokedAt < now-30d`).
- **[P2] apps/backend/src/modules/requests/requests.service.ts:814 + schema QuoteVersionRoomPrice.room onDelete: Cascade** — editarea (post-claim, 1x) face `requestRoom.deleteMany` + recreare; cascada sterge `quote_version_room_prices` ale ofertelor RETRASE istorice (ofertele active blocheaza editarea prin `OFFER_LOCKED_STATUSES`, dar o oferta WITHDRAWN pe CLAIMED_FULL nu). Versiunile de oferta sunt "snapshot-uri imuabile" per comentariul din schema. → `Restrict` + refuz editare cand exista oferte, sau update in loc de delete/recreate pe camere.
- **[P2] packages/shared/src/company.schemas.ts:126, auth.schemas.ts:18-19,28, reviews.schemas.ts:14, billing.schemas.ts:19, request.schemas.ts:43, quote.schemas.ts:153,187,225, chat.schemas.ts:72, company.schemas.ts:161** — uniuni/enum-uri inline in loc de constantele din `enums.ts` (`CompanyDto.status`, `AuthUser.role`, `registerSchema.role/languagePreference`, `companyMemberInviteSchema.role`, `companyMemberRoleSchema.role`, `resolveDisputeSchema.status`, `paymentWebhookSchema.status`, `budgetRangeFromRon` return) si campuri tipate `string` care sunt enum-uri (`QuoteRoomPriceDto.roomType`, `ClaimRequestDetailDto.budgetRange/deadlineBucket`, `ClaimQuoteContextDto.claimStatus`, `ChatThreadDto.claimStatus`, `CompanyDashboardStatsDto.claimsByStatus`). Nu exista constanta shared pentru `UserRole` si `ChatThreadType` (Prisma le are). → Foloseste `(typeof X)[number]` / adauga `USER_ROLES`, `CHAT_THREAD_TYPES`.
- **[P2] packages/shared/src/request.schemas.ts:36-41** — `CREDIT_VALUE_RON` = `BUDGET_RON_PER_POINT` = 1000, deci `creditCostFromBaseScore` = `max(1, ceil(score))` — formula e tautologica; daca PO schimba vreodata una din constante fara cealalta, rezultatul devine neintuitiv. → Comentariu explicit sau o singura constanta.
- **[P2] apps/backend/prisma/schema.prisma:886 (ClaimSlot.quoteId) comentariu "FK reala vine in Sprint 6"** — stale; decizia finala e denormalizare fara FK (pentru indexul partial). → Actualizeaza comentariul.

## DE STERS — `cale:linie — ce + dovada (0 referinte)`

### exporturi shared (38 complet moarte: 0 aparitii in apps/backend/src, apps/frontend/src si nereferite de niciun export viu din shared)
- packages/shared/src/admin.schemas.ts:57-58 — `updateSettingSchema`, `UpdateSettingInput` (admin foloseste `UpdateSettingDto` class-validator)
- packages/shared/src/billing.schemas.ts:17-21 — `paymentWebhookSchema`, `PaymentWebhookInput` (BE: `payment.dto.ts` cu `@IsIn`)
- packages/shared/src/claims-lifecycle.schemas.ts:95-99 — `ClaimSlaDto` (ClaimSlotDto are deja sla*)
- packages/shared/src/company.schemas.ts:80-83 — `companyRejectSchema`, `CompanyRejectInput`
- packages/shared/src/enums.ts:23,27,30,33,51,60,63,144,189,193,208,213 — tipurile derivate `ClarificationStatus`, `ReviewDisputeStatus`, `BillingOrderType`, `BillingOrderStatus`, `WithdrawalStatus`, `ConsultationInviteStatus`, `Currency`, `AttachmentStatus`, `SubscriptionPlanTier`, `SubscriptionStatus`, `QuoteStatus`, `QuoteChangeRequestStatus` — DTO-urile folosesc `(typeof X)[number]` direct, tipurile cu nume nu sunt importate nicaieri (BE foloseste enum-urile `@prisma/client`). Recomandare: pastreaza-le dar FOLOSESTE-LE in DTO-uri (vezi P2 mai sus), altfel sterge.
- packages/shared/src/enums.ts:198-203 — `CREDIT_TRANSACTION_TYPES`, `CreditTransactionType`, `REQUEST_EXCLUSION_REASONS`, `RequestExclusionReason` (BE scrie literalele via enum Prisma)
- packages/shared/src/inspiration.schemas.ts:8 — `MAX_INSPIRATION_PER_REQUEST` (limita 10 e hardcodata in `configuratorContentSchema.inspirationPhotoIds.max(10)` si in BE)
- packages/shared/src/inspiration.schemas.ts:57-60 — `inspirationBoardInputSchema`, `InspirationBoardInput` (BE foloseste `MAX_BOARD_NAME_LENGTH` + DTO propriu)
- packages/shared/src/marketplace.schemas.ts:108-118 — `ClaimedRequestDto` (inlocuit de `ClaimQuoteContextDto`)
- packages/shared/src/quote.schemas.ts:95-96 — `endNegotiationSchema` (= `z.object({})`), `EndNegotiationInput`
- packages/shared/src/request.schemas.ts:67 — `RequestRoomInput`; :116 `RequestContentInput`; :126 `ConfiguratorRoomInput`; :169-170 `requestEditSchema` (alias identic cu `requestContentSchema`), `RequestEditInput`; :217-220 `confirmUploadSchema`, `ConfirmUploadInput`
- packages/shared/src/request.schemas.ts:70,72 — `RO_PHONE_REGEX`, `INTL_PHONE_REGEX` exportate dar folosite doar local in `PHONE_REGEX` (neexportat) → pot deveni `const` interne.
- Scheme zod "vii" doar prin `z.infer` (nu ruleaza nicaieri; de sters daca se alege varianta (b) din P1 dubla-validare): admin.schemas.ts:60,66,73,81 (`updatePenaltyRuleSchema`, `upsertCreditPackageSchema`, `updatePlanSchema`, `updateThresholdSchema`); billing.schemas.ts:6,11; chat.schemas.ts:10 (`sendMessageSchema`); claims-lifecycle.schemas.ts:12,24,31,36; company.schemas.ts:34,41,51,57,62,69,74; inspiration.schemas.ts:12; marketplace.schemas.ts:19,26; quote.schemas.ts:49,59,67,74,81,88,99,107; request.schemas.ts:150 (`requestDraftPatchSchema`), 210 (`presignUploadSchema`); reviews.schemas.ts:6,13. `requestContentSchema` (request.schemas.ts:103) e viu doar ca baza pentru `configuratorContentSchema.omit(...)` — formularul "clasic" pe care il descrie nu mai exista.

### error codes (definite in packages/shared/src/error-codes.ts, 0 `throw`/`code:` in apps/backend/src)
- :17 `SESSION_SUPERSEDED` — login nou revoca familia veche (`auth.service.ts:152`), dispozitivul vechi primeste `REFRESH_TOKEN_INVALID`
- :35 `REQUEST_EXPIRED` — editarea pe EXPIRED da `REQUEST_NOT_EDITABLE`
- :47 `GATING_NOT_OPEN` — vezi P1 (ar trebui aruncat, nu sters)
- :52 `ASSIGNED_USER_PENALTY_BLOCKED` — blocul pe angajat descopat
- :58 `WITHDRAWAL_GRACE_EXPIRED` — retragerea voluntara dupa 30 min nu e refuzata, ci penalizata (Î18), deci codul nu are sens
- :77-78 `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED` — limitele sunt in DTO (`@Max`, `@IsIn`) → `VALIDATION_ERROR`
- :85 `SLA_ALREADY_BREACHED`
- :93 `CREDITS_EXPIRED` — expirarea creditelor la 3 luni dupa abonament (4.16) nu e implementata (vezi intrebari PO)
- :105 `AUDIT_LOG_IMMUTABLE` — trigger-ul DB arunca exceptie Postgres, nu e mapata pe cod
- :106 `ADMIN_DECISION_REQUIRED_FIELDS` — validarea e in DTO
(mapate in FE desi moarte: `ASSIGNED_USER_PENALTY_BLOCKED` in Marketplace — chei i18n moarte in en/ro.json)

### enum values (definite in schema.prisma + enums.ts, niciodata scrise de cod; doar default sau deloc)
- `RequestStatus.IN_EXECUTION` (schema:65) — citit in `fulfillment.service.ts:32` si in lista `OFFER_LOCKED_STATUSES`, dar nicio tranzitie nu il seteaza (ACCEPTED → DELIVERED_BY_COMPANY direct)
- `SubscriptionStatus.EXPIRED`, `SubscriptionStatus.CANCELLED` (schema:182-187) — 0 scrieri; expirarea e `expiresAt > now()`
- `QuoteStatus.DRAFT` (schema:296) — default, dar `quote.create` scrie direct `SENT` (quotes.service.ts:130)
- `AttachmentStatus.PENDING_SCAN` (schema:158) — scan-ul mock trece direct PENDING_UPLOAD → SAFE/BLOCKED (uploads.service.ts:96-99)
- `PhysicalConsultationInviteStatus.COMPLETED` (schema:321) — doar ACCEPTED/DECLINED/EXPIRED se scriu
- `PenaltyScope.EMPLOYEE` (schema:239) — 0 aparitii in BE/FE
- `CompanyStatus.PENDING_VERIFICATION` — doar ca `@default`; ok (nu e de sters, doar nota ca nu e scris explicit)
- `ChatThreadType.CLAIM` — doar default; ok
(Recomandare: nu sterge din enum-ul Postgres — `ALTER TYPE DROP VALUE` nu exista — dar marcheaza in docs/04 ca "rezervat" sau implementeaza tranzitiile: IN_EXECUTION la inceperea executiei, EXPIRED la expirarea abonamentului printr-un job.)

### modele
- niciunul complet nefolosit. `RequestRoomItem` (schema:716) nu apare ca `prisma.requestRoomItem` (0) — e scris exclusiv prin nested `items: { create }` (requests.service.ts:825) si citit prin `include: { items: true }`; ok.

### coloane (niciodata scrise SI niciodata citite in apps/backend/src)
- schema:340 `users.anonymized_at` — 0 referinte (vezi P1 GDPR)
- schema:777 `project_size_thresholds.credit_cost` — scris de admin, citit de nimeni pentru cost (vezi P1)
- schema:1089 `quote_validity_extensions.extended_at` — doar default, niciodata citit (ok, audit)
- scrise dar niciodata citite (candidat de documentat, nu de sters): `users.two_factor_secret` (2FA off, Î10), `subscriptions.trial_ends_at` (scris in subscriptions.service.ts:52, nicio citire), `mock_billing_orders.payment_source`, `idempotency_keys.response_status` (salvat, nefolosit la replay), `audit_logs.ip_hash`, `companies.suspended_at` (doar `suspended_until` e citit), `refresh_tokens.rotated_from_id`/`replaced_at` (doar scrise), `company_verification_profiles.decision_note`, `claim_slots.project_score_snapshot` (scris la claim, necitit), `request_versions.snapshot` (scris la fiecare editare, niciodata citit — istoricul nu are UI).
- chei `system_settings` seed-uite si necitite: `employee_penalty_threshold`, `employee_block_months` (seed.ts:159-160).

## INTREBARI PENTRU PO

1. Stergerea cererii de catre client (Î17): dupa fix-ul P0, ce status primeste cererea stearsa — ramane IN_MARKETPLACE + deleted_at (ascunsa peste tot) sau un status terminal vizibil in admin?
2. GDPR/3.12: intra in MVP stergerea/anonimizarea contului (user + firma)? Azi nu exista niciun flux; `users.anonymized_at`/`deleted_at` nu sunt scrise niciodata. Daca nu intra, marcam explicit invarianta ca "post-MVP".
3. Abonament cumparat in timpul unuia activ: se prelungeste (zilele ramase se pastreaza) sau il inlocuieste? Azi il inlocuieste silentios si clientul pierde zilele ramase; statusurile EXPIRED/CANCELLED nu sunt folosite.
4. 4.16 "creditele raman valabile 3 luni dupa EXPIRED": nu e implementata nicio expirare a creditelor (`CREDITS_EXPIRED` mort, nu exista job). Confirmam ca e post-MVP?
5. `project_size_thresholds.credit_cost` (D-v6-5, "1/2/4 credite configurabil din Admin") vs regula r5 "1 credit = 1.000 lei din bugetul minim": scoatem campul din consola admin si actualizam docs/07? Praguri S/M/L raman doar pentru SLA.
6. `RequestStatus.IN_EXECUTION`: exista vreun moment in flux in care firma "incepe executia" (buton) sau ACCEPTED → DELIVERED_BY_COMPANY direct e definitiv? Daca e definitiv, il marcam rezervat in docs/04.
7. Penalizari angajat (D-v6-6, 9 puncte/3 luni): confirmam descoparea si actualizam docs/07 + scoatem cheile din seed?
8. Decizie arhitecturala shared: pastram schemele zod ca sursa unica (si le folosim in NestJS) sau le reducem la tipuri + 4 scheme FE? (impact: ~25 scheme + ~20 tipuri de sters sau de conectat)
9. `request_versions.snapshot` se scrie la fiecare editare dar nu exista niciun ecran de istoric — il pastram pentru audit (documentat) sau il scoatem?
10. FK-urile lipsa (`requests.client_user_id`, `notifications.user_id`, coloanele `*_user_id` de actor): vrem integritate referentiala in DB (cu SetNull/Restrict) sau raman referinte "soft" documentate?

## ANEXA: matricea ERROR_CODES

Legenda: "Aruncat BE" = numar aparitii `ERROR_CODES.X` / `code: 'X'` in apps/backend/src (fara .spec); "i18n FE" = namespace-urile din `messages/en.json` care contin `apiErrors.X` (RO identic cu EN pentru toate — coloana RO=EN); "Doc" = prezent in docs/ERROR_CODES.md.

| Cod | Aruncat BE (occ) | Fisiere BE | i18n FE (namespace-uri apiErrors) | RO=EN | Doc ERROR_CODES.md | Verdict |
|---|---|---|---|---|---|---|
| VALIDATION_ERROR | 17 | ~/filters/all-exceptions.filter.ts<br>~/idempotency/idempotency.interceptor.ts<br>billing/payments.controller.ts (+4) | Auth, Company, Requests, Marketplace, Quotes, Lifecycle | da | da | ok |
| UNAUTHORIZED | 5 | ~/filters/all-exceptions.filter.ts<br>auth/auth.service.ts<br>auth/guards/jwt-auth.guard.ts (+1) | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| FORBIDDEN | 22 | ~/filters/all-exceptions.filter.ts<br>~/guards/company-approved.guard.ts<br>~/guards/subscription-active.guard.ts (+10) | Company, Marketplace, Quotes | da | da | ok |
| NOT_FOUND | 56 | ~/filters/all-exceptions.filter.ts<br>~/guards/company-approved.guard.ts<br>admin/admin.service.ts (+16) | Company, Quotes | da | da | ok |
| RATE_LIMITED | 1 | ~/filters/all-exceptions.filter.ts | Auth | da | da | ok |
| IDEMPOTENCY_CONFLICT | 1 | ~/idempotency/idempotency.interceptor.ts | Marketplace, Quotes | da | da | ok |
| INTERNAL_ERROR | 2 | ~/filters/all-exceptions.filter.ts | Auth, Company, Requests, Marketplace, Quotes, Lifecycle | da | da | ok |
| INVALID_CREDENTIALS | 1 | auth/auth.service.ts | Auth | da | da | ok |
| EMAIL_ALREADY_REGISTERED | 1 | auth/auth.service.ts | Auth | da | da | ok |
| EMAIL_NOT_VERIFIED | 1 | auth/auth.service.ts | Auth | da | da | ok |
| REFRESH_TOKEN_INVALID | 2 | auth/auth.controller.ts<br>auth/token.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| REFRESH_TOKEN_REUSED | 1 | auth/token.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| SESSION_SUPERSEDED | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| TWO_FACTOR_REQUIRED | 1 | auth/auth.service.ts | Auth | da | da | ok |
| TWO_FACTOR_INVALID_CODE | 2 | auth/auth.service.ts<br>auth/two-factor.service.ts | Auth | da | da | ok |
| COMPANY_NOT_APPROVED | 1 | ~/guards/company-approved.guard.ts | Marketplace | da | da | ok |
| COMPANY_SUSPENDED | 1 | ~/guards/company-approved.guard.ts | Marketplace | da | da | ok |
| COMPANY_REAPPLY_BLOCKED | 1 | companies/companies.service.ts | Company | da | da | ok |
| CUI_ALREADY_REGISTERED | 1 | companies/companies.service.ts | Company | da | da | ok |
| MEMBER_ALREADY_EXISTS | 2 | companies/companies.service.ts | Company | da | da | ok |
| LAST_OWNER_CANNOT_LEAVE | 2 | companies/companies.service.ts | Company | da | da | ok |
| DRAFT_TOKEN_INVALID | 1 | requests/requests.service.ts | Requests | da | da | ok |
| REQUEST_NOT_EDITABLE | 6 | requests/requests.service.ts | Requests | da | da | ok |
| EDIT_LIMIT_PRE_CLAIM_REACHED | 1 | requests/requests.service.ts | Requests | da | da | ok |
| EDIT_LIMIT_POST_CLAIM_REACHED | 1 | requests/requests.service.ts | Requests | da | da | ok |
| EDIT_BLOCKED_OFFER_RECEIVED | 1 | requests/requests.service.ts | Requests | da | da | ok |
| REQUEST_EXPIRED | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| REPOST_ALREADY_USED | 1 | requests/requests.service.ts | Requests | da | da | ok |
| GEOCODING_FAILED | 1 | geo/geo.service.ts | Requests, Configurator | da | da | ok |
| CONFIGURATOR_ANSWERS_INVALID | 1 | requests/configurator.service.ts | Configurator | da | NU | ok; nedocumentat |
| CONFIGURATOR_FLOW_VERSION_UNSUPPORTED | 1 | requests/configurator.service.ts | Configurator | da | NU | ok; nedocumentat |
| CONFIGURATOR_STATE_TOO_LARGE | 1 | requests/requests.service.ts | Configurator | da | NU | ok; nedocumentat |
| CLAIM_NOT_ALLOWED | 4 | claims/claims.service.ts<br>claims/clarifications.service.ts | Marketplace, Lifecycle | da | da | ok |
| CLAIM_SLOTS_FULL | 1 | claims/claims.service.ts | Marketplace | da | da | ok |
| INSUFFICIENT_CREDITS | 1 | billing/credits.service.ts | Marketplace (+ text dedicat marketplace/[id]) | da | da | ok |
| SUBSCRIPTION_INACTIVE | 1 | ~/guards/subscription-active.guard.ts | Marketplace | da | da | ok |
| OUT_OF_COVERAGE_AREA | 1 | claims/claims.service.ts | Marketplace | da | da | ok |
| GATING_NOT_OPEN | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| COMPANY_EXCLUDED_FROM_REQUEST | 1 | claims/claims.service.ts | Marketplace | da | da | ok |
| ACTIVE_CLAIM_WITHOUT_OFFER_EXISTS | 2 | claims/claims.service.ts | Marketplace | da | da | ok |
| MANAGER_UNASSIGNED_CAP_REACHED | 1 | claims/claims.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| ASSIGNED_USER_HAS_ACTIVE_CLAIM | 3 | claims/claims.service.ts | Marketplace | da | da | ok |
| ASSIGNED_USER_PENALTY_BLOCKED | 0 |  | Marketplace | da | da | MORT (definit, niciodata aruncat) |
| CLAIM_ALREADY_EXISTS | 2 | claims/claims.service.ts | Marketplace | da | da | ok |
| WITHDRAWAL_REASON_NOT_VALIDATED | 2 | claims/withdrawals.service.ts | Lifecycle | da | da | ok |
| WITHDRAWAL_ALREADY_PENDING | 1 | claims/withdrawals.service.ts | Lifecycle | da | da | ok |
| WITHDRAWAL_GRACE_EXPIRED | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| WITHDRAWAL_ALREADY_DECIDED | 1 | claims/withdrawals.service.ts | - | da | NU | aruncat, FARA mesaj FE → fallback generic; nedocumentat |
| CLAIM_NOT_WITHDRAWABLE | 1 | claims/withdrawals.service.ts | Lifecycle | da | NU | ok; nedocumentat |
| REQUEST_NOT_DELETABLE | 1 | requests/requests.service.ts | - | da | NU | aruncat, FARA mesaj FE → fallback generic; nedocumentat |
| QUOTE_VERSION_LIMIT_REACHED | 3 | quotes/quotes.service.ts | Quotes | da | da | ok |
| QUOTE_ALREADY_SENT | 1 | quotes/quotes.service.ts | Quotes | da | NU | ok; nedocumentat |
| CHANGE_REQUEST_ALREADY_REJECTED | 1 | quotes/quotes.service.ts | Quotes | da | da | ok |
| CHANGE_REQUEST_NOT_PENDING | 2 | quotes/quotes.service.ts | Quotes | da | NU | ok; nedocumentat |
| QUOTE_EXPIRED | 1 | quotes/quotes.service.ts | Quotes | da | da | ok |
| QUOTE_WITHDRAW_WINDOW_CLOSED | 1 | quotes/quotes.service.ts | Quotes | da | da | ok |
| VALIDITY_EXTENSION_LIMIT_REACHED | 1 | quotes/quotes.service.ts | Quotes | da | da | ok |
| OFFER_FIELD_NOT_EDITABLE | 1 | quotes/quotes.service.ts | Quotes | da | da | ok |
| CONSULTATION_INVITE_EXPIRED | 1 | quotes/quotes.service.ts | Quotes | da | da | ok |
| NEGOTIATION_ENDED | 1 | quotes/quotes.service.ts | Quotes | da | da | ok |
| QUOTE_ACCEPT_NOT_ALLOWED | 4 | quotes/quotes.service.ts | Quotes | da | da | ok |
| THREAD_READ_ONLY | 2 | chat/chat.service.ts | Quotes | da | da | ok |
| FILE_TOO_LARGE | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| FILE_LIMIT_REACHED | 2 | chat/chat.service.ts<br>uploads/uploads.service.ts | Requests | da | da | ok |
| FILE_TYPE_NOT_ALLOWED | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| FILE_SCAN_BLOCKED | 2 | requests/requests.service.ts<br>uploads/uploads.service.ts | Configurator | da | da | ok |
| UPLOAD_NOT_FOUND_IN_STORAGE | 1 | uploads/uploads.service.ts | Requests | da | da | ok |
| CLARIFICATION_ALREADY_PENDING | 1 | claims/clarifications.service.ts | Lifecycle | da | da | ok |
| SLA_ALREADY_BREACHED | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| PAYMENT_SIGNATURE_INVALID | 1 | billing/payments.controller.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| PAYMENT_ALREADY_CONFIRMED | 1 | billing/payments.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| PAYMENT_NOT_FOUND | 2 | billing/invoice-pdf.service.ts<br>billing/payments.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| CREDIT_PACKAGE_INACTIVE | 1 | billing/payments.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| CREDITS_EXPIRED | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| DELIVERY_NOT_ALLOWED | 2 | fulfillment/fulfillment.service.ts | - | da | NU | aruncat, FARA mesaj FE → fallback generic; nedocumentat |
| COMPLETION_NOT_ALLOWED | 1 | fulfillment/fulfillment.service.ts | - | da | NU | aruncat, FARA mesaj FE → fallback generic; nedocumentat |
| REVIEW_NOT_ALLOWED_YET | 2 | fulfillment/fulfillment.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| REVIEW_ALREADY_SUBMITTED | 1 | fulfillment/fulfillment.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| DISPUTE_ALREADY_DECIDED | 1 | fulfillment/fulfillment.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| SETTING_KEY_UNKNOWN | 1 | admin/admin.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| AUDIT_LOG_IMMUTABLE | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| ADMIN_DECISION_REQUIRED_FIELDS | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| BOARD_NAME_TAKEN | 1 | inspiration/boards.service.ts | - (cod tratat direct (boards/page, board-picker)) | da | NU | ok; nedocumentat |
| STUDIO_DRAFT_NAME_TAKEN | 1 | studio/studio.service.ts | - (cod tratat direct (studio-page toast)) | da | NU | ok; nedocumentat |
| STUDIO_DRAFT_LIMIT_REACHED | 1 | studio/studio.service.ts | - (cod tratat direct (studio-page toast)) | da | NU | ok; nedocumentat |
| STUDIO_DRAFT_INVALID | 1 | studio/studio.service.ts | - | da | NU | aruncat, FARA mesaj FE → fallback generic; nedocumentat |
| STUDIO_DRAFT_TOO_LARGE | 1 | studio/studio.service.ts | - | da | NU | aruncat, FARA mesaj FE → fallback generic; nedocumentat |

Sumar matrice: 88 coduri definite; 77 aruncate; 11 moarte; 57 mapate i18n (EN=RO); 31 aruncate fara mesaj (8 user-facing, restul admin/auth intern); 15 nedocumentate; 0 coduri aruncate in BE care lipsesc din shared; 0 chei i18n orfane (in afara de `GENERIC`, fallback intentionat).
