# Etapa 8 — proiectul de lucru (DESIGN)

Formular și texte: afișare, validare, telefon (problemele 38–43: `b10`, `b9`, `j1`, `c4`, `i1`, `d2`).
Specificația: `docs/implementation/plan-reparatii-2026-11-13/etapa-08.md` (răspunsurile PO sunt FINALE).
Ramura: `claude/reparatii-etapa-08`, făcută din `claude/reparatii-etapa-07` (74bb763).
Scris de arhitect pe 2026-11-14, doar din citirea codului (nimic rulat). Numerele de rând din plan
pentru `ro.json` sunt vechi (fișierul a crescut cu ~100–400 de rânduri): căutați după CHEIE, nu după rând.

## 0. Reguli de fier (pentru toți agenții)

1. Fluxurile versionate (`packages/shared/src/questionnaire/flows/**`, inclusiv `common.ts`,
   `guided-pieces/v3.ts`, `v4.ts`, `catalog-v1.ts`, `catalog-v2.ts`) NU se ating. `describePieceConfig`,
   `defaultPieceConfig`, `normalizePieceConfig` din `piece3d/config.ts` NU își schimbă comportamentul
   (`firm-text.fixtures.ts` și testele folosesc `defaultPieceConfig`). Instantaneele
   `__snapshots__/{score-invariance,firm-text,score-v6,firm-text-v6}.json` trebuie să rămână
   byte-identice — fiecare agent care atinge `packages/shared` verifică cu `git diff --stat`.
2. Se schimbă doar AFIȘAREA și textele (i18n). Ce se salvează se schimbă într-un singur loc, explicit,
   la problema 43 (config 3D scris de interfață; vezi 43), fără să schimbe codul fluxurilor.
3. Textele doar prin fragmente `<agent>.{ro,en}.json` (+ `.remove.json`) în
   `…\scratchpad\reparatii\etapa-08\i18n\` (val 1) și `…\etapa-08\i18n-v2\` (valul glosarului),
   îmbinate cu `merge-i18n.cjs` (refuză conflictele). Fiecare agent schimbă DOAR cheile din lista lui
   (§3). Cheile noi stau sub prefixele agentului (§3).
4. O singură bară de acțiuni pe ecran și UN SINGUR buton principal vizibil la orice lățime (testele e2e
   caută `getByRole('button', { name, exact })` — două butoane vizibile cu același nume le strică).
5. Teste doar țintite, prin `low.cjs`; fără `next dev`, fără e2e, fără suite întregi (le rulează
   coordonatorul). După o schimbare în `packages/shared`: `pnpm -F @marketplace/shared build` înainte
   de testele / typecheck-ul din frontend.
6. Comentarii în română fără diacritice; texte UI în română CU diacritice; glosarul (§2b) se aplică și în
   textele noi scrise în valul 1.

## 1. Pe fiecare problemă: ce e deja făcut și ce rămâne

### 38 — Fișa cererii și Sumarul (`b10`)

Deja făcut (verificat în cod): Sumarul are un singur rând „Cum ai pornit cererea” (b8/b10, etapa 7,
`review-facts-card.tsx`); „Ajutor pentru planificarea mobilierului” nu mai există în `ro.json`;
contorul de caractere la „Altul” există (etapa 6); erorile rândului „Altă piesă” v2 apar lângă câmp.

Rămâne:
1. **Valoare invalidă marcată în Fișă** — `review-rail.tsx` `rowsForStep` cazul `dimensions`: fiecare
   slot primește starea din `dimensionSlotStatus` (§2f); `outOfRange` → rând cu `invalid: true`, valoarea
   în roșu + „de corectat” (cheie nouă `sheet.toFix`), nu ca valoare acceptată. Aceeași verificare pe
   schița 2D: `step-renderer.tsx` trimite la `getDimensionFigure` și setul de sloturi invalide, iar
   `dimension-figures.tsx` colorează cota respectivă cu `text-crimson` (parametru nou, opțional).
2. **Etichete scurte** — funcție nouă `summaryLabel(t, step)` (§2c) folosită în `review-rail.tsx`
   (rânduri + titlul secțiunii), `room-answer-summary.tsx` (`dt`), `room-spec-card.tsx` (eticheta din
   pilule) și `review-step.tsx` `describeIssue` (`stepLabel`). „Altul” + text pe un singur rând (§2c,
   `buildSummaryRows`): rândul de alegere cu valoarea `ALTUL` / `OTHER` preia textul pasului-pereche
   (`<id>Other` sau pasul text cu `visibleIf` pe el) — „Altul — sticlă…”, iar rândul text separat
   dispare; la fel în Fișă și în Sumar. Textele noi `…summaryLabel` (RO + EN) pentru toate titlurile
   lungi (vezi testul de la §3, B).
3. **Rânduri goale din „Altă piesă”** — `review-rail.tsx` cazul `pieces` și `room-answer-summary.tsx`
   `pieceLine`: rândurile cu `name.trim() === ''` nu se afișează (nici virgule). **Fișiere**: rândul de
   coadă „Fișiere” din Fișă arată `summaryFiles.count` cu numărul fișierelor cererii (prop nou
   `filesCount` pe `RequestSheet`, dat de `configurator-wizard.tsx` din datele ciornei deja încărcate),
   „opțional” doar la 0 fără proiect propriu, „obligatoriu” la 0 cu proiect propriu.
4. **Sumar: scurt + „Vezi toate”** — `review-room-card.tsx`: lista scurtă = `buildSummaryRows(...)` cu
   `importance === 'main'` (§2c: piese, material, deschidere, configurația 3D, dimensiuni și pașii primului
   ecran), lista din `<details>` = DOAR rândurile `importance === 'extra'`; `<details>` nu se randează
   când nu are rânduri. `RoomAnswerSummary` primește `rows` (sau `only: 'main' | 'extra'`) în loc de
   `stepIds`.
5. **O singură numărătoare** — `room-flow-runner.tsx` antet: în loc de „07/20” textul vizibil
   „Ecranul {current} din {total}” (`nav.screenOf`) sau „Ecranul {current}” (`nav.screenOnly`) cât
   `screenTotalKnown(room, hasOwnProject)` (§2f) e fals; bara de progres rămâne doar cu total cunoscut
   (altfel ascunsă). Fișa: textul vizibil „{done} din {total} răspunsuri obligatorii” (`sheet.progress`,
   înlocuiește perechea `a / b` + sr-only). Rândul de cameră pliată: `sheet.sections` („N secțiuni”) →
   `sheet.someQuestions` („câteva întrebări”); cheia veche se scoate (`.remove.json`).

### 39 — Mesaje de validare (`b9`)

Deja făcut: contorul „x / max caractere” sub orice câmp text cu limită (etapa 6, `step-renderer.tsx`
cazul `text`); limita 150 + contor la denumirea piesei (etapa 5); „Alege o sumă sau bifează…” (b11,
`Requests.validation.budgetRequired`) — „Alege intervalul” nu mai există; „limita de 10 atașamente” nu mai
apare în `ro.json` (de verificat EN și `uploads.*` / `sketchUpload.*` pentru un număr fix greșit);
rândul „Altă piesă” v2 arată eroarea lângă câmp.

Rămâne:
1. **Dimensiuni per câmp** (`step-renderer.tsx` `dimension-group`, `room-screens.ts`, `room-flow-runner.tsx`):
   `validateStepIssue` (§2d) dă pentru câmpuri goale `validation.dimensionsMissing` cu `{count}` și harta
   pe sloturi; sub fiecare câmp gol după „Continuă”: „Completează {field}” (`validation.fillField`,
   `{field}` = eticheta slotului, cu literă mică nu e nevoie) + contur roșu (`aria-invalid`); în afara
   intervalului: mesajul existent `validation.dimensionRange` cu intervalul formatat (§2a). Mesajul de jos
   al pasului = rezumatul. Runner-ul pune focusul pe primul câmp greșit (`[aria-invalid="true"]` din
   ecran, după randare) și îl aduce în vedere. Pe server: `engine.ts` `dimension-group` primește
   `required_error: 'validation.dimensionRequired'` (cheie nouă, „Completează toate dimensiunile.”) —
   singura schimbare în motor; scorul și textele pentru firmă nu depind de ea.
2. **Răspuns lipsă după tip** — `room-screens.ts` `requiredMessageKey(step)` (§2d), folosit în
   `validateStepIssue` și în `roomIssue` (când serverul / validarea strictă dă `validation.answerRequired`):
   single-choice / boolean → `validation.chooseOne`, multi-choice → `validation.minOneOption` (există),
   pieces → `validation.minPieces` (există), text → `validation.fillThisField`, dimension-group →
   `validation.dimensionsMissing`, configurator-3d / upload → `validation.answerRequired` (rămâne).
   „Altă piesă” v1 (`PieceRows`, `requestItemSchema`): mesajele fără prefix (`itemNameTooShort`,
   `quantityTooLow`, `dimensionInvalid`) nu mai devin „formatul așteptat”: `validateStepIssue` le traduce
   în `validation.pieceRow.{name|quantity|dimension}` cu `{row}` (= `issue.path[0] + 1`) — „Piesa 2:
   denumirea e prea scurtă (cel puțin 2 caractere).”
3. **Date generale** (`details-step.tsx`, doar interfața — schema din `request.schemas.ts` rămâne):
   `vmsg` primește și valoarea câmpului; câmp gol (după `trim`) + mesaj `addressTooShort` /
   `countyTooShort` / `cityTooShort` / `cityRequired` / `contactValueTooShort` → chei noi
   `Requests.validation.{address|county|city|contact}Required` („Completează adresa / județul / orașul /
   e-mailul sau telefonul”); „prea scurt” rămâne doar la 1–2 caractere.
4. **Contoare și plafoane**: `details-step.tsx` „Mesaj pentru firme” — `maxLength={5000}` pe `Textarea` +
   contor `{count} / 5.000` (cheia existentă `Configurator.pieces.charCounter` sau una nouă în `Requests`)
   și subtitlul „maximum 5.000 de caractere” (în `Requests.messageHint`). `step-renderer.tsx`
   „Altă piesă” (v1 și v2): `Cantitate` cu `max={999}` (limita din `requestItemSchema`) + mesaj; butonul
   „Adaugă piesa” `disabled` când `pieces.length >= step.maxPieces` (10), cu textul
   „Cel mult {max} piese” (`pieces.maxReached`) — `PieceRows` / `PieceRowsV2` primesc `maxPieces`.
5. **Texte corectate** (fragmentul agentului A2): „pasul Contact” → „secțiunea Preferințe de contact din
   Date generale” în `Configurator.inspirationPicker.notesVisibleHint`, `Configurator.apiErrors.REQUEST_CONTACT_INFO_IN_TEXT`,
   `Configurator.validation.contactInText`, `Configurator.contactInText.hint` (+ EN, + orice alt loc găsit
   cu căutarea „pasul Contact” / „Contact step”); regula de editare în `Configurator.editSubtitle`,
   `Configurator.review.publishNote`, `Requests.editPostClaimWarning` (de citit întâi regula reală în
   `docs/03` 4.x: „3 editări înainte de preluare; o dată după preluare, înainte de prima ofertă”); limita
   de fișiere: unde un text spune un număr, numărul real = `maxAttachmentsForRooms(n)` din
   `request.schemas.ts` (10 + 8 pe cameră), dat ca parametru, nu scris în text.
6. **Sesiune expirată la publicare** (`review-step.tsx`): `apiErr` ∈ {`UNAUTHORIZED`, `SESSION_SUPERSEDED`}
   (sau `publish.error.status === 401`) → în locul alertei generice: `review.sessionExpired` („Sesiunea a
   expirat — intră din nou în cont; cererea rămâne salvată.”) + buton „Intră în cont”
   (`review.sessionExpiredLogin`) spre `/login?redirect=<pagina curentă>&reason=expired`
   (`/requests/new` sau `/requests/<id>/edit`; prin `safeRedirect`, ca restul gărzilor). Faza `review`
   e deja salvată în store, deci la întoarcere formularul se deschide pe Sumar.

### 40 — Telefon (`j1`)

Nimic făcut încă (bara lipită, cardurile pe 2 coloane, tabelul pe carduri lipsesc).

1. **CSS mic**: `room-answer-summary.tsx` și `review-rail.tsx` — valorile `min-w-0 break-words
   [overflow-wrap:anywhere]`, etichetele `shrink-0 max-w-[45%]`; `dimension-figures.tsx` — cote mai mari
   sub `sm` (text ≥ 13 px); 3D (`configurator3d-step.tsx`, `furniture-controls.tsx`,
   `catalog-controls.tsx`): `Stepper` +/−, mostrele de culoare și `TogglePills` cu `min-h-11 min-w-11`.
2. **Bara de continuare** (`StickyActionBar`, §2e) pe: `room-flow-runner.tsx` (Înapoi / Continuă),
   `room-cart-step.tsx` („{camere} · {piese} · Începe →”, textul `summary` existent),
   `uploads-step.tsx`, `details-step.tsx` (Înapoi / Spre sumar), `review-step.tsx` („Publică cererea”).
   Pe desktop rămâne ca azi.
3. **Carduri pe două coloane**: `step-renderer.tsx` `cardGrid` → `grid grid-cols-2 gap-3 sm:gap-4
   xl:grid-cols-3`; `playing-card.tsx` — imaginea mai mică sub `sm` (de ex. `aspect-[4/3]` → înălțime
   fixă mai mică, titlul `text-sm`), fără să scoată descrierea; perechea Da / Nu rămâne pe 2 coloane.
   Fișa cererii pliată implicit sub `lg`: `review-rail.tsx` învelește conținutul într-un `<details>`
   închis implicit pe ecrane mici (rezumatul arată titlul + „{done} din {total}”), deschis mereu de la `lg`
   (prop `collapsible` setat de wizard).
4. **Tabelul de comparare** (`app/[locale]/_components/offers-comparison.tsx`): sub `sm` (640 px) tabelul
   se ascunde (`hidden sm:block`) și apare lista de carduri pe rubrică (`sm:hidden`): pentru fiecare
   `COMPARE_ROW_KEYS` un card cu titlul rubricii și câte un rând „{firmă}: {valoare}”, refolosind exact
   funcțiile din `rows` (aceleași valori, aceleași insigne); ultimul card = acțiunile per firmă. Filele de
   firme de pe pagina ofertelor (`app/[locale]/requests/[id]/offers/page.tsx:214`, componenta comună
   `components/ui/tabs.tsx`) pe un singur rând derulabil: prop nou opțional `scrollable` pe `Tabs`
   (`flex-nowrap overflow-x-auto` + `shrink-0` pe file); fără prop, `Tabs` rămâne exact ca azi (îl
   folosește și coșul). Rubricile sunt cele fixate la a3 (etapa 4) — nu se schimbă conținutul.
5. **3D pe telefon** (`configurator3d-step.tsx`): sub `lg`, scena `sticky top-[var(--header-h,4rem)]`
   cu înălțimea `h-[40dvh]`, comenzile dedesubt; după atingerea unei zone (`setActiveZone`), panoul
   zonei primește `scrollIntoView({ block: 'nearest' })` (doar sub `lg`, `matchMedia`). Pe desktop
   neschimbat (asezarea de pe desktop e la nr. 44, nu aici).
6. Verificarea la 390 × 844 (§4).

### 41 — Unități (`c4`) — după răspunsul PO c4-1

Hotărâre PO: comutatorul m / cm / mm rămâne; clientul vede unitatea aleasă de el în formular, în Fișă,
în Sumar și pe pagina cererii; FIRMA vede mereu centimetri.

Deja făcut: toate dimensiunile se salvează în metri (și la 3D); câmpurile pornesc în cm; cititorul cu
virgulă (`lib/decimal.ts`, b1); pasul 3 din plan („ignor pasul din specificație”) e deja adevărat —
câmpul e text (`useDecimalField`), iar motorul nu are `multipleOf` (verificat cu Grep); descrierile
pentru firmă generate de `shared` sunt deja în cm („120 × 80 × 40 cm”).

Rămâne:
1. **Formatatorul unic** `apps/frontend/src/lib/dimension-format.ts` (§2a), val 0.
2. **Folosit în**: `room-answer-summary.tsx` (azi „2.4 m” fix), `review-rail.tsx` (`fmtDim`, azi cu punct),
   `room-spec-card.tsx` (sloturile „… m” și antetul legacy „L × l × H m” → cm pentru firmă; tavanul →
   cm), `step-renderer.tsx` (legenda planșei, `valueLabels`, `rangeText`), `piece3d/config-chips.ts`
   (dimensiunea piesei, adâncimea canapelei, înălțimea de montaj), `use-dimension-field.ts` /
   `cmRangeText` (intervalul din 3D). Unitatea: în formular și Sumar = `useConfiguratorStore(s => s.dimensionUnit)`;
   pe pagina cererii clientului (`RoomSpecCard audience="client"`) = `useDimensionUnitPreference()` (§2a);
   la firmă (`audience="company"`, piața, fișa de lucru) = `'cm'` fix.
   Excepții (rămân în metri, sunt lungimi liniare de mobilier, nu dimensiuni): `roomSpec.furnitureLinear`
   (metri liniari), lungimea aproximativă (`approxLength.*`, `roomSpec.approxLength` — se scrie în m în
   formular), prețurile „lei pe metru liniar”. Vezi DECIZIE D2.
3. (făcut deja — vezi mai sus)
4. **O singură componentă de dimensiune 3D**: `piece3d/dimension-control.tsx` (nou) —
   `PieceDimensionControl({ label, minM, maxM, valueM, onValueM, id? })`: eticheta + intervalul formatat
   lângă etichetă, glisor (pas 1 cm), câmp text „cm” prin `useDimensionField` (mesajele de corectare din
   etapa 5 rămân identice), `role="status"` pentru notă. Înlocuiește `DimensionControl`
   (`configurator3d-step.tsx`), `SizeInput` (`furniture-controls.tsx`), `CatalogSize`
   (`catalog-controls.tsx`). `LockableSize` (cu lacăt) rămâne, dar folosește aceeași bucată internă
   (export `DimensionInputRow` din fișierul nou), ca aspectul să fie identic. 3D-ul rămâne mereu în cm
   (nu urmează comutatorul — intervalele și pașii sunt în cm; vezi D2b).
5. **Salteaua**: doar texte — `Configurator.flows.*.bedSize.options.*.label` (toate versiunile: dormitor
   v1–v3, pat ghidat) primesc unitatea: „90 × 200 cm”, „160 × 200 cm” etc.; ce se salvează nu se schimbă.
   Sloturile „mărime la comandă” (`bedCustomSize`) se afișează prin formatator (unitatea clientului).
6. Teste: `lib/dimension-format.test.ts` (0,455 m → „45,5 cm” ro, „45.5 cm” en; 2,4 → „240 cm”;
   1,6 m în `m` → „1,6 m”; mm → „1600 mm”; float 0.30000000000000004; listă „120 × 80 × 40 cm”;
   interval „80–600 cm”); test de componentă pe `RoomSpecCard` (firmă: cm, client cu preferința `m`: m) și
   pe `RoomAnswerSummary` (cererea veche fără unitate → cm, virgulă în ro).

### 42 — Vocabular (`i1`) — glosarul §2b

Deja făcut: „atelier” nu apare (regula PO permanentă); „Ajutor pentru planificarea mobilierului” scos;
„lei/ml” → „lei pe metru liniar” (etapa 6); sumele cu „lei” pe cardul „Acordul vostru” (etapa 7).
Rămâne: tot glosarul (§2b) peste `ro.json` / `en.json` (toate namespace-urile pentru client și firmă, NU
`Admin*` — D7), `docs/glosar.md` (nou, tabelul §2b + regulile de folosire), e-mailurile din
`apps/backend/src/modules/notifications/notification-emails.service.ts` (+ `notifications.service.ts`
dacă are texte) și testul automat de termeni interziși (§3, D). Coșul: `cart.title` → „Ce vrei să
mobilezi?”, `cart.subtitle` pomenește camerele și piesele (fac A2 în val 1, ca să nu aștepte).
Proiectarea cu plată: un singur termen + textele drumului PO (D8). Meniul firmei: „Cereri disponibile”.

### 43 — Valorile implicite din 3D (`d2`) — după răspunsurile PO d2-1, d2-2, d2-3

Hotărâri PO: (d2-1) firma vede „Dimensiuni orientative — clientul nu le-a modificat”, fără pas în plus;
(d2-2) dulapul pornește cu uși batante pe toate zonele, comoda TV cu un rând de sertare; (d2-3) „Push”
lăsat implicit se punctează.

Deja făcut (etapa 6): `configHasFronts`; piesele fără fronturi nu primesc sistem în v4 / catalog v2
(`frontStyleSystemsV4`). Rămas nereparat din etapa 6: descrierea pentru firmă scrie „fronturi cu mâner”
la piesa fără fronturi (cod înghețat) — se repară aici DIN INTERFAȚĂ (pasul 2).

Cum se face FĂRĂ să schimbăm fluxurile (codul de derivare rămâne; se schimbă configurația pe care o
scrie interfața, iar afișarea):
1. **Push implicit** (`configurator3d-step.tsx`, `apply` + efectul de montare): după
   `normalizePieceConfig`, o funcție nouă (frontend, `piece3d/front-style.ts`)
   `withFrontStyleRule(kind, cleaned, intent)`: dacă `configHasFronts(kind, cleaned)` și `frontStyle`
   lipsește → `frontStyle: 'PUSH'`; dacă piesa NU are fronturi → `frontStyle` se scoate din ce se
   salvează (intenția îl păstrează, ca să revină). Efectul de montare aplică regula și pe o configurație
   salvată care o încalcă (ciornele vechi, toate versiunile: v3 și v4 derivă deja `PUSH` din
   `frontStyle: 'PUSH'`). Rezultat: firma vede „deschidere push” + sistemul PUSH (punctat, PO d2-3); o
   piesă fără fronturi nu mai are „fronturi cu mâner” în descriere. Cererile PUBLICATE nu se schimbă;
   la ele, doar Sumarul / pagina cererii afișează „Push” când lipsește și piesa are fronturi (pasul 4).
2. **Selectorul ascuns**: `TogglePills` „Deschidere fronturi” se randează doar când
   `configHasFronts(piece, config)`; pilula arată valoarea reală (`config.frontStyle`), nu `?? 'PUSH'`.
   Selectorul „Batante / Glisante” arată „Batante” ca ales doar când există uși (`totals.doors > 0` sau
   zone `DOOR`); fără uși, niciuna aleasă (D4b).
3. **Pornirea pieselor noi**: funcție NOUĂ în `packages/shared/src/questionnaire/piece3d/config.ts`
   `initialPieceConfig(kind)` = `defaultPieceConfig(kind)` + (WARDROBE: zonele `OPEN` devin `DOOR` cu
   același `fill`; sertarele rămân) + (TV_UNIT: fiecare coloană `[{ type: 'DRAWERS', count: 1 }]`) +
   `frontStyle: 'PUSH'` dacă are fronturi; trecută prin `normalizePieceConfig` și verificată în test cu
   `explainPieceCleanup` (curățarea nu trebuie să scoată nimic). `defaultPieceConfig` rămâne neschimbat
   (fixturile și instantaneele îl folosesc). Interfața folosește `initialPieceConfig` la montare (când nu
   există răspuns) și la butonul „Resetează” (`config3d.reset`). Ciornele existente își păstrează
   configurația.
4. **Sumarul și fișa**: `piece3d/config-chips.ts` — export nou `config3dChipItems(t, config, kind?)` →
   `{ text: string; swatch?: string }[]`; `config3dChips` rămâne (= `.map(i => i.text)`) ca apelanții
   neschimbați (`piece-viewer.tsx`, `furniture-controls.tsx`) să meargă. Schimbări: deschiderea apare
   mereu la piesele cu fronturi („Deschidere: Push” / „Deschidere: cu mâner”, lipsă = Push), niciodată
   fără fronturi; baza mereu la piesele cu `rules.legsOption` / `hasPlinth` („Bază: soclu” / „Bază:
   picioare”); etichete: „Saltea: 160 × 200 cm”, „Depozitare: fără”, „Persoane: 6”; culoarea = nume
   aproximativ + mostră: `approxColorKey(hex)` → cea mai apropiată culoare din `PIECE3D_FINISHES`
   (distanță RGB) → „Culoare: aproape de verde salvie” cu `swatch: hex`, nu codul hex. Rândul din Sumar
   se numește „Configurația piesei” (`summaryLabel` pe pasul `configurator-3d` = cheia nouă
   `config3d.summaryLabel`, scrisă de agentul C; folosită de B prin `summaryLabel`).
5. **„Dimensiuni orientative”**: export nou în `config-chips.ts`
   `config3dDimsUntouched(kind, config)`: adevărat când lățimea, înălțimea și adâncimea sunt exact cele de
   pornire (`initialPieceConfig` SAU `defaultPieceConfig`, ca să prindă și cererile vechi). Afișat pe
   fișa firmei (`room-spec-card.tsx`, lângă pilulele 3D, insignă ambra
   `config3d.dimsOrientative` = „Dimensiuni orientative — clientul nu le-a modificat”) — doar
   `audience="company"`. Fără coloană nouă, fără schimbare la server (D3).
6. Teste: `initialPieceConfig` (shared, test nou `piece3d/initial-config.test.ts`: dulap cu uși pe toate
   coloanele, comoda TV cu sertare, curățarea nu scoate nimic, `defaultPieceConfig` neschimbat);
   `front-style.test.ts` (fronturi → PUSH; fără fronturi → fără frontStyle; intenția îl readuce);
   `configurator3d-step` (comoda TV nouă: Sumarul nu are „Fronturi cu mâner”; bufet lăsat implicit →
   `deriveRoom` dă `PUSH` și „deschidere push” în descriere; dulap: „Batante” cu cel puțin o ușă);
   `config-chips.test.ts` (etichete, culoare aproximativă, Push implicit); `room-spec-card`
   (marcajul „orientative” la dimensiunile de pornire, absent după o schimbare).

## 2. Reguli comune (API exact)

### 2a. Formatarea unei dimensiuni — `apps/frontend/src/lib/dimension-format.ts` (val 0)

```
export type DimensionUnit = 'm' | 'cm' | 'mm';            // mutat aici; store-ul il importa
export const DIMENSION_DECIMALS: Record<DimensionUnit, number> = { m: 3, cm: 1, mm: 0 };
export function toUnit(meters: number, unit: DimensionUnit): number;          // rotunjit la DIMENSION_DECIMALS
export function formatDimension(meters: number, o: { unit: DimensionUnit; locale: string }): string;   // "45,5 cm"
export function formatDimensions(meters: number[], o): string;                 // "120 × 80 × 40 cm"
export function formatDimensionRange(minM: number, maxM: number, o): string;   // "80–600 cm"
```
- Intrare: METRI (cum se salvează). Ieșire: număr după limbă prin `formatDecimal` (virgulă în ro,
  punct în en, fără grupare de mii), un spațiu obișnuit, apoi unitatea. Fără zecimale inutile
  („240 cm”, nu „240,0 cm”). `NaN` / infinit → „—”.
- Unitatea: formular / Fișă / Sumar = store; pagina cererii clientului = `useDimensionUnitPreference()`
  din `apps/frontend/src/lib/dimension-unit.ts` (val 0): citește / scrie `localStorage['cozy.dimensionUnit']`
  (try/catch, implicit `'cm'`), plus `rememberDimensionUnit(u)`; comutatorul din `step-renderer.tsx`
  apelează și `rememberDimensionUnit` (store-ul se golește la publicare, de aceea cheia separată — D1).
- Firma: mereu `'cm'`. 3D: mereu cm. Nu se scrie nicăieri „m” lipit de un număr fără funcția asta
  (căutare de verificat la final: `` ` m` `` și `' m'` în `components/configurator`).

### 2b. Glosarul (42) — RO / EN

| Termenul ales (RO / EN) | Înlocuiește | Unde (chei / căutare) |
|---|---|---|
| „cerere” / „request” până la acceptare | „comandă”, „order” înainte de acceptare | toate textele de client înainte de `ACCEPTED`; căutare `\bcomand` / `\border` |
| „comandă” / „order” DUPĂ acceptare (PO i1-3) | „lucrare”, „proiect” pentru același lucru | `Fulfillment.*`, `Lifecycle.*`, statusurile după acceptare, e-mailurile de livrare |
| „plată” / „payment” la plățile firmei (PO i1-3) | „comandă” / „order” în portofel și facturare | `Billing.*`, `Marketplace.wallet.*`, e-mailurile de transfer (D6: referința de plată rămâne) |
| „Cerere nouă” / „New request” — titlul formularului | „Configurează-ți proiectul”, kickerul „Comandă nouă” | `Configurator.title`; `Configurator.kicker` → „Mobilier la comandă” / „Custom furniture” |
| „Am deja un proiect” / „I already have a project” | „Am proiectul propriu” | `Requests.field.hasOwnProject`, orice text care numește modul |
| „Mesaj pentru firme” / „Message for companies” | „Detaliile proiectului”, „Descriere” (pentru același câmp) | `Configurator.review.facts.description`, `Requests.field.description` unde e mesajul, pagina cererii |
| „Adresa montajului” / „Installation address” | „Locul montajului”, „Adresă” (ca titlu de câmp/secțiune) | `Configurator.review.facts.location`, `Requests.field.addressText`, `Requests.sectionAddress` |
| „Date generale” / „General details” | „Detalii generale” | `Requests.sectionGeneral` (+ EN), pagina cererii |
| „Mărime” / „Size” (mic / mediu / mare) | „Dimensiune” pentru mărimea proiectului | `Requests.size` și locurile cu `sizeValue` (NU dimensiunile fizice) |
| „lei” (RO și EN) | „RON” în texte | căutare `\bRON\b` în valori (nu în coduri de monedă din cod) — D10 |
| „Verifică și publică” / „Review and publish” — ultimul pas | „Sumar” ca nume de pas | `Configurator.phases.review` (antetul are deja `review.title`) |
| „Proiectare cu plată” / „Paid design” — un singur termen | „Proiectare plătită”, „Proiectare cu plată inclusă”, „Include proiectare cu plată”, „Ajutor la proiectare” | `Configurator.start.DESIGN_HELP.badge/desc`, `cart.designHelpLegend/Hint`, `review.designHelpBanner`, `review.facts.helpRooms`, `Requests.designHelpIncluded*`, `Marketplace.includesPaidDesign`, `Admin.sizing.*.title` dacă e vizibil firmei |
| drumul proiectării (PO i1-1): „Firmele îți trimit întâi prețul proiectării și ce include; apoi alegi firma cu care proiectezi piesele.” | „contra cost”, „firma care o preia face proiectul împreună cu tine” | aceleași chei ca rândul de sus — textul trebuie să fie adevărat azi (D8) |
| „cu firma” / „with the company” | „cu proiectantul” | `Configurator.sheet.withDesigner`, `review.designHelpRoomNote` |
| „Cereri disponibile” / „Available requests” — ecranul firmei (PO i1-2) | „Marketplace”, „Piață” ca nume de ecran / meniu | `Nav.marketplace` (azi „Marketplace”), `Marketplace.title`, titlurile paginii, e-mailurile („Deschide marketplace-ul”) |
| client: „cererea ajunge la firmele din zonă” | „trimiți cererea în marketplace”, „În marketplace” | `Configurator.review.subtitle`, `review.loginToPublishHint`, `Requests.statusValue.IN_MARKETPLACE` → „Disponibilă firmelor” / „Open to companies” (D9), e-mailul de expirare |
| „Locuri ocupate {active} din {max}” / „{active} of {max} places taken” | „Sloturi {active}/{max}”, „Sloturi ocupate” → „Toate locurile ocupate” | `Marketplace.slots`, `Marketplace.full`, `Marketplace.slotsMine` |
| „Termen de răspuns” / „Response deadline” | „SLA”, „Termen ofertă (SLA)”, „Termen SLA depășit”, „SLA în pauză” | toate valorile cu `SLA` în `Marketplace.*`, `Quotes.*`, `Lifecycle.*`, `Penalties.*`, `Notifications.*`, e-mailurile (NU cheile `SLA_*` — ele sunt coduri) |
| „Anulată: nu a fost atribuită la timp” | „Anulată (neatribuită)” | căutare „neatribuit” |
| „Ce vrei să mobilezi?” + subtitlu cu camere și piese | „Ce camere vrei să mobilezi?” | `Configurator.cart.title/subtitle` (A2, val 1) |
| interzis: „atelier”, „workshop” | — | regula PO permanentă |

Excepții (rămân): sintagma „mobilier la comandă” / „la comandă” (= făcut pe măsură); cheile JSON și
codurile (`SLA_EXPIRED`, `IN_MARKETPLACE`, `/marketplace` în URL-uri); `Admin*` (D7); textele generate în
`packages/shared` pentru firmă (înghețate; se verifică doar că nu conțin termenii interziși — azi nu conțin).

### 2c. Rândurile de rezumat (38) — `apps/frontend/src/components/configurator/summary-rows.ts` (B, val 1)

```
export function summaryLabelKey(step: QuestionStep): string;     // titleKey cu ".title" → ".summaryLabel"; boolean cu cardLabelKey → cardLabelKey
export function summaryLabel(t: Translate, step: QuestionStep): string;   // t.has(summaryLabelKey) ? ... : t(step.titleKey) (rezerva)
export interface SummaryRow { stepId: string; label: string; value: string; kind: AnswerSummaryEntry['kind'];
  importance: 'main' | 'extra'; invalid?: boolean; swatch?: string; mono?: boolean }
export function buildSummaryRows(room: { roomType; answers; flowVersion }, t, o: { unit: DimensionUnit; locale: string }): SummaryRow[];
```
- Sursa = `summarizeAnswers` (neschimbat) + pașii din `getFlow(roomType, version)` pentru etichete.
- „Altul”: un rând de alegere care conține opțiunea `ALTUL`/`OTHER` și are pas text pereche cu text →
  `value = "Altul — <text>"`, iar rândul text pereche nu mai apare.
- `pieces`: rândurile fără nume nu apar; configurația 3D → `config3dChipItems` (C), valoarea = textele
  unite cu „ · ”, `swatch` de la culoare.
- Dimensiuni: valoarea prin `formatDimension`; `invalid` din `dimensionSlotStatus`.
- `importance: 'main'` pentru: `pieces`, `configurator-3d`, `dimension-group`, pașii de material și
  deschidere (id-uri `material*`, `*Material`, `*Systems`, `opening*`, `systems*` — lista exactă o
  stabilește B din fluxuri, testată pe toate), pașii primului ecran al camerei; restul `extra`.
- Folosită de `RoomAnswerSummary`, `RequestSheet`, `ReviewRoomCard`; `RoomSpecCard` folosește doar
  `summaryLabel` (pilulele lui rămân cum sunt).

### 2d. Mesajele de validare (39) — `room-screens.ts` (A1)

```
export interface StepIssue { key: string; values?: Record<string, string | number>;
  fields?: Record<string, { key: string; values?: Record<string, string | number> }> }   // pe slotId
export function validateStepIssue(step: QuestionStep, answers: AnswerMap): StepIssue | undefined;
export function validateStep(step, answers): string | undefined;   // = validateStepIssue(...)?.key (pastrat pentru apelanti)
export function requiredMessageKey(step: QuestionStep): string;
```
- Cheile stau în `Configurator.validation.*`; parametri: `{count}` (câmpuri), `{field}` (eticheta
  slotului, tradusă de apelant), `{range}` (din `formatDimensionRange`), `{row}`, `{max}`.
- `StepRenderer` primește `error?: StepIssue` (în loc de `string`); `StepShell` randează
  `t(error.key, error.values)`; câmpurile de dimensiune citesc `error.fields[slotId]`.
- Chei noi (RO / EN, A1): `validation.chooseOne` („Alege o opțiune.”), `validation.fillThisField`
  („Completează câmpul.”), `validation.fillField` („Completează {field}.”), `validation.dimensionsMissing`
  („{count, plural, one {Un câmp necompletat} few {# câmpuri necompletate} other {# de câmpuri necompletate}}”),
  `validation.dimensionRequired`, `validation.pieceRow.{name,quantity,dimension}`, `pieces.maxReached`,
  `pieces.quantityMax`. Cheia `validation.answerRequired` rămâne (rezerva, folosită și de server).

### 2e. Bara de continuare pe telefon (40) — `components/configurator/sticky-action-bar.tsx` (val 0)

```
export function StickyActionBar({ children, className, bleed = true }: { children: ReactNode; className?: string; bleed?: boolean })
```
- UN singur element, folosit în locul `div`-ului de jos al fiecărui ecran. Sub `lg`:
  `sticky bottom-0 z-20 -mx-5 px-5 sm:-mx-7 sm:px-7 py-3 border-t bg-surface/95 backdrop-blur
  pb-[max(0.75rem,env(safe-area-inset-bottom))]` (marginile negative = padding-ul cardului `p-5 sm:p-7`
  din wizard; la Sumar, unde nu e card, fără margini negative — prop `bleed={false}`);
  de la `lg`: exact clasele de azi (`border-t border-border pt-6`, fără sticky). Nu e `fixed` (cardul
  e într-un `motion.section` cu `transform`, iar `fixed` sub un `transform` se strică — vezi lightbox-ul din
  r4) și nu acoperă finalul paginii (la capăt stă la locul lui).
- Trebuie să fie ultimul copil al containerului care cuprinde tot ecranul (altfel nu se lipește):
  runner (`room-flow-runner.tsx` rădăcina), coș, fișiere, date generale (în `<form>`). La Sumar
  (`review-step.tsx`) coloana de publicare vine după camere pe telefon, deci bara stă ca ultim copil al
  rădăcinii `ReviewStep`, `lg:hidden`, cu butonul „Publică” (aceeași funcție `doPublish`, aceleași
  condiții `disabled`); butonul din cardul de publicare devine `hidden lg:flex`. Așa la orice lățime
  există un singur buton vizibil cu numele „Publică cererea”.
- Conținut: „Înapoi” (outline, compact pe telefon: doar săgeată + text scurt) stânga, butonul principal
  dreapta; „Urmează: …” rămâne ascuns sub `sm` (ca azi). Coșul: textul `summary` lângă „Începe”.
- Ordinea focusului: bara e după conținut în DOM (deci și la tab). Când „Continuă” e respins, focusul
  merge pe primul câmp greșit (39), deci bara nu ascunde eroarea.
- Proprietar: val 0; după val 0 fișierul nu se mai schimbă (cereri prin coordonator).

### 2f. Funcții pure de verificare — `components/configurator/dimension-check.ts` (val 0)

```
export type SlotState = 'ok' | 'missing' | 'outOfRange';
export function dimensionSlotStatus(step: DimensionGroupStep, answers: AnswerMap):
  { id: string; labelKey: string; value?: number; min: number; max: number; state: SlotState }[];
export function conditionQuestionIds(cond: Condition): string[];                      // all/any/not recursiv
export function screenTotalKnown(screens: QuestionStep[][], allSteps: QuestionStep[], answers: AnswerMap): boolean;
```
- `screenTotalKnown` = adevărat când fiecare pas VIZIBIL de care depinde vizibilitatea altui pas
  (`conditionQuestionIds` din `visibleIf` al pașilor fluxului) are răspuns. Pe camerele fără alegere de
  piese e adevărat de la început; după alegerea pieselor totalul apare.
- Folosite de A1 (validare, contor) și B (marcaj în Fișă). (c) Regula de numărare, pe scurt:
  sus = ECRANE ale camerei curente („Ecranul 3 din 12”, totalul doar când `screenTotalKnown`); în Fișă =
  RĂSPUNSURI OBLIGATORII din toate camerele („6 din 19 răspunsuri obligatorii”, pașii vizibili
  neopționali ai ecranelor, aceeași funcție `validateStep`); camerele pliate nu mai numără nimic
  („câteva întrebări” / „gata”). Piesele din coș: „{n} camere · {m} piese” (cheile existente
  `cart.countRooms` / `cart.countPieces`, camera = tip cu `ROOM_KIND === 'room'`, restul piese).

## 3. Pachetele de lucru pe valuri

Înainte de fiecare val: `node C:/Users/Wolf/.claude/tools/capacity.mjs` (nu peste ce permite; agenții
sunt „light”: fără server, doar teste țintite prin `low.cjs`). Ramura `claude/reparatii-etapa-08`.

### Val 0 — fundația (un agent `e8-base`, ~0,5 zile; sau coordonatorul)
Fișiere (numai noi, plus o linie în store): `lib/dimension-format.ts` (+ `.test.ts`),
`lib/dimension-unit.ts` (+ test), `components/configurator/sticky-action-bar.tsx` (+ test: clasele
sticky doar sub `lg`, un singur copil randat), `components/configurator/dimension-check.ts` (+ test pe
dormitor și bucătărie: total necunoscut înainte de piese, cunoscut după; slot gol / peste interval),
`stores/configurator-store.ts` (doar `import type { DimensionUnit }` din `lib/dimension-format`).
Fără texte. Gata când: testele trec, typecheck pe fișierele noi curat.

### Val 1 — patru agenți în paralel

**A1 `e8-steps` — ecranele de întrebări** (39 pașii 1, 2, 4 pe „Altă piesă”; 38 pașii 1 (schița) și 5
(contorul de sus); 40 pașii 1 (schița), 2 (runner), 3 (carduri); 41 pasul 2 în formular). ~3,5 zile.
Fișiere: `room-screens.ts`, `step-renderer.tsx`, `room-flow-runner.tsx`, `dimension-figures.tsx`,
`playing-card.tsx`, `packages/shared/src/questionnaire/engine.ts` (doar `required_error` la
`dimension-group`), testele lor (`step-renderer-*.test.tsx`, test nou `room-screens.test.ts`,
`room-flow-runner.test.tsx` nou dacă nu există). Chei i18n: `Configurator.validation.*` (noi, §2d),
`Configurator.nav.screenOf`, `nav.screenOnly`, `Configurator.pieces.maxReached`, `pieces.quantityMax`.
Primește: val 0. Teste: câmp gol vs în afara intervalului (mesaj per câmp, rezumat cu număr, focus pe
primul câmp); alegere unică vs multiplă vs piese vs text (cheia corectă); „Altă piesă” v1 cu denumire de
1 caracter → „Piesa 1: …”, v2 peste limită (10 piese → buton dezactivat, cantitate > 999); contorul
„Ecranul 3” fără total până la alegerea pieselor; schița cu cota invalidă roșie; `engine.test.ts` slot lipsă
→ `validation.dimensionRequired` (și instantaneele neschimbate). De făcut de coordonator: nimic așteptat.

**A2 `e8-pages` — date generale, coș, fișiere, Sumar (publicarea), comparare** (39 pașii 3, 4 la mesaj,
5, 6; 40 pașii 2 (coș, fișiere, date, Sumar) și 4; 42 pasul 4). ~3 zile.
Fișiere: `details-step.tsx`, `room-cart-step.tsx`, `uploads-step.tsx`, `review-step.tsx`,
`app/[locale]/_components/offers-comparison.tsx`, `app/[locale]/requests/[id]/offers/page.tsx` (doar
prop-ul `scrollable` pe `Tabs`), `components/ui/tabs.tsx` (prop opțional nou), testele lor (`details-step.test.tsx`,
`room-cart-step.test.tsx`, `uploads-step.test.tsx`, `review-step.test.tsx`, `offers-comparison.test.tsx`).
Chei i18n: `Requests.validation.*Required` (noi), `Requests.messageHint`, `Configurator.review.sessionExpired*`,
`Configurator.cart.title`, `cart.subtitle`, `Quotes.compare.*` noi pentru carduri, textele de la 39.5
(lista exactă din §1/39.5). Primește: val 0. Teste: Date generale cu câmpuri goale → „Completează…”, cu
2 caractere → „prea scurt”; contorul 5.000; Sumar cu eroare `UNAUTHORIZED` → mesajul nou + butonul spre
`/login?redirect=/requests/new&reason=expired`; la orice lățime un singur buton „Publică cererea”
vizibil (jsdom: clasele); comparare cu 2 și 3 oferte: cardurile au toate valorile din tabel.
De făcut de coordonator: nimic așteptat (`Nav.marketplace` = „Marketplace” e al glosarului, val 2).

**B `e8-sum` — Fișa cererii, Sumarul, fișa firmei** (38 pașii 1–5 în afișare; 41 pașii 2 și 5; 40 pașii 1
(rezumate) și 3 (Fișa pliată)). ~3,5 zile.
Fișiere: `summary-rows.ts` (nou), `review-rail.tsx`, `room-answer-summary.tsx`, `review-room-card.tsx`,
`room-spec-card.tsx`, `configurator-wizard.tsx` (doar prop-urile `filesCount` și `collapsible` pentru
`RequestSheet`), testele lor (`room-answer-summary.test.tsx`, `review-room-card.test.tsx`,
`review-room-locale.test.tsx`, `room-spec-card*.test.tsx`, test nou `review-rail.test.tsx`,
`summary-rows.test.ts`). Chei i18n: `Configurator.sheet.*` (noi: `toFix`, `progress`, `someQuestions`;
`sheet.sections` scoasă), `Configurator.review.rooms.*`, TOATE cheile noi `Configurator.flows.**.summaryLabel`
(RO + EN, glosarul aplicat), `Configurator.flows.*.bedSize.options.*.label` (cm), `Configurator.roomSpec.*`.
Primește: val 0; de la C (același val): `config3dChipItems` și `config3d.summaryLabel` — până le livrează C,
B folosește `config3dChips` (azi) și rezerva titlului; integrarea se face în val 2 (B continuă prin
`SendMessage`). Teste: Fișă cu dimensiune invalidă marcată, rânduri goale ascunse, „Altul — sticlă” pe un
rând, „3 fișiere atașate”; card Sumar: lista extinsă nu repetă rândurile scurte, fără „Vezi toate” când nu
ascunde nimic; test pe TOATE fluxurile și versiunile (`FLOW_REGISTRY`), RO și EN: fiecare pas vizibil are o
etichetă de rezumat ≤ 40 de caractere (`summaryLabel` sau titlul scurt) și `main ∪ extra` = tot,
disjuncte; dimensiunile: firmă în cm, client după preferință, cerere veche în cm.

**C `e8-3d` — piesele 3D** (43 pașii 1–6; 41 pasul 4; 40 pașii 1 (3D) și 5). ~4 zile.
Fișiere: `piece3d/configurator3d-step.tsx`, `piece3d/furniture-controls.tsx`, `piece3d/catalog-controls.tsx`,
`piece3d/config-chips.ts`, `piece3d/use-dimension-field.ts`, noi `piece3d/dimension-control.tsx`,
`piece3d/front-style.ts`; în shared DOAR adăugarea `initialPieceConfig` în `piece3d/config.ts` (+ export
în `piece3d/index.ts` / `index.ts` dacă e nevoie) și testul nou; testele 3D existente
(`configurator3d-step-*.test.tsx`, `catalog-size-decimal`, `furniture.test`) aduse la zi. Chei i18n:
`Configurator.config3d.*` (noi: `summaryLabel`, `dimsOrientative`, `chips.opening*`, `chips.base*`,
`chips.mattress`, `chips.storage`, `chips.seats`, `chips.colorApprox`). Primește: val 0. Teste: §1/43.6 +
componenta de dimensiune folosită în toate trei panourile (aceeași etichetă, același „cm”, același mesaj de
corectare). De făcut de coordonator: insigna „orientative” în `room-spec-card.tsx` (B, val 2).

### Val 2 — integrare + glosarul (după ce coordonatorul îmbină fragmentele valului 1, rulează
`merge-i18n.cjs`, typecheck țintit și comite LOCAL; noul commit = baza fragmentelor `i18n-v2`)

**B (continuat, ~0,5 zile)**: folosește `config3dChipItems` (mostra de culoare în Sumar și Fișă),
`config3d.summaryLabel` („Configurația piesei”), insigna `config3dDimsUntouched` pe fișa firmei.

**D `e8-words` — glosarul** (42 pașii 1–3, 5, 6; ~3 zile). Fișiere: fragmentul `i18n-v2/e8-words.{ro,en}.json`
(poate schimba ORICE valoare din `ro.json` / `en.json` pentru termenii din §2b, inclusiv textele scrise
în val 1 și cele ale versiunilor vechi de formular), `docs/glosar.md` (nou),
`apps/backend/src/modules/notifications/notification-emails.service.ts` + `.spec.ts`, test nou
`apps/frontend/src/messages/glossary.test.ts` (termenii interziși din §2b pe valorile aplatizate RO și EN,
cu lista de excepții pe chei — `Admin*`, „la comandă”, cheile după acceptare pentru „comandă”), testele de
componentă care fixează texte exacte (găsite cu Grep după valorile vechi; de obicei citesc din
`ro.json`, deci se schimbă rar). Nu atinge fișiere `.tsx` (dacă un text e scris direct în cod, îl cere
coordonatorului). Gata când: `glossary.test.ts` trece, `questionnaire-content.test.tsx` și
`firm-text.test.ts` trec, căutarea manuală a termenilor din §2b arată doar excepțiile.

### Val 3 — revizuire, documente, e2e, browser
Revizor (doar citește; diff-ul etapei) + agent de documente (`docs/07` D-E8-* pentru D1–D12 de mai jos,
`docs/03` dacă se schimbă o regulă de afișare, trimitere spre `docs/glosar.md` din `docs/03`,
`CHANGELOG.md`).
Constatările se trimit autorilor cu `SendMessage`. Apoi coordonatorul: suite întregi, e2e, browser (§4).

Conflicte i18n evitate astfel: în val 1 fiecare agent scrie doar cheile listate mai sus (prefixe
disjuncte); textele existente schimbate în val 1 sunt doar cele numite (39.5, cart, bedSize); glosarul
rulează o singură dată, în val 2, peste baza care conține deja val 1, într-un folder separat — deci nu
poate intra în conflict cu fragmentele vechi. Agenții valului 1 scriu de la început textele noi după §2b.

## 4. Ce se verifică în browser la final (coordonatorul, Edge pe placa video)

1. Telefon 390 × 844 (`resize_window` mobil), RO și EN: coș, un ecran de material (dormitor v3, cu 3
   cartonașe pe 2 coloane), salteaua, ecranul „Fronturi” al bucătăriei (lung), „Altă piesă”, 3D (dulap),
   fișiere, date generale, Sumar extins cu text de 120 de caractere fără spații: `document.documentElement.scrollWidth
   === innerWidth` pe fiecare; butonul principal vizibil fără derulare (bara lipită) — inclusiv „Publică”;
   după „Continuă” cu un câmp gol, focusul și mesajul sunt pe ecran, deasupra barei.
2. Aceeași cerere (o bucătărie cu dimensiuni zecimale, de ex. 245,5 cm, și un dulap 3D): formular,
   Fișă, Sumar, pagina cererii (client), fișa firmei — clientul vede unitatea aleasă (încercat cu `m`),
   firma vede cm, cu virgulă în RO; o cerere veche publicată (din seed) arată corect fără migrare.
3. Comparare pe telefon cu 2 și 3 oferte: cardurile pe rubrică au toate valorile; filele firmelor pe un rând.
4. 3D pe telefon: scena lipită sus ~40%, atingerea unei zone aduce panoul ei pe ecran; țintele +/−
   ≥ 44 px. Comoda TV nouă: pornește cu sertare; Sumar fără „Fronturi cu mâner” la piesa fără fronturi;
   bufet lăsat pe implicit → la firmă „deschidere push”; dulap nou cu uși; insigna „Dimensiuni orientative”.
5. Mesaje: dimensiune goală vs prea mare; Date generale goale; publicare cu sesiunea scoasă (cookie
   șters) → mesajul nou → login → înapoi pe Sumar.
6. Glosar: parcurgere formular, Sumar, pagina cererii, piața și fișa firmei (cont de firmă), un e-mail în
   Mailpit (de ex. expirarea cererii).

E2e de adus la zi: `account-offers.spec.ts` (compararea pe proiectul mobil: cardurile în loc de tabel);
`helpers/guided-request.ts` (dacă selectează contorul „NN/NN” sau butonul „m” din comutator — rămâne;
verificat după cheile `nav.*`); un caz nou în `e2e/form-v6.spec.ts` sau fișier nou `e2e/etapa8.spec.ts`:
pe mobil „Continuă” vizibil în viewport pe ecranul de material și „Publică” pe Sumar; câmp de dimensiune
gol → mesaj per câmp; Fișa pliată pe mobil. Capturile e2e se rescriu (nu se compară byte cu byte).

## 5. DECIZIE NECESARĂ / riscuri (cu varianta mică recomandată; agenții NU extind produsul)

- **D1 Unitatea clientului pe pagina cererii.** Unitatea nu se salvează pe cerere (stă doar în
  browser, iar store-ul se golește la publicare). Recomand: preferința în `localStorage['cozy.dimensionUnit']`
  (implicit cm); pe alt dispozitiv clientul vede cm. Varianta mare (coloană pe cerere) — nu acum.
- **D2 Ce rămâne în metri.** Metrii liniari de mobilier, lungimea aproximativă (scrisă în m) și prețurile
  „lei pe metru liniar” rămân în m și la firmă; (b) 3D-ul rămâne mereu în cm, nu urmează comutatorul.
- **D3 „Dimensiuni orientative” fără coloană nouă.** Recomand calculul la afișare (dimensiunile egale
  cu cele de pornire). Cost: un client care alege intenționat exact dimensiunile de pornire e marcat
  „orientativ”. Varianta cu marcaj salvat cere câmp nou în payload + notă în `request_items.description` pe
  server — doar dacă PO o vrea.
- **D4 Pornirea dulapului și a comodei TV (PO d2-2) — interpretare.** Dulap: zonele deschise devin uși
  (umplutura păstrată), sertarele rămân; comoda TV: un sertar pe fiecare coloană. Doar pentru piesele noi
  (`initialPieceConfig`), nu pentru ciorne. (b) „Batante” nu mai apare ales când piesa nu are nicio ușă.
- **D5 Push implicit scris de interfață.** Configurația salvată primește `frontStyle: 'PUSH'` când piesa
  are fronturi și nu s-a ales nimic — și pentru ciornele deschise din nou (costul lor urcă cu 1–2 credite,
  conform PO d2-3). Cererile publicate nu se recalculează; doar afișarea lor arată „Push”.
- **D6 Referința de plată „Comanda {ref}”** din datele de transfer bancar rămâne neschimbată (o caută
  adminul în extrasul băncii); restul textelor de plată spun „plată”.
- **D7 Admin în afara glosarului** (texte interne; „SLA” rămâne acolo) — anglicismele de la admin la nr. 55.
- **D8 Textul proiectării cu plată.** PO a descris drumul (firmele răspund întâi cu prețul proiectării);
  cât din el se construiește e o întrebare nouă. Recomand textul adevărat azi: oferta are prețul
  proiectării și ce include pe rânduri separate, clientul alege firma. Fără promisiuni despre un pas care
  nu există.
- **D9 Eticheta stării `IN_MARKETPLACE`**: „Disponibilă firmelor” / „Open to companies” (alegere mică).
- **D10 „lei” și în engleză** (aliniat cu `formatLei`); dacă PO preferă „RON” în engleză, se schimbă doar EN.
- **D11 Plafoane**: cantitatea ≤ 999 (limita serverului), cel mult 10 piese (`maxPieces`), mesajul pentru
  firme ≤ 5.000 — doar afișate, fără limite noi.
- **D12 Lista scurtă din Sumar** (piese, material, deschidere, 3D, dimensiuni, primul ecran) — alegere
  de afișare; dacă PO vrea dimensiunile doar în lista completă, se mută dintr-o listă.
- **R1 Bara lipită**: dacă un strămoș are `overflow: hidden/auto`, `sticky` nu ține. Verificat în
  browser; rezerva = portal în `body` cu `fixed` + spațiu rezervat jos (doar dacă sticky nu merge).
- **R2 Etichete scurte lipsă** pe o versiune veche → apare titlul întreg (rezerva). Testul pe toate
  fluxurile prinde etichetele de peste 40 de caractere.
- **R3 Glosarul strică teste care caută texte exacte** — majoritatea citesc din `ro.json`; D le
  rulează pe toate cele găsite cu Grep.
- **R4 Mesajul motorului pentru slot lipsă** (`validation.dimensionRequired`) — testele din backend care
  așteaptă `dimensionOutOfRange` la slot lipsă se aduc la zi (A1 caută cu Grep în `apps/backend`).
- **R5** „Piese individuale” (`Requests.roomType.PIECES`) vs „Altă piesă” (configuratorul) — același
  lucru cu două nume; nu e în plan. Recomand ca D să le alinieze la „Altă piesă” doar în textele vizibile
  (titlul generat pe server neatins) — de confirmat de coordonator.
