# Plan Sprint 76 (plan 2026-09-28): Collections into requests (P3)

- **Pachet**: E-client-34 — clientul ataseaza o colectie intreaga la cerere, cu notita si camera per poza; firma vede inspiratia grupata pe camere; o poza se salveaza in mai multe colectii.
- **Finding acoperit**: R2-INSPO-ADMIN-11 (P3, business).
- **Estimare**: ~4 zile-dev (vezi ordinea pasilor, fiecare pas are estimarea lui).
- **Ruleaza DUPA Sprint 75** (E-admin-platform-57): pickerul, SaveButton-ul si vederea firmei folosesc primitivele noi (`Card`, `Skeleton`, `EmptyState`, `FilterChips`, `Popover`). Detalii in sectiunea 7.
- **Dependinta declarata `E-client-20`**: NU face parte din cele 32 de pachete aprobate (nu exista in `approved-plan.json` ca pachet); nu blocheaza. Sprintul se bazeaza doar pe codul curent din working tree.
- **DECIZIE NECESARA**: niciuna blocanta (pachetul nu are decizie PO deschisa). Doua presupuneri de produs sunt marcate explicit mai jos (P3, P5) si pot fi inversate dintr-o linie fiecare.

Toate caile sunt relative la `F:\Cozy Fable`. Citeste fisierele de pe disc (working tree), NU din `HEAD` — ~600 de fisiere sunt necomise si sunt produsul.

---

## 1. Obiectiv

1. `inspiration_board_items` primeste `note` (max 200) + `room_type` (camera pentru care clientul a salvat ideea); `request_inspiration_photos` primeste `note` (max 200) + `request_room_id` (FK catre camera cererii).
2. In configurator, tabul „Colectiile mele" din picker are butonul **„Adaugă toată colecția"** care adauga pozele colectiei pana la plafonul de 10, preia notitele si sugereaza camera.
3. Fiecare poza aleasa in formular are camp de notita („Ce iti place la poza asta?") si selector „Pentru camera"; ambele pleaca la publish/edit si sunt persistate.
4. Firma vede inspiratia **grupata pe camere**, cu notita clientului (mascata cand firma nu are acces la contacte), in marketplace (pre-claim) si pe fisa de lucru (post-claim); clientul vede aceeasi grupare pe detaliul cererii lui.
5. Butonul „Salvează" din galerie devine o lista de colectii cu bife: o poza se salveaza in mai multe colectii deodata.

„Done when" (din pachet):
- DW1: Pickerul ofera „Adaugă toată colecția" si pastreaza notitele.
- DW2: Vederea firmei a unei cereri arata notitele pozelor grupate pe camere.
- DW3: O poza poate fi salvata in doua colectii deodata.

In afara scopului (mentionat in finding, NU in pasii pachetului): link public read-only de partajare a colectiei (share token) — ridica intrebari de confidentialitate, ramane pentru triajul PO; ordinea pozelor in cerere (fara coloana `position`); numele colectiei nu se copiaza pe cerere.

## 2. Module si tabele afectate

| Zona | Module / fisiere | Tabele |
|---|---|---|
| Backend | `modules/requests` (publish, edit, screening, toDto), `modules/inspiration` (boards: detail, patch item, move), `modules/marketplace` (detaliu pre-claim), `modules/quotes` (claim context) | `request_inspiration_photos` (W: coloane noi), `inspiration_board_items` (W: coloane noi), `request_rooms` (R, FK nou tinta), `request_contact_detections` (W: valoare noua `PHOTO_NOTE` in coloana `field`) |
| Shared | `inspiration.schemas.ts`, `request.schemas.ts`, `marketplace.schemas.ts`, `quote.schemas.ts`, `contact-detection.ts` | — |
| Frontend | configurator (picker, store, review, wizard), vederea inspiratiei pe cerere (client/firma), galeria `/inspiration` (SaveButton, pin, lightbox, board picker, detaliu colectie), i18n | — |
| Docs | `docs/04-data-model.md`, `CHANGELOG.md` | — |

## 3. Presupuneri

- **P1 (schema)**: legatura „camera" pe o poza din cerere = FK `request_room_id` catre `request_rooms.id`, `ON DELETE SET NULL`. Este singura legatura stabila: `writeRooms` pastreaza id-ul camerelor la editare (`sourceLocalId` = id-ul existent) si intoarce harta `sourceLocalId → id` persistat (acelasi mecanism ca scenele Studio in `resolvePublicationScenes`).
- **P2 (schema)**: pe `inspiration_board_items` „camera" NU poate fi o camera de cerere (colectiile nu sunt legate de cereri) → este un `room_type` optional (enumul existent `room_type`). La „Adaugă toată colecția" se foloseste `item.roomType ?? photo.roomType` doar ca **sugestie**: se leaga automat numai daca in formular exista EXACT o camera de acel tip; altfel ramane „Toata locuinta / nespecificat" si clientul alege.
- **P3 (produs, reversibil)**: notitele sunt text liber scris de client → trec prin acelasi regim ca „Mesaj pentru firme" (E-admin-platform-45): screening la publish/edit (politica `pre_claim_contact_text_policy`, MASK implicit / BLOCK), mascare MEREU in marketplace pre-claim (ca `description`), text brut pe fisa de lucru doar cand `access.clientVisible`, altfel mascat. Deci firma vede gruparea si notitele mascate si inainte de preluare, exact ca descrierea. Varianta mai restrictiva (notite doar post-claim) = o linie in `marketplace.service.ts` (`note: null`).
- **P4 (contract API)**: payloadul de publish/edit primeste campul nou `inspirationPhotos: { photoId, note?, roomLocalId? }[]` (max 10). `inspirationPhotoIds` ramane acceptat (bundle vechi deschis in browser in timpul deploy-ului). Ambele trimise simultan = 400 `VALIDATION_ERROR`. Niciunul = randurile existente raman neatinse (comportamentul de azi la edit).
- **P5 (produs, reversibil)**: modificarea notitelor/camerelor pe o cerere publicata trece prin editarea completa a cererii si consuma o editare (3 pre-claim / 1 post-claim), exact ca schimbarea pozelor azi. Fara endpoint separat de „editeaza doar notita" pe cerere.
- **P6**: notitele din colectii sunt private (doar proprietarul colectiei le vede) → fara screening la salvare in colectie; screening-ul se face cand ajung pe cerere (publish/edit).
- **P7**: plafonul ramane 10 poze per cerere (docs/04: „max 10"); devine constanta partajata `MAX_REQUEST_INSPIRATION_PHOTOS`.
- **P8**: nicio schimbare de realtime, outbox sau audit: publish/edit emit deja `request.status_changed`; colectiile nu sunt auditate azi.

## 4. Impact

- **Backend**: DTO nou pe publish/edit; helper pur nou `requests/inspiration-selection.ts`; screening extins la notite; `writeInspirationPhotos` scrie note + camera din harta `roomIds`; `toDto` / marketplace / claim context expun `inspirationPhotos`; boards: `detail` intoarce meta per salvare, `PATCH /inspiration/boards/:id/items/:photoId` nou, `moveItem` muta si notita.
- **Frontend**: store cu `inspirationMeta`; picker cu „Adaugă toată colecția", carduri cu notita + camera; review trimite `inspirationPhotos`; componenta noua `RequestInspirationByRoom` inlocuieste `RequestInspirationStrip` pe cele 3 pagini; SaveButton multi-colectie cu bife; editor de notita pe detaliul colectiei.
- **DB**: 1 migrare aditiva (4 coloane nullable, 1 index, 1 FK). Fara backfill.
- **Realtime**: niciunul.
- **Securitate**: invarianta 4.2 (fara contacte pre-claim) se extinde la notite (screening + mascare); ownership pe `PATCH` item (requireOwned); `roomLocalId` validat contra camerelor cererii (nu se poate lega o camera straina — harta vine din `writeRooms` pe acelasi `requestId`); validare lungime 200 in class-validator + zod + `VARCHAR(200)`.
- **Audit**: fara `@Audit` nou (colectiile nu sunt auditate); randurile `request_contact_detections` primesc `field = 'PHOTO_NOTE'`.
- **Blue/green**: coloanele noi sunt ignorate de imaginea veche; la rollback, o editare prin imaginea veche rescrie `request_inspiration_photos` fara notite (pierdere acceptata, documentata in SQL). Un bundle FE nou lovind un API vechi (rollback cu tab deschis) ar primi 400 pe `inspirationPhotos` (`forbidNonWhitelisted`) — acceptat, fereastra e scurta si imaginea e combinata FE+BE.

## 5. Migrare Prisma

Reguli: skill `.claude/skills/prisma-migration` + Codex `50 Impact/IMPACT schema Prisma.md`. `prisma migrate dev` nu are TTY → folder manual.

### 5.1 `apps/backend/prisma/schema.prisma`

```prisma
// Pozele din galerie alese de client ca inspiratie pe o cerere (F6, item 3).
// E-client-34: notita clientului (max 200, text liber → screening + mascare ca descrierea)
// si camera cererii careia ii e destinata poza (SET NULL cand camera dispare la editare).
model RequestInspirationPhoto {
  requestId     String  @map("request_id")
  photoId       String  @map("photo_id")
  note          String? @db.VarChar(200)
  requestRoomId String? @map("request_room_id")

  request Request          @relation(fields: [requestId], references: [id], onDelete: Cascade)
  photo   InspirationPhoto @relation(fields: [photoId], references: [id], onDelete: Cascade)
  room    RequestRoom?     @relation(fields: [requestRoomId], references: [id], onDelete: SetNull)

  @@id([requestId, photoId])
  @@index([photoId])
  @@index([requestRoomId])
  @@map("request_inspiration_photos")
}

model InspirationBoardItem {
  boardId   String    @map("board_id")
  photoId   String    @map("photo_id")
  // E-client-34: notita privata a utilizatorului + camera pentru care a salvat ideea
  note      String?   @db.VarChar(200)
  roomType  RoomType? @map("room_type")
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz()
  // relatii + @@id/@@index/@@map neschimbate
}

model RequestRoom {
  // ... campuri existente ...
  inspirationPhotos RequestInspirationPhoto[]   // relatia inversa noua
}
```

### 5.2 Migrarea `apps/backend/prisma/migrations/20261001070000_inspiration_notes_room_links/migration.sql`

Inainte: `ls apps/backend/prisma/migrations | tail -3` — ultima azi e `20261001060000_plans_as_data`; daca Sprint 75 sau altcineva a adaugat una mai noua, alege un timestamp strict mai mare.

```sql
-- E-client-34 (Sprint 76): notite + camera pe salvarile din colectii si pe pozele de
-- inspiratie ale cererii. Aditiv (expand): coloane nullable, fara backfill; randurile vechi
-- raman NULL si codul le trateaza ca „fara notita / toata locuinta".
-- Blue/green: imaginea veche ignora coloanele. O editare de cerere facuta prin imaginea veche
-- (rollback) rescrie request_inspiration_photos fara notite/camere — pierdere acceptata.
--
-- Rollback (in ordine):
--   1. Redeploy imaginea anterioara pe ambele sloturi (nu mai citeste/scrie coloanele).
--   2. ALTER TABLE "request_inspiration_photos" DROP CONSTRAINT "request_inspiration_photos_request_room_id_fkey";
--      DROP INDEX "request_inspiration_photos_request_room_id_idx";
--      ALTER TABLE "request_inspiration_photos" DROP COLUMN "request_room_id", DROP COLUMN "note";
--   3. ALTER TABLE "inspiration_board_items" DROP COLUMN "room_type", DROP COLUMN "note";

ALTER TABLE "inspiration_board_items"
  ADD COLUMN "note" VARCHAR(200),
  ADD COLUMN "room_type" "room_type";

ALTER TABLE "request_inspiration_photos"
  ADD COLUMN "note" VARCHAR(200),
  ADD COLUMN "request_room_id" TEXT;

CREATE INDEX "request_inspiration_photos_request_room_id_idx"
  ON "request_inspiration_photos"("request_room_id");

ALTER TABLE "request_inspiration_photos"
  ADD CONSTRAINT "request_inspiration_photos_request_room_id_fkey"
  FOREIGN KEY ("request_room_id") REFERENCES "request_rooms"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

Verificare: `pnpm -F backend exec prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <url shadow local>` trebuie sa iasa gol dupa ce folderul exista (numele constrangerii/indexului generate de Prisma trebuie sa coincida cu cele din SQL; daca difera, aliniaza SQL-ul la ce genereaza diff-ul). Apoi `pnpm -F backend prisma migrate deploy` + `pnpm -F backend exec prisma generate` (cu `nest --watch` oprit — EPERM pe Windows la dll).

Nota: `VARCHAR(200)` numara code points; limita JS (`string.length`, UTF-16) e >= numarul de code points, deci ce trece de validarea JS intra mereu in coloana.

## 6. Contracte (shared + backend DTO)

### 6.1 `packages/shared/src/inspiration.schemas.ts`

```ts
// E-client-34: plafoane comune (FE picker/store, zod, class-validator, VARCHAR(200))
export const INSPIRATION_NOTE_MAX = 200;
export const MAX_REQUEST_INSPIRATION_PHOTOS = 10;

// PATCH /inspiration/boards/:id/items/:photoId — cel putin un camp; null = sterge
export const boardItemMetaSchema = z
  .object({
    note: z.string().trim().max(INSPIRATION_NOTE_MAX, 'inspirationNoteTooLong').nullable().optional(),
    roomType: z.enum(ROOM_TYPES).nullable().optional(),
  })
  .refine((v) => v.note !== undefined || v.roomType !== undefined, 'emptyPatch');
export type BoardItemMetaInput = z.infer<typeof boardItemMetaSchema>;

export interface InspirationBoardItemMetaDto {
  photoId: string;
  note: string | null;
  roomType: (typeof ROOM_TYPES)[number] | null;
}

export interface InspirationBoardDetailDto extends InspirationBoardDto {
  photos: InspirationPhotoDto[];
  // E-client-34: meta per salvare (aceeasi multime ca photos, cheie photoId)
  items: InspirationBoardItemMetaDto[];
}
```
`InspirationSaveDto` ramane `{ photoId, boardId }` (randuri multiple per poza sunt deja posibile). Actualizeaza comentariul „photoId → boardId" in „o intrare per (poza, colectie)".

### 6.2 `packages/shared/src/request.schemas.ts`

```ts
import { INSPIRATION_NOTE_MAX, MAX_REQUEST_INSPIRATION_PHOTOS } from './inspiration.schemas';

// E-client-34: o poza de inspiratie pe cerere, cu notita si camera (localId-ul camerei din
// configurator; la editare = id-ul camerei persistate). Serverul o traduce in request_room_id.
export const requestInspirationPhotoInputSchema = z.object({
  photoId: z.string().uuid(),
  note: z.string().trim().max(INSPIRATION_NOTE_MAX, 'inspirationNoteTooLong').optional(),
  roomLocalId: z.string().min(1).max(60).optional(),
});
export type RequestInspirationPhotoInput = z.infer<typeof requestInspirationPhotoInputSchema>;

// in configuratorContentSchema.extend({...}):
inspirationPhotoIds: z.array(z.string().uuid()).max(MAX_REQUEST_INSPIRATION_PHOTOS).optional(),
inspirationPhotos: z
  .array(requestInspirationPhotoInputSchema)
  .max(MAX_REQUEST_INSPIRATION_PHOTOS)
  .refine((list) => new Set(list.map((p) => p.photoId)).size === list.length, 'inspirationDuplicate')
  .optional(),

// DTO de raspuns
export interface RequestInspirationPhotoDto {
  photoId: string;
  // text brut pentru proprietar; mascat (CONTACT_MASK_TOKEN) pentru firme fara acces la contacte
  note: string | null;
  // camera cererii (RequestRoomDto.id); null = toata locuinta / nespecificat
  requestRoomId: string | null;
}
// RequestDto: pastreaza inspirationPhotoIds si adauga:
inspirationPhotos: RequestInspirationPhotoDto[];
```
Adauga un `.superRefine` pe `configuratorContentSchema` (sau verificare in FE inainte de payload) ca `inspirationPhotoIds` si `inspirationPhotos` sa nu vina impreuna — sau lasa doar verificarea din backend (P4) si ai grija ca FE sa trimita doar `inspirationPhotos`. Recomandat: doar backend (schema FE ramane simpla).

### 6.3 `packages/shared/src/marketplace.schemas.ts` si `quote.schemas.ts`

- `MarketplaceDetailDto`: `inspirationPhotos: RequestInspirationPhotoDto[];` (langa `inspirationPhotoIds`, pastrat).
- `ClaimRequestDetailDto` (`quote.schemas.ts` ~l.215): idem.
- Import `RequestInspirationPhotoDto` din `./request.schemas` (verifica importurile existente pentru `RequestRoomDto`).

### 6.4 `packages/shared/src/contact-detection.ts`

`CONTACT_DETECTION_FIELDS = ['TITLE', 'DESCRIPTION', 'ANSWER', 'PHOTO_NOTE'] as const;` (`PHOTO_NOTE` = 10 caractere, incape in `VARCHAR(16)`; fara enum Postgres, validat in aplicatie).

### 6.5 Backend class-validator

`apps/backend/src/modules/requests/dto/request.dto.ts`:
```ts
// E-client-34: poza de inspiratie cu notita + camera (validarea camerei: in service)
export class RequestInspirationPhotoInputDto {
  @IsUUID('4')
  photoId: string;

  @IsOptional()
  @IsString()
  @MaxLength(INSPIRATION_NOTE_MAX)
  note?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  roomLocalId?: string;
}
// in CreateRequestContentDto:
@IsOptional() @IsArray() @ArrayMaxSize(MAX_REQUEST_INSPIRATION_PHOTOS) @IsUUID('4', { each: true })
inspirationPhotoIds?: string[];          // ArrayMaxSize(10) → constanta

@IsOptional() @IsArray() @ArrayMaxSize(MAX_REQUEST_INSPIRATION_PHOTOS)
@ValidateNested({ each: true }) @Type(() => RequestInspirationPhotoInputDto)
inspirationPhotos?: RequestInspirationPhotoInputDto[];
```
(`forbidNonWhitelisted: true` e global → fiecare proprietate a clasei nested trebuie decorata.)

`apps/backend/src/modules/inspiration/dto/inspiration.dto.ts`:
```ts
// E-client-34: notita/camera unei salvari; null sterge valoarea (IsOptional accepta null)
export class BoardItemMetaDto {
  @IsOptional() @IsString() @MaxLength(INSPIRATION_NOTE_MAX)
  note?: string | null;

  @IsOptional() @IsEnum(RoomType)
  roomType?: RoomType | null;
}
```

## 7. Primitivele din Sprint 75 folosite (precondite)

Precondite (pasul 0): exista `apps/frontend/src/components/ui/{card,skeleton,empty-state,filter-chips,popover}.tsx`. Daca lipsesc, Sprint 75 nu e inchis → STOP, nu incepe 76. Citeste API-ul real exportat de fiecare fisier inainte de folosire (numele exacte ale subcomponentelor pot diferi de mai jos).

| Primitiva (Sprint 75) | Unde o foloseste Sprint 76 |
|---|---|
| `ui/card` (`Card`, `CardBody`...) | cardurile pozelor alese in picker (poza + notita + camera); cardurile din `RequestInspirationByRoom` |
| `ui/skeleton` (+ preset grila) | incarcarea grilelor din picker (galerie, colectii, detaliu colectie) in locul `…`; incarcarea `RequestInspirationByRoom`; incarcarea detaliului colectiei |
| `ui/empty-state` | galerie goala / nicio colectie / colectie goala in picker |
| `ui/filter-chips` | filtrul pe tip de camera din tabul Galerie al pickerului (daca Sprint 75 l-a migrat deja — UI1-22 il listeaza — doar pastreaza-l) |
| `ui/popover` | SaveButton multi-colectie; meniul „Mută" si editorul de notita pe `/inspiration/boards/[id]` (Sprint 75 migreaza deja popover-ele din save-button si board detail — UI1-23; construieste peste ele) |
| `ui/tabs` (existent) | comutarea Galerie / Colectiile mele (daca Sprint 75 a trecut-o pe Tabs, pastreaz-o) |
| `ui/textarea`, `ui/select`, `ui/button`, `ui/alert` (existente) | editorul de notita si selectorul de camera |

`BoardPicker` dupa Sprint 75 ar trebui sa fie doar continut (fara `absolute ... mt-2`), montat intr-un `PopoverContent`. Daca nu e, fa aceasta separare in pasul 9.

## 8. Fisiere de creat / modificat (exact)

### Backend

1. `apps/backend/prisma/schema.prisma` — sectiunea 5.1.
2. `apps/backend/prisma/migrations/20261001070000_inspiration_notes_room_links/migration.sql` (NOU) — sectiunea 5.2.
3. `apps/backend/src/modules/requests/dto/request.dto.ts` — `RequestInspirationPhotoInputDto`, campul `inspirationPhotos`, constantele partajate in loc de `10` (6.5).
4. `apps/backend/src/modules/requests/inspiration-selection.ts` (NOU, pur, fara Nest in afara de exceptii):
   ```ts
   export interface InspirationSelection { photoId: string; note: string | null; roomLocalId: string | null }
   // undefined = campul lipseste din payload → randurile existente raman neatinse
   export function readInspirationSelection(dto: Pick<CreateRequestContentDto, 'inspirationPhotoIds' | 'inspirationPhotos'>): InspirationSelection[] | undefined
   //  - ambele definite → BadRequest VALIDATION_ERROR 'Send either inspirationPhotoIds or inspirationPhotos'
   //  - inspirationPhotos: trim note, '' → null; roomLocalId '' → null; dedupe pe photoId (primul castiga)
   //  - inspirationPhotoIds: dedupe → { photoId, note: null, roomLocalId: null }
   export function assertInspirationRooms(selection: InspirationSelection[] | undefined, rooms: ProcessedRoom[]): void
   //  - fiecare roomLocalId non-null trebuie sa fie sourceLocalId al unei camere procesate
   //  - altfel BadRequest VALIDATION_ERROR, details: [{ field: 'inspirationPhotos', photoId, messageKey: 'validation.inspirationRoomUnknown' }]
   export function inspirationRows(requestId: string, selection: InspirationSelection[], roomIds: Map<string, string>): Prisma.RequestInspirationPhotoCreateManyInput[]
   //  - requestRoomId = roomLocalId ? roomIds.get(roomLocalId) ?? null : null
   export function inspirationNotesForScreening(selection: InspirationSelection[] | undefined, rooms: ProcessedRoom[]): { photoId: string; note: string; roomType: RoomType | null }[]
   ```
5. `apps/backend/src/modules/requests/contact-screening.ts`:
   - `ContactScreeningInput` + `inspirationNotes?: { photoId: string; note: string; roomType: RoomType | null }[]`.
   - `ContactBlockingDetail` + varianta `{ field: 'inspirationNote'; photoId: string; messageKey: string }`.
   - In `screenRequestText`, dupa camere: pentru fiecare notita `screenText(note)` → `push({ field: 'PHOTO_NOTE', roomType, stepId: null, ...hit })`; daca `hit.hideable` → `blockingDetails.push({ field: 'inspirationNote', photoId, messageKey: CONTACT_IN_TEXT_MESSAGE_KEY })`. Plafonul `MAX_CONTACT_DETECTION_ROWS` ramane.
   - Actualizeaza comentariul de sus (titlu, mesaj, raspunsuri **si notitele de inspiratie**).
6. `apps/backend/src/modules/requests/requests.service.ts`:
   - `publish` (~l.260-350) si `editRequest` (~l.358-420): `const inspirationSelection = readInspirationSelection(dto);` imediat dupa `processRooms`; `assertInspirationRooms(inspirationSelection, processed.rooms);` `await this.inspiration.assertSelectable(inspirationSelection?.map((s) => s.photoId) ?? []);` (inlocuieste apelul pe `dto.inspirationPhotoIds`).
   - `screenContacts(requestId, trigger, dto, rooms, inspirationNotes)` → paseaza `inspirationNotes: inspirationNotesForScreening(inspirationSelection, processed.rooms)` in `screenRequestText`. `toData` scrie `field: row.field` (deja generic). Actiunea pentru PHOTO_NOTE: `MASKED` (hideable) / `FLAGGED`, ca DESCRIPTION.
   - In tranzactie, `writeInspirationPhotos(tx, request.id, inspirationSelection, roomIds)` — apelul ramane DUPA `writeRooms` (are nevoie de `roomIds`). Numar constant de query-uri (deleteMany + createMany), fara round-trip-uri noi in tranzactie.
   - `writeInspirationPhotos(tx, requestId, selection: InspirationSelection[] | undefined, roomIds: Map<string,string>)`: `if (selection === undefined) return;` deleteMany; `createMany({ data: inspirationRows(requestId, selection, roomIds) })` daca non-gol.
   - `toDto`: `inspirationPhotos: { select: { photoId: true, note: true, requestRoomId: true } }`; raspuns `inspirationPhotoIds` (neschimbat) + `inspirationPhotos: request.inspirationPhotos.map((p) => ({ photoId: p.photoId, note: p.note, requestRoomId: p.requestRoomId }))` (text brut — proprietarul).
   - `writeVersion` ramane (snapshotul dto include acum notitele; versiunile nu sunt expuse firmelor — verificat: niciun citit de `requestVersion` in afara serviciului).
7. `apps/backend/src/modules/marketplace/marketplace.service.ts` (`detail`, ~l.113-135): select `{ photoId: true, note: true, requestRoomId: true }`; raspuns `inspirationPhotos: inspiration.map((p) => ({ photoId: p.photoId, note: p.note == null ? null : maskFreeText(p.note), requestRoomId: p.requestRoomId }))` — comentariu: „textele libere se mascheaza mereu in marketplace (E-admin-platform-45)".
8. `apps/backend/src/modules/quotes/quotes.service.ts`:
   - `getClaimContext` include (~l.935): `inspirationPhotos: { select: { photoId: true, note: true, requestRoomId: true } }`.
   - `detail` (~l.1047): `inspirationPhotos: req.inspirationPhotos.map((p) => ({ photoId: p.photoId, note: p.note == null ? null : text(p.note), requestRoomId: p.requestRoomId }))` (`text` = helperul existent: mascat cand `hideText`).
   - `buildLimitedClaimContext` (~l.1162): `inspirationPhotos: []`.
9. `apps/backend/src/modules/inspiration/boards.service.ts`:
   - `detail`: `items` = `items.map((i) => ({ photoId: i.photoId, note: i.note, roomType: i.roomType }))` filtrate la aceleasi poze ca `photos` (acelasi query — filtrul exista deja).
   - NOU `updateItem(userId, boardId, photoId, patch: { note?: string | null; roomType?: RoomType | null })`: `requireOwned`; daca ambele `undefined` → 400 `VALIDATION_ERROR`; `note` trim, `''` → null; `updateMany({ where: { boardId, photoId }, data })`; `count === 0` → 404 `NOT_FOUND` „Board item not found". Intoarce `InspirationBoardItemMetaDto`.
   - `moveItem`: inainte de batch citeste sursa (`findUnique({ where: { boardId_photoId: { boardId, photoId } }, select: { note: true, roomType: true } })`); upsert pe destinatie cu `create: { boardId: targetBoardId, photoId, note: source?.note ?? null, roomType: source?.roomType ?? null }`, `update: {}` (daca destinatia are deja poza, isi pastreaza notita — comentariu). Restul neschimbat (`runTxBatch`).
   - `addItem` neschimbat.
10. `apps/backend/src/modules/inspiration/inspiration.controller.ts` — in `InspirationBoardsController`:
    ```ts
    // E-client-34: notita/camera unei salvari
    @Patch(':id/items/:photoId')
    updateItem(@CurrentUser() user, @Param('id', ParseUUIDPipe) id: string, @Param('photoId', ParseUUIDPipe) photoId: string, @Body() dto: BoardItemMetaDto) {
      return this.boards.updateItem(user.sub, id, photoId, dto);
    }
    ```
    Plaseaz-o inainte de `@Delete(':id/items/:photoId')` (ordinea nu conteaza intre verbe diferite, dar tine grupul „items" impreuna).
11. `apps/backend/src/modules/inspiration/dto/inspiration.dto.ts` — `BoardItemMetaDto` (6.5).

### Shared

12. `packages/shared/src/inspiration.schemas.ts` — 6.1.
13. `packages/shared/src/request.schemas.ts` — 6.2.
14. `packages/shared/src/marketplace.schemas.ts` — 6.3.
15. `packages/shared/src/quote.schemas.ts` — 6.3.
16. `packages/shared/src/contact-detection.ts` — 6.4.
17. `packages/shared/src/request.schemas.test.ts` — teste noi (sectiunea 11).

### Frontend

18. `apps/frontend/src/stores/configurator-store.ts`:
    - Tip nou `export interface InspirationMeta { note?: string; roomLocalId?: string }`.
    - `ConfiguratorSnapshot.inspirationMeta?: Record<string, InspirationMeta>` (optional → snapshot-urile vechi raman valide); `initialSnapshot.inspirationMeta = {}`.
    - Actiuni noi:
      - `addInspirationPhotos(entries: { photoId: string; note?: string | null; roomType?: RoomType | null }[]): { added: number; skipped: number }` — ignora ce e deja ales (dar completeaza notita daca in draft e goala), adauga in ordine pana la `MAX_REQUEST_INSPIRATION_PHOTOS`, `skipped` = cate nu au mai incaput; sugestia de camera: `roomInstances.filter((r) => r.roomType === roomType)` are exact 1 element → `roomLocalId`; notita se taie la `INSPIRATION_NOTE_MAX`.
      - `setInspirationNote(photoId, note)` — `slice(0, INSPIRATION_NOTE_MAX)`; string gol → sterge cheia `note`.
      - `setInspirationRoom(photoId, roomLocalId: string | null)`.
    - `setInspirationPhotos(ids)`: `slice(0, MAX_REQUEST_INSPIRATION_PHOTOS)` in loc de `10` + curata `inspirationMeta` de id-urile scoase.
    - `removeRoom` si `removeLastOfType`: sterg `roomLocalId` din meta cand camera dispare (helper `pruneInspirationRooms(meta, roomInstances)`).
    - `normalizeSnapshot`: `inspirationMeta` sanitizat (obiect; doar chei din `inspirationPhotoIds`; `note` string taiat la 200; `roomLocalId` doar daca exista in `roomInstances`).
    - `snapshot()` si `partialize` includ `inspirationMeta`; `reset` → `{}`. Fara bump de `version` (camp optional + normalizare; merge-ul persist completeaza din initial).
19. `apps/frontend/src/components/configurator/inspiration-picker.tsx`:
    - `MAX_SELECTED` → `MAX_REQUEST_INSPIRATION_PHOTOS` din shared.
    - `toggle(photo)` primeste poza (nu doar id): adaugare prin `addInspirationPhotos([{ photoId: photo.id, roomType: photo.roomType }])` (sugestie de camera si pentru pozele din galerie); scoatere prin `setInspirationPhotos`.
    - In vederea detaliului de colectie (`tab === 'boards' && boardId`): langa titlu, `Button variant="outline"` **„Adaugă toată colecția ({count})"**; `onClick` → `addInspirationPhotos(board.photos.map((p) => ({ photoId: p.id, note: itemsById.get(p.id)?.note, roomType: itemsById.get(p.id)?.roomType ?? p.roomType })))`; rezultatul → `Alert` in dialog: toate adaugate (`addedAll`), partial (`addedPartial` cu `{added, total, max}`), nimic de adaugat (`allAlreadySelected`) sau plafon atins (`capReached`, butonul e si `disabled` cand `selected.length >= MAX`). Alerta se reseteaza la schimbarea colectiei/tabului.
    - Loading/empty: `Skeleton`/`EmptyState` in loc de `<p>…</p>` (sectiunea 7).
    - Lista pozelor alese (sub antet): in locul thumbnail-urilor de 80px, cate un `InspirationSelectionCard` (fisier nou, punctul 20). Deasupra listei, hint-ul `notesVisibleHint`.
    - Prop nou optional `blockedNoteIds?: string[]` (din review) → pasat cardurilor pentru eroare pe notita.
    - Repara `aria-label={`remove ${p.title}`}` (hardcodat in engleza) → `t('inspirationPicker.removePhoto', { title })`.
20. `apps/frontend/src/components/configurator/inspiration-selection-card.tsx` (NOU): `Card` cu thumbnail (80px), titlu + firma, `Select` „Pentru camera" (optiune goala `roomNone` + camerele din `roomInstances`, eticheta `rooms.type.X`, cu `roomOption` „{room} {n}" cand tipul apare de mai multe ori), `Textarea` (rows 2, `maxLength={INSPIRATION_NOTE_MAX}`, `aria-describedby` spre contor `noteCounter`), buton scoatere (icon X cu aria-label). Starea locala a textarea se scrie in store la `onChange` (draftul e local, autosave-ul existent il duce pe server). Eroare `noteContactBlocked` sub textarea cand `blocked`. Selectorul de camera se ascunde cand nu exista camere.
21. `apps/frontend/src/components/configurator/review-step.tsx`:
    - Payload (~l.208): inlocuieste `inspirationPhotoIds,` cu `inspirationPhotos: inspirationPhotoIds.map((photoId) => { const m = inspirationMeta[photoId]; return { photoId, note: m?.note?.trim() || undefined, roomLocalId: m?.roomLocalId && rooms.some((r) => r.localId === m.roomLocalId) ? m.roomLocalId : undefined }; })`.
    - Helper nou `inspirationNoteContactIds(code, details): string[]` (analog `hasDescriptionContact`) → `<InspirationPicker blockedNoteIds={...} />` + mesaj in alerta de eroare.
    - Efect nou (analog INSPIRATION_UNAVAILABLE): `VALIDATION_ERROR` cu `details[].field === 'inspirationPhotos'` → `setInspirationRoom(photoId, null)` pentru fiecare si afiseaza `t('validation.inspirationRoomUnknown')`.
22. `apps/frontend/src/components/configurator/configurator-wizard.tsx` (hidratarea din `RequestDto` pentru edit, ~l.98): `inspirationPhotoIds: dto.inspirationPhotos?.map((p) => p.photoId) ?? dto.inspirationPhotoIds ?? []` si `inspirationMeta` construit din `dto.inspirationPhotos` (`note` daca nenul; `roomLocalId = requestRoomId` doar daca exista in `roomInstances` — la edit `localId = r.id`, iar camerele legacy fara `answers` sunt filtrate).
23. `apps/frontend/src/components/configurator/request-inspiration-by-room.tsx` (NOU) — inlocuieste `request-inspiration-strip.tsx`:
    ```tsx
    export function RequestInspirationByRoom({ photos, rooms }: {
      photos: RequestInspirationPhotoDto[];
      rooms: { id: string; roomType: RoomType }[];   // aceeasi ordine ca RoomSpecCard de pe pagina
    })
    ```
    - `useInspirationByIds(photos.map((p) => p.photoId))` pentru imagine/titlu/firma.
    - Grupuri: pentru fiecare camera (index `i + 1`, aceeasi numerotare ca ancorele `#room-{index}` din `RoomSpecCard`) cu cel putin o poza; apoi grupul „Pentru toata locuinta" (requestRoomId null sau necunoscut). Cand TOATE pozele sunt generale (cereri vechi), randeaza o singura lista fara titluri de grup (arata ca azi).
    - Titlu de grup: `{index}. {rooms.type.X}` + link `seeRoom` spre `#room-{index}`.
    - Card per poza (`Card`): imagine, titlu, firma; notita in `<blockquote>` cu eticheta `clientNote` si `<ContactSafeText text={note} />` (tokenul mascat devine „contact ascuns"). Poza retrasa din galerie dar cu notita → card cu placeholder `Inspiration.imageUnavailable` + notita; fara notita → omisa (ca azi).
    - `Skeleton` cat se incarca; `return null` cand `photos.length === 0`.
    - Heading de sectiune `h2` `Inspiration.requestSection` (existent), grupuri `h3`.
24. `apps/frontend/src/components/configurator/request-inspiration-strip.tsx` — STERS (singurii importatori sunt cele 3 pagini + mock-ul din testul detaliului client).
25. `apps/frontend/src/app/[locale]/marketplace/[id]/page.tsx` (~l.97): `<RequestInspirationByRoom photos={r.inspirationPhotos} rooms={r.rooms} />`.
26. `apps/frontend/src/app/[locale]/marketplace/claims/[claimSlotId]/page.tsx` (~l.169): `<RequestInspirationByRoom photos={c.detail.inspirationPhotos} rooms={c.detail.rooms} />`; muta blocul imediat sub sectiunea camerelor (inainte de `GeneralFiles`), ca firma sa-l vada langa camere.
27. `apps/frontend/src/app/[locale]/requests/[id]/page.tsx` (~l.148): `<RequestInspirationByRoom photos={r.inspirationPhotos} rooms={r.rooms} />`; `page.test.tsx`: mock-ul nou (`request-inspiration-by-room`) + `inspirationPhotos: []` in fixture.
28. `apps/frontend/src/hooks/use-inspiration-boards.ts`:
    - `useSavePhoto.onMutate`: adauga perechea fara sa stearga alte colectii ale pozei: `[...refs.filter((r) => !(r.photoId === v.photoId && r.boardId === v.boardId)), { photoId: v.photoId, boardId: v.boardId }]` (bug-ul radacina al DW3: filtrul actual sterge toate salvarile pozei).
    - `useMovePhoto.onMutate`: scoate doar perechea `(photoId, boardId sursa)`, adauga `(photoId, target)`.
    - Rollback per pereche (inversul operatiei), nu restaurarea snapshot-ului `prev`: doua bife rapide nu se mai anuleaza una pe alta. `onSettled` invalideaza ca azi.
    - NOU `useUpdateBoardItem(boardId)`: `PATCH /inspiration/boards/${boardId}/items/${photoId}` body `{ note?, roomType? }`, `onSuccess` invalideaza `[...KEY, 'detail', boardId]`.
29. `apps/frontend/src/app/[locale]/inspiration/_components/save-button.tsx`:
    - Prop `savedBoardIds: string[]` (in loc de `savedBoardId`).
    - Un singur `Popover` (Sprint 75): continut = `BoardPicker` in modul bife (`checkedBoardIds={savedBoardIds}`, `onToggle`), titlu `saveToBoards`, footer buton `done` care inchide. Bifa → `save.mutate`, debifa → `unsave.mutate`; popover-ul ramane deschis intre bife. „Colectie noua" creeaza si bifeaza.
    - Eticheta butonului: nesalvat `save`; salvat `savedInCount` (ICU cu numarul de colectii).
    - Scoate varianta „Muta in colectia… / Scoate din colectie" de aici (mutarea ramane pe detaliul colectiei; scoaterea = debifare).
30. `apps/frontend/src/app/[locale]/inspiration/_components/board-picker.tsx`: props noi optionale `checkedBoardIds?: string[]` + `onToggle?: (boardId: string, checked: boolean) => void`; cand sunt date, fiecare rand e `role="menuitemcheckbox"` `aria-checked` cu bifa vizibila (icon `Check`) si nu mai cheama `onPick`; spinner per rand cand mutatia pentru acel board e in curs (prop `pendingBoardIds?: string[]`). Modul vechi (`onPick`, `excludeBoardId`) ramane pentru „Mută".
31. `apps/frontend/src/app/[locale]/inspiration/_components/inspiration-pin.tsx` si `inspiration-lightbox.tsx`: `savedBoardIds: string[]` / `savedByPhoto: Map<string, string[]>`; `saved = savedBoardIds.length > 0`.
32. `apps/frontend/src/app/[locale]/inspiration/page.tsx` (~l.270): `savedByPhoto` devine `Map<photoId, boardId[]>` (reduce pe refs); pasare `savedBoardIds={savedByPhoto.get(photo.id) ?? []}`; comentariul „photoId → boardId" actualizat.
33. `apps/frontend/src/app/[locale]/inspiration/_components/board-item-note-editor.tsx` (NOU): continut de `Popover` cu `Textarea` (200, contor), `Select` „Pentru ce camera" (`roomAny` + lista `TYPE_FILTERS` din picker: KITCHEN, LIVING, BEDROOM, DRESSING, OFFICE, BATHROOM, HALLWAY — exporta lista dintr-un modul mic comun, ex. `components/configurator/inspiration-room-types.ts`, si foloseste-o si in picker/galerie), butoane `noteSave` / `close`, eroare `noteError`. Foloseste `useUpdateBoardItem`.
34. `apps/frontend/src/app/[locale]/inspiration/boards/[id]/page.tsx`: `BoardPin` primeste `meta?: InspirationBoardItemMetaDto`; sub imagine (in afara overlay-ului, in `figure`) o zona cu chip-ul camerei (`rooms.type.X`) si notita (`line-clamp-3`) + buton `noteAdd`/`noteEdit` care deschide `BoardItemNoteEditor` in `Popover`; loading `Skeleton`, colectie goala `EmptyState`.
35. `apps/frontend/src/messages/ro.json` + `en.json` — sectiunea 9 (CRLF, 2 spatii, paritate).

### Docs

36. `docs/04-data-model.md` — randul `request_inspiration_photos` (l.~115): „(request_id, photo_id, note VARCHAR(200) nullable, request_room_id FK → request_rooms ON DELETE SET NULL, nullable — E-client-34 2026-10) — max 10"; randul `inspiration_board_items` (l.~117): „+ note VARCHAR(200), room_type ENUM nullable (E-client-34)".
37. `CHANGELOG.md` — intrarea „## Sprint 76 (plan 2026-09-28): Collections into requests (P3) — <data>" in formatul intrarilor 1-74 (Pachet, Obiectiv, Impact, Plan de test manual, Checklist de acceptare, DECIZIE NECESARA).
38. Codex (`E:\CozyFableObsidian\CozyFableCodex`) — NU in acest sprint: intra in reimprospatarea de dupa Sprint 76 (HANDOFF, pasul 3). Note de atins atunci: `10 Module BE/BE inspiration.md` (endpoint PATCH item, move cu notita), `BE requests.md` (inspirationPhotos, screening PHOTO_NOTE), `BE marketplace.md`, `20 Frontend/FE configurator.md`, `FE marketplace firma.md`, `FE client cereri si oferte.md`, `00 Harta/Model de date.md`.

## 9. Chei i18n (RO + EN)

Valorile RO se scriu in `ro.json` CU diacritice (regula copy 2026-08-16; prose-ul planului e fara diacritice doar prin conventia documentului). „firmă", nu „atelier". Plural ICU cu `few`.

`Configurator.inspirationPicker` (chei noi; cheia existenta `subtitle` ramane):
```json
{
  "addWholeBoard": "Adaugă toată colecția ({count})",
  "addedAll": "{added, plural, one {Am adăugat o poză} few {Am adăugat # poze} other {Am adăugat # de poze}} din colecție, cu notițele lor.",
  "addedPartial": "Am adăugat {added} din {total} poze — poți atașa cel mult {max} pe o cerere. Scoate câteva ca să faci loc.",
  "allAlreadySelected": "Toate pozele din această colecție sunt deja alese.",
  "capReached": "Ai ales deja {max} poze — limita pentru o cerere.",
  "noteLabel": "Ce îți place la poza asta?",
  "notePlaceholder": "ex. culoarea fronturilor, mânerele, insula",
  "noteCounter": "{count}/{max}",
  "roomLabel": "Pentru camera",
  "roomNone": "Toată locuința / nespecificat",
  "roomOption": "{room} {n}",
  "notesVisibleHint": "Notițele și camera le văd firmele interesate de cerere. Nu scrie telefon, email sau linkuri — le adaugi la pasul Contact.",
  "noteContactBlocked": "Notița conține date de contact. Scoate-le ca să poți publica.",
  "removePhoto": "Scoate „{title}”"
}
```
EN:
```json
{
  "addWholeBoard": "Add the whole collection ({count})",
  "addedAll": "{added, plural, one {Added one photo} other {Added # photos}} from the collection, with their notes.",
  "addedPartial": "Added {added} of {total} photos — a request can have at most {max}. Remove some to make room.",
  "allAlreadySelected": "Every photo in this collection is already selected.",
  "capReached": "You've already picked {max} photos — the limit for one request.",
  "noteLabel": "What do you like about this photo?",
  "notePlaceholder": "e.g. the front colour, the handles, the island",
  "noteCounter": "{count}/{max}",
  "roomLabel": "For room",
  "roomNone": "Whole home / not specified",
  "roomOption": "{room} {n}",
  "notesVisibleHint": "Companies interested in your request see these notes and rooms. Don't add a phone number, email or links — add them in the Contact step.",
  "noteContactBlocked": "This note contains contact details. Remove them to publish.",
  "removePhoto": "Remove “{title}”"
}
```

`Configurator.validation.inspirationRoomUnknown`: RO „Camera aleasă pentru o poză de inspirație nu mai este în cerere — am scos legătura, alege din nou." / EN „The room chosen for an inspiration photo is no longer in the request — we removed the link, please choose again."

`Inspiration` (chei noi):
```json
{
  "saveToBoards": "Salvează în colecții",
  "savedInCount": "{count, plural, one {Salvat} few {Salvat în # colecții} other {Salvat în # de colecții}}",
  "done": "Gata",
  "noteAdd": "Adaugă notiță",
  "noteEdit": "Editează notița",
  "noteLabel": "Notița ta",
  "notePlaceholder": "Ce îți place aici? (vizibil doar pentru tine până o atașezi la o cerere)",
  "roomForLabel": "Pentru ce cameră",
  "roomAny": "Orice cameră",
  "noteSave": "Salvează notița",
  "noteError": "Nu am putut salva notița. Încearcă din nou.",
  "requestGeneral": "Pentru toată locuința",
  "requestRoomHeading": "{index}. {room}",
  "clientNote": "Nota clientului",
  "seeRoom": "Vezi camera"
}
```
EN:
```json
{
  "saveToBoards": "Save to collections",
  "savedInCount": "{count, plural, one {Saved} other {Saved in # collections}}",
  "done": "Done",
  "noteAdd": "Add a note",
  "noteEdit": "Edit note",
  "noteLabel": "Your note",
  "notePlaceholder": "What do you like here? (only you see it until you attach it to a request)",
  "roomForLabel": "For which room",
  "roomAny": "Any room",
  "noteSave": "Save note",
  "noteError": "We couldn't save the note. Please try again.",
  "requestGeneral": "For the whole home",
  "requestRoomHeading": "{index}. {room}",
  "clientNote": "Client's note",
  "seeRoom": "See room"
}
```
Chei care NU se mai folosesc dupa pasul 29 (verifica cu grep inainte de stergere; daca nu mai au importatori, sterge-le din ambele limbi): `Inspiration.moveTo` ramane (detaliu colectie), `Inspiration.removeFromBoard` probabil devine nefolosita.

`Admin.contactDetections.fields.PHOTO_NOTE`: RO „Notiță la inspirație" / EN „Inspiration photo note".

Verificare paritate: flatten node pe ambele fisiere (numarul de chei egal si aceeasi multime).

## 10. Componente / hook-uri (rezumat)

- Noi: `InspirationSelectionCard`, `RequestInspirationByRoom`, `BoardItemNoteEditor`, `useUpdateBoardItem`, modul `inspiration-room-types.ts`; actiunile de store `addInspirationPhotos`, `setInspirationNote`, `setInspirationRoom`.
- Modificate: `InspirationPicker`, `ReviewStep`, `ConfiguratorWizard` (hidratare), `SaveButton`, `BoardPicker`, `InspirationPin`, `InspirationLightbox`, galeria `/inspiration`, detaliul colectiei, `useSavePhoto`/`useMovePhoto`/`useUnsavePhoto` (rollback per pereche).
- Sterse: `RequestInspirationStrip`.
- Server state doar in TanStack Query; store-ul Zustand tine doar draftul pre-submit (notitele si camera sunt parte din draft — permis de skill-ul ui-component).

## 11. Teste de adaugat

Backend (jest):
- `requests/inspiration-selection.spec.ts` (NOU): `readInspirationSelection` — ambele campuri → 400; doar ids → note null; trim + `''` → null; dedupe primul castiga; lipsa ambelor → `undefined`. `assertInspirationRooms` — localId necunoscut → 400 cu `details[0].photoId`; localId valid trece. `inspirationRows` — harta `roomIds` produce `requestRoomId`, null fara camera. `inspirationNotesForScreening` — doar notite nenule, `roomType` al camerei legate.
- `requests/contact-screening.spec.ts`: notita cu telefon → rand `PHOTO_NOTE` + `blockingDetails` `{ field: 'inspirationNote', photoId }`; notita doar cu mentiune „WhatsApp" → FLAGGED, fara blocare; plafonul de randuri se respecta cu notite.
- `requests/requests.service.spec.ts`: MASK — publish cu notita cu telefon reuseste, `requestContactDetection.createMany` in tranzactie cu `field: 'PHOTO_NOTE', action: 'MASKED'`; BLOCK — 400 `REQUEST_CONTACT_INFO_IN_TEXT` cu detaliul `inspirationNote`, fara geocodare; publish cu `roomLocalId` necunoscut → 400 inainte de geocodare; `inspirationPhotoIds` + `inspirationPhotos` → 400. Extinde mock-ul `tx` cu `requestRoom`/`requestRoomItem`/`requestInspirationPhoto` cat cere `writeRooms`.
- `requests/requests.inspiration.integration.spec.ts` (NOU, Postgres local prin `testDatabaseUrl()` / `db-guard`, modelul `requests.write-rooms.integration.spec.ts`): writeRooms + writeInspirationPhotos → `request_room_id` = id-ul persistat al camerei; la a doua scriere camera scoasa → randul vechi ramane consistent (rescris fara camera); stergerea directa a camerei → `request_room_id` devine NULL (FK SET NULL); notita de 200 caractere se salveaza, 201 nu ajunge (validata inainte).
- `marketplace/marketplace.service.spec.ts`: mock `requestInspirationPhoto.findMany` intoarce `{ photoId, note: 'suna 0722 123 456', requestRoomId: 'r1' }` → raspunsul are notita mascata (contine `CONTACT_MASK_TOKEN`) si `requestRoomId`.
- `quotes/quotes.claim-context.spec.ts`: FULL + `clientVisible` → notita bruta; FULL fara acces la contacte (`hideText`) → mascata; REDACTED/TOMBSTONE → `inspirationPhotos: []`.
- `inspiration/boards.service.spec.ts` (NOU, prisma mock): `detail` intoarce `items` cu note/roomType; `updateItem` — board strain → 404, item lipsa → 404, `note: '  '` → null, patch gol → 400; `moveItem` creeaza destinatia cu notita/camera sursei si nu suprascrie o destinatie existenta.

Shared (vitest): `request.schemas.test.ts` — `configuratorContentSchema` accepta `inspirationPhotos` cu notita de 200, respinge 201 (`inspirationNoteTooLong`), respinge 11 intrari si `photoId` duplicat (`inspirationDuplicate`); `boardItemMetaSchema` respinge patch gol, accepta `note: null`.

Frontend (vitest):
- `stores/configurator-store.test.ts`: `addInspirationPhotos` — plafon 10 cu `skipped`, sugestie de camera doar cand exista exact una de acel tip, notita din colectie nu suprascrie una existenta, notita taiata la 200; `setInspirationPhotos` curata meta; `removeRoom` sterge `roomLocalId`; `loadSnapshot` cu meta murdara (chei straine, note lungi, camera inexistenta) → normalizat; snapshot vechi fara `inspirationMeta` → `{}`.
- `components/configurator/inspiration-picker.test.tsx` (NOU; mock `useBoards`/`useBoardDetail`/`useInspiration`/`useMe`, `NextIntlClientProvider`): colectie cu 12 poze si 0 alese → 10 adaugate + alerta `addedPartial`; notitele colectiei apar in textarea cardurilor; buton dezactivat la 10.
- `components/configurator/request-inspiration-by-room.test.tsx` (NOU): grupuri in ordinea camerelor + „Pentru toata locuinta" la final; toate generale → fara titluri de grup; notita cu `CONTACT_MASK_TOKEN` → eticheta „contact ascuns"; poza lipsa cu notita → placeholder + notita.
- `app/[locale]/inspiration/_components/save-button.test.tsx` (NOU): doua bife → doua POST-uri si ambele colectii raman bifate (optimistic); debifare → DELETE; eroare pe o bifa → doar acea pereche revine.
- `app/[locale]/requests/[id]/page.test.tsx`: actualizat mock + fixture.

## 12. Ordinea pasilor de implementare

0. **Precondite + recitire** (0,25 z): confirma Sprint 75 inchis (sectiunea 7); `git status` doar citire; recitește de pe disc fisierele din sectiunea 14. Porneste infra (`docker compose -f dev-infra/docker-compose.yml up -d`), backend 3001, frontend 3000; `curl http://localhost:3001/api/v1/health` → `ok`.
1. **Schema + migrare** (0,25 z): 5.1 + 5.2; `migrate diff` gol; `migrate deploy`; `prisma generate`; `pnpm -F backend typecheck`.
2. **Shared** (0,25 z): 6.1-6.4 + teste shared; `pnpm -F @marketplace/shared build && pnpm -F @marketplace/shared test`.
3. **Backend requests** (0,75 z): DTO (6.5), `inspiration-selection.ts` + spec, screening + spec, `requests.service.ts` (publish, edit, screenContacts, writeInspirationPhotos, toDto) + spec + spec de integrare. `pnpm -F backend exec jest src/modules/requests`.
4. **Backend citiri firma** (0,25 z): marketplace + quotes claim context + specurile lor.
5. **Backend boards** (0,25 z): `detail.items`, `updateItem`, `moveItem` cu notita, controller + DTO + spec nou. Verificare API manuala (sectiunea 13, A1).
6. **FE store** (0,25 z): punctul 18 + teste store.
7. **FE picker + review + wizard** (0,75 z): punctele 19-22 + test picker. Verificare in browser: formular nou si editare.
8. **FE vederea pe camere** (0,5 z): punctele 23-27 + test; sterge strip-ul.
9. **FE galerie multi-colectie** (0,5 z): punctele 28-32 + test SaveButton.
10. **FE notite pe colectie** (0,25 z): punctele 33-34.
11. **i18n** (in paralel cu 6-10, verificat aici): sectiunea 9, paritate.
12. **Verificare completa** (0,25 z): `pnpm typecheck`, `pnpm lint`, `pnpm -F backend test`, `pnpm -F frontend test`, `pnpm -F @marketplace/shared test`, specurile de integrare cu `TEST_DATABASE_URL`, planul manual (sectiunea 13).
13. **Inchidere** (0,25 z): skill `security-close` peste diff; docs/04; CHANGELOG; mesaj de commit propus (fara `git commit` — PO decide).

Total ~4,5 z (in marja estimarii de 4 z; pasii 7-9 sunt cei mai grei).

## 13. Plan de test manual

Conturi demo doar pe localhost: `ana.popescu@demo.ro` (client), `owner.a@demo.ro` (firma GOLD), parola din `apps/backend/.env` (`DEMO_PASSWORD`) — nu o copia in chat/loguri.

A. API (curl cu cookie de sesiune dupa login pe `/api/v1/auth/login`):
1. Client: `POST /api/v1/inspiration/boards` x2 („Bucatarie", „Living"); `POST /boards/{A}/items` si `/boards/{B}/items` cu acelasi `photoId` → `GET /inspiration/boards/saved` contine ambele perechi (DW3 la nivel API).
2. `PATCH /api/v1/inspiration/boards/{A}/items/{photoId}` `{ "note": "Imi plac fronturile mate", "roomType": "KITCHEN" }` → 200; `GET /boards/{A}` are `items[0].note`. `PATCH` pe colectia altui user → 404; `{}` → 400; `note` de 201 caractere → 400.
3. `POST /boards/{A}/items/{photoId}/move` spre o colectie C fara poza → `GET /boards/{C}` pastreaza notita.

B. Browser, client:
4. `/ro/inspiration`: pe un pin „Salvează" → popover cu bife; bifeaza doua colectii → butonul arata „Salvat în 2 colecții"; reincarca pagina → ambele bife raman (DW3). Debifeaza una → ramane una. Escape inchide popover-ul.
5. `/ro/inspiration/boards/{A}`: „Adaugă notiță" → text + camera „Bucătărie" → salvat, apare sub poza.
6. `/ro/requests/new`: adauga Bucatarie + Living; la pasul cu pickerul → tab „Colecțiile mele" → colectia A → „Adaugă toată colecția (N)" → pozele apar selectate, cardurile au notita din colectie si camera Bucatarie sugerata (DW1). Cu o colectie de >10 poze → mesajul „Am adăugat 10 din 12…" si butonul dezactivat.
7. Schimba camera unei poze pe Living, scrie notita la alta, scoate o poza. Reincarca pagina (draft local) → totul ramane. Sterge camera Living din cos → poza legata trece pe „Toată locuința".
8. Publica. `/ro/requests/{id}`: inspiratia e grupata „1. Bucătărie", „2. Living", „Pentru toată locuința", cu notitele.
9. Editeaza cererea: notitele si camerele se incarca in formular; schimba o notita; republica → noua notita apare; contorul de editari a crescut cu 1 (P5).
10. Notita „suna-ma la 0722 123 456" + politica implicita MASK → publicare OK; in Admin → Contacte in texte libere apare randul „Notiță la inspirație" / „Ascuns firmelor". Cu `pre_claim_contact_text_policy = BLOCK` (Admin → Setari, doar local) → publicarea e refuzata, cardul notitei arata eroarea; revino la MASK.

C. Browser, firma (`owner.a@demo.ro`):
11. `/ro/marketplace/{id}` (pre-claim): inspiratia grupata pe camere; notita cu telefon arata „contact ascuns" (DW2 pre-claim).
12. Preia cererea → `/ro/marketplace/claims/{slotId}`: acelasi bloc langa camere, notita bruta (DW2); linkul „Vezi camera" sare la cardul camerei.
13. EN: aceleasi ecrane pe `/en/...` fara chei lipsa (nici un `Inspiration.xxx` afisat brut).

D. Mobil (375px): picker cu carduri de notita fara scroll orizontal; popover-ul SaveButton incape in ecran.

## 14. Checklist de acceptare

- [ ] DW1: in picker, tabul Colectiile mele → detaliu colectie → „Adaugă toată colecția" adauga pana la 10 poze, cu mesaj de plafon cand nu incap toate; notitele colectiei ajung in cardurile pozelor si in payload (`inspirationPhotos[].note`) (test picker + pasul manual 6).
- [ ] DW1: notitele si camera supravietuiesc reincarcarii (draft local + autosave server), editarii cererii si republicarii (pasii 7, 9).
- [ ] DW2: `GET /marketplace/requests/:id` si `GET /quotes/by-claim/:claimSlotId` intorc `inspirationPhotos` cu `note` (mascata pre-claim / fara acces, bruta pe fisa de lucru cu acces) si `requestRoomId`; UI-ul firmei le arata grupate pe camere (test componenta + pasii 11-12).
- [ ] DW3: acelasi pin salvat in doua colectii din acelasi popover; ambele raman salvate dupa reincarcare (test SaveButton + pasii 1, 4).
- [ ] Migrarea `20261001070000_inspiration_notes_room_links` aplicata local, `migrate diff` gol, rollback documentat in SQL.
- [ ] Notitele trec prin screening (`PHOTO_NOTE` in `request_contact_detections`; BLOCK refuza cu detaliu per poza).
- [ ] `inspirationPhotoIds` ramane acceptat; ambele campuri → 400.
- [ ] i18n RO/EN in paritate; fara text hardcodat nou (inclusiv aria-label-ul reparat in picker).
- [ ] `pnpm typecheck`, `pnpm lint`, jest backend, vitest FE + shared verzi; specurile de integrare verzi cu `TEST_DATABASE_URL`.
- [ ] security-close peste diff; docs/04 + CHANGELOG actualizate; mesaj de commit propus.

## 15. Riscuri si fisiere atinse deja de sprinturile anterioare (RECITESTE de pe disc inainte de editare)

| Fisier | Atins de | Ce trebuie pastrat |
|---|---|---|
| `apps/backend/prisma/schema.prisma` | aproape toate sprinturile (1-8, 19-23, 73) | doar adaugi coloane/relatii; nu reformata restul |
| `apps/backend/src/modules/requests/requests.service.ts` | Sprint 1, 7, 19, 20, 21, 22 | `runTx(..., 'write', ...)`, ordinea screening → geocodare (BLOCK nu costa apeluri externe), `writeRooms` cu numar constant de query-uri, tokenul de draft sters la publish, outbox |
| `apps/backend/src/modules/requests/contact-screening.ts` | Sprint 20 (E-admin-platform-45) | forma randurilor si plafonul; fara valori brute in log |
| `packages/shared/src/request.schemas.ts` | Sprint 1, 7, 19, 20, 21, 22 | `resolveBudgetFields`, `mergeAccountEmail`, schemele studio |
| `packages/shared/src/marketplace.schemas.ts`, `contact-detection.ts` | Sprint 20 | `MarketplaceDistanceBand`, mastile |
| `packages/shared/src/quote.schemas.ts` | Sprint 1, 6, 8 | `CLAIM_CONTEXT_VISIBILITIES`, `firmActions` |
| `apps/backend/src/modules/marketplace/marketplace.service.ts` | Sprint 3, 5, 20 | `neutralNames`, `maskRoomForFirm`, `maskScene*` |
| `apps/backend/src/modules/quotes/quotes.service.ts` | Sprint 1, 4, 5, 6, 8, 19-23 | `resolveClaimContextAccess`, `buildLimitedClaimContext` (nimic nou nu scapa in REDACTED/TOMBSTONE) |
| `apps/backend/src/modules/inspiration/boards.service.ts` | Sprint 21 (runTxBatch) | `runTxBatch`, update pe `updatedAt` in batch |
| `apps/backend/src/modules/inspiration/inspiration.service.ts` | Sprint 7 (INSPIRATION_UNAVAILABLE) | `assertSelectable` cu `details.photoIds` — nu il schimba |
| `components/configurator/inspiration-picker.tsx`, `review-step.tsx`, `stores/configurator-store.ts`, `configurator-wizard.tsx` | Sprint 7 (E-client-2), 20 (review), 4 (wizard); Sprint 75 (primitive) | curatarea pozelor indisponibile (efectul cu `checkedSelection`), `serverRoomIssues`, `hasDescriptionContact`, overlay-ul de publicare, migrarea persist v4 |
| `app/[locale]/marketplace/claims/[claimSlotId]/page.tsx`, `marketplace/[id]/page.tsx` | Sprint 1, 6, 8, 19, 20, 23 (+75) | `ClosedClaimSummary`, panourile de ciclu de viata, `StudioScenesButton` |
| `app/[locale]/requests/[id]/page.tsx` | Sprint 1, 7, 20 (+75) | `RepostSection`, `DeleteRequestButton` |
| `app/[locale]/inspiration/page.tsx`, `_components/save-button.tsx`, `boards/[id]/page.tsx` | Sprint 7; Sprint 75 (Popover, FilterChips) | migrarea Radix din 75 — construiesti peste ea, nu revii la `mousedown` |
| `messages/ro.json`, `en.json` | toate sprinturile | CRLF, paritate 100%, niciun deep-merge din mai multe worktree-uri |

Riscuri:
- **R1 Confidentialitate**: notitele din colectii (private) devin vizibile firmelor cand sunt atasate cererii → hint explicit in picker (`notesVisibleHint`) + screening/mascare ca la descriere. Linkul public de partajare a colectiei NU se face (intrebare PO deschisa).
- **R2 Optimistic concurent**: doua bife rapide pe SaveButton — rollback-ul pe snapshot `prev` le-ar anula reciproc; de aceea rollback per pereche (punctul 28).
- **R3 Legatura camerei la edit**: camerele legacy fara `answers` nu intra in `roomInstances` → legatura lor se pierde la re-editare (poza trece pe „Toata locuinta"); acceptat, cereri vechi.
- **R4 Blue/green**: rollback + editare prin imaginea veche pierde notitele; bundle nou pe API vechi → 400 pe publish (fereastra scurta). Documentat in SQL si CHANGELOG.
- **R5 Sprint 75 incomplet sau cu API diferit**: numele exacte ale primitivelor se citesc din fisiere; daca lipsesc, STOP (pasul 0).
- **R6 Consumul editarii** pentru o notita schimbata dupa publicare (P5) — poate parea sever clientului; semnaleaza la triajul PO daca apare feedback.
- **R7 Plafonul `ids` = 50** in `GET /inspiration` — neatins (max 10 per cerere).

## 16. DECIZIE NECESARA

Niciuna blocanta. De confirmat optional la triajul PO (au default implementat):
- P3: notitele mascate sunt vizibile si pre-claim (ca descrierea). Alternativa: doar post-claim (`note: null` in `marketplace.service.ts`).
- P5: schimbarea unei notite pe cerere publicata consuma o editare.
- Link public read-only pentru colectii (din finding) — neimplementat.

## 17. Mesaj de commit propus (la cererea PO)

```
Sprint 76 (plan 2026-09-28): colectii intregi in cerere, cu notite si camera (E-client-34)

- request_inspiration_photos: note VARCHAR(200) + request_room_id (FK SET NULL);
  inspiration_board_items: note + room_type (migrare 20261001070000, aditiva)
- publish/edit: inspirationPhotos [{photoId, note, roomLocalId}] (inspirationPhotoIds pastrat),
  screening PHOTO_NOTE, camera mapata prin harta writeRooms
- firma vede inspiratia grupata pe camere (mascata pre-claim / fara acces)
- picker: "Adauga toata colectia" pana la 10, cu notite; carduri notita + camera
- galerie: salvare in mai multe colectii cu bife; notite pe salvari (PATCH item)

Rollback: redeploy imaginea anterioara, apoi SQL-ul din comentariul migrarii.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
