# Feedback PO — configurator 3D, runda 2 (Sprint T1)

Data: 2026-07-13. Sursa: feedback PO verbal (chat). Predecesor: docs/12 (S1–S6), docs/10 (R1–R6).

## Cerintele PO (verbatim, rezumat)

1. Birou: posibilitatea de a NU avea casetiere.
2. Mai multe culori ca optiuni; poate si un color picker.
3. Comoda: cu picioare sau fara, vizibil in 3D.
4. General: alegere maner vs push, manerul VIZIBIL in 3D.
5. Dulap: usi glisante; la 2/3 coloane usile gliseaza ori in stanga, ori in dreapta.
6. Reguli: sertar sub 15cm nu se poate; intre polite minim 10cm.

## Sprint T1 — implementare (toate cele 6 iteme)

### Model partajat (`packages/shared/src/questionnaire/piece3d/`)

- **Birou fara casetiere**: `minColumns: 0` exista din S6, dar `normalizePieceConfig`
  avea `columns.length || 1` si forta prima casetiera inapoi — FIX: clamp pe
  lungimea reala; schema si `canRemoveColumn` acceptau deja 0.
- **Finisaje**: `PIECE3D_FINISHES` extins cu `CREM, NEGRU, ALBASTRU, TERACOTA`
  + `CUSTOM` cu `customColor` (hex `#rrggbb`, `CUSTOM_COLOR_RE`). CUSTOM fara
  culoare valida → normalize revine la STEJAR, schema respinge la publish.
  Culoarea aleasa se PASTREAZA cand se revine la un finisaj predefinit.
- **`frontStyle?: 'PUSH' | 'HANDLE'`** pe config (toate piesele; lipsa = PUSH,
  aspectul istoric). Intra in descrierea derivata („fronturi cu maner" /
  „deschidere push") si in `systems` itemului derivat (MANER/PUSH, dedup cu
  `openingSystems` unde intrebarea separata exista).
- **`doorMode?: 'HINGED' | 'SLIDING'`** (doar `rules.slidingDoors` = WARDROBE),
  valid DOAR la 2–3 coloane (`SLIDING_COLUMNS_MIN/MAX`). La glisare: zonele
  `DOOR` devin `OPEN` (interiorul polite/bara se pastreaza), `canAdd/RemoveColumn`
  tin coloanele in interval, iesirea din interval prin normalize (ex. reset)
  revine tacit la batante. `Piece3dColumn.slideTo?: 'L'|'R'` = directia usii;
  capetele gliseaza DOAR spre interior (normalize curata, schema respinge).
  Model: rol nou `SLIDING_FRONT` — o usa pe toata inaltimea per coloana, pe
  2 sine alternante IN FATA carcasei (exceptate din `panelsWithinBounds`),
  `slideDx` = latimea coloanei vecine (semnata).
- **`legs?: boolean`** (doar `rules.legsOption` = DRESSER): 4 picioare conice
  de 12cm (`LEG_H`, rol nou `LEG`) in loc de soclu; baza comuna resolver+model
  prin `pieceBaseHeight(kind, config)` — interiorul (si regula sertarelor
  <160cm) urca odata cu corpul. Inaltimea totala include picioarele.
- **Reguli noi**: `DRAWER_H_MIN = 0.15` (fiecare front de sertar ≥15cm;
  `drawersCountFor(h)`) si `SHELF_GAP_MIN = 0.10` (n polite impart zona in n+1
  spatii ≥10cm; `shelvesCountFor(h)`). Tipar triplu identic cu regulile R5.3:
  normalize CORECTEAZA (count scade; zona DRAWERS prea scunda redevine OPEN;
  fill-ul de polite dispare sub 10cm), schema RESPINGE la publish pe geometria
  rezolvata, UI ascunde optiunile imposibile si plafoneaza stepper-ele live.

### Flow v3 dulap (`flows/guided-pieces/v3.ts`)

- **DECIZIE (reversibila)**: step-ul `doorType` (glisant/balamale) devine
  ASCUNS + optional (ca `snapshot3d`) — alegerea s-a mutat IN configuratorul 3D
  (`config.doorMode`), cum a cerut PO; fara dublarea intrebarii. Sistemul
  GLISANTE se deriva din config, cu fallback pe raspunsul legacy `doorType` —
  drafturile si cererile vechi raman valide la publish. Efect colateral minor:
  cererile v3 vechi nu mai afiseaza randul „Tip usi" in rezumatul Q→A
  (sistemul GLISANTE ramane pe item).

### Frontend (`components/configurator/piece3d/`)

- `finishes.ts`: specs pentru cele 4 culori noi + `finishSpecFor(finish,
  customColor)` (CUSTOM: front = corp deschis ~10% spre alb).
- `piece-canvas.tsx`: rol `LEG` (cilindru conic), `SLIDING_FRONT` animat pe
  `position.x` cu `slideDx` (grupat per coloana, cheie `slide:{col}`), manere
  de alama (`FrontHandle`) cand `frontStyle === 'HANDLE'` — orizontale pe
  sertare/rabatabile, verticale pe usi (langa muchia opusa balamalei) si pe
  usile glisante (muchia opusa glisarii).
- `configurator3d-step.tsx`: rand nou de optiuni (`TogglePills`) — Deschidere
  fronturi (toate piesele), Baza soclu/picioare (comoda), Usi dulap
  batante/glisante (+ hint „disponibile la 2–3 coloane" cand nu se poate);
  directia de glisare pe usa din mijloc (3D toolbar + campuri clasice); swatch
  CUSTOM cu `<input type="color">` nativ (gradient conic pana la prima alegere);
  click in 3D pe coloana glisanta: deschide usa → click pe sertare le trage →
  click in alta parte inchide tot; gating-ul geometric extins (DRAWERS sub
  15cm ascuns, fill polite sub 10cm ascuns, count-uri plafonate) in ambele moduri.
- `config-chips.ts`: chips noi „Usi glisante" / „Pe picioare" / „Fronturi cu
  maner"; finisajul CUSTOM afiseaza hexul.
- i18n: ~25 chei noi RO+EN sub `Configurator.config3d.*` (CRLF pastrat).

### Fara migrari / fara bump de versiune

Config-ul 3D e JSON in `answers` — toate campurile noi sunt OPTIONALE si
aditive; datele vechi se valideaza neschimbate (precedent R5.3). Backend fara
cod nou (validarea vine din shared prin `validateRoomAnswers`).

## Checklist de acceptare

- [x] Birou: stepper-ul de casetiere coboara la 0; blat + picioare se genereaza fara casetiere; descrierea nu mai mentioneaza coloane. (verificat in preview: `columns: []` persistat)
- [x] 10 finisaje in picker (9 predefinite + CUSTOM); pickerul nativ seteaza `finish: CUSTOM` + `customColor`; culoare invalida → fallback STEJAR (test unit); descriere „finisaj personalizat (#hex)".
- [x] Comoda: toggle Baza „Cu soclu / Pe picioare"; 4 picioare, fara soclu, interiorul urca 12cm (teste unit + preview `legs: true`); respins pe alte piese.
- [x] Maner/push pe toate piesele; maner vizibil in 3D pe sertare/usi/glisante (geometrie testata unit); sistemul derivat primeste MANER/PUSH.
- [x] Dulap: toggle Batante/Glisante doar la 2–3 coloane; o usa per coloana pe sine alternante; zonele Usa devin Deschis; directia usii din mijloc L/R (preview: `slideTo: 'R'` pe coloana 2); capetele doar spre interior; +/− coloane blocate in interval; publish respinge glisant pe 1 sau 4+ coloane.
- [x] Sertar <15cm: count plafonat live, normalize reduce/reconverteste, publish respinge (teste unit).
- [x] Polite la <10cm: count plafonat live, normalize reduce/scoate fill-ul, publish respinge (teste unit).
- [x] Teste: 111/111 vitest shared (10 noi T1); typecheck + lint verzi.
- [x] Cereri/drafturi vechi: valide fara modificari (doorType ascuns+optional, campuri noi optionale).

## Verificare in preview (2026-07-13)

Pe `/ro/dev/piece-3d`: WARDROBE → „Glisante" → config `doorMode: SLIDING`, zonele
DOOR migrate la OPEN, optiunea „Usa" disparuta din selecturi, „Spre dreapta" pe
coloana 2 → `slideTo: 'R'`; DESK → minus → `columns: []`, stepper 0; DRESSER →
„Pe picioare" → `legs: true`; color picker → `finish: CUSTOM, customColor:
#7b3fa0`; „Cu maner" → `frontStyle: HANDLE`; fara erori runtime (overlay Next
absent). Nota: canvas-ul WebGL nu randeaza in pane-ul embedded (limitare de
mediu cunoscuta — rAF throttled), geometria e acoperita de testele unit.
