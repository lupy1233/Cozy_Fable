# Aria: 3D (piece3d + studio)

Auditat READ-ONLY, 2026-08-19. Fisiere citite integral: `apps/frontend/src/components/configurator/piece3d/**` (6),
`apps/frontend/src/components/studio/**` (8), `stores/studio-store.ts`, `hooks/use-studio-drafts.ts`,
`app/[locale]/studio/page.tsx`, `app/[locale]/dev/piece-3d/page.tsx`, `packages/shared/src/questionnaire/**`
(engine, types, mapping, piece3d/config+model, toate flow-urile v1/v2/v3 + guided-pieces), `room-meta.ts`,
`studio.schemas.ts`, `apps/backend/src/modules/studio/**`, plus punctele de legatura (configurator-store,
review-step, requests.service publish, middleware, next.config, main.ts backend, mesajele Studio RO/EN).
Toate afirmatiile de mai jos sunt verificate in cod (grep/citire); unde e doar rationament (nu test in browser)
e marcat explicit "[logic, netestat in browser]".

## BINE FACUT

- three/drei/fiber NU intra in bundle-ul initial: toate scenele (Configurator3dStep, PieceViewer3dDialog,
  RoomCanvas, RoomViewer3dDialog) trec prin `next/dynamic` cu `ssr:false` + loading spinner
  (`piece3d/dynamic.tsx`, `studio/dynamic.tsx`, `studio-page.tsx:74`). Previzualizarile 2D (`previews.tsx`)
  sunt SVG pur din `buildPanels`, fara three.
- `frameloop="demand"` + `dpr=[1,1.75]` peste tot; `Walls.useFrame` face setState DOAR la schimbarea
  vizibilitatii peretilor (`room-canvas.tsx:575-596`); `AnimatedFronts` cere cadre doar cat dureaza animatia.
- Geometriile create manual sunt dispose-uite (`FloorGrid` `room-canvas.tsx:348`, `ZoneHotspot` edges
  `piece-canvas.tsx:380`); listenerele DOM pentru drag (pointermove/pointerup pe window) au cleanup in
  `useEffect` (`room-canvas.tsx:783-800`, `studio-page.tsx:1135-1162`, `tutorial.tsx:330-340`).
- Validare identica FE/BE: `pieceConfig3dSchema` + `studioDraftDataSchema` din shared; backendul valideaza
  STRICT (`.strict()` peste tot), plafon de marime INAINTE de zod (`studio.service.ts:158`), limita 20
  drafturi/user, ownership verificat pe detail/update/delete (`requireOwned` -> 404, nu 403, deci nu
  divulga existenta), unicitate (user_id,name) in DB, guard JWT global + Throttler global 100/min.
- Scenele atasate cererii sunt re-validate la publish cu `requestStudioSceneDataSchema` + plafon bytes,
  iar intrarile invalide nu blocheaza publicarea (`requests.service.ts:902-917`).
- Model parametric PUR in shared (`piece3d/model.ts`, `config.ts`) cu teste (`piece3d.test.ts` 728 linii,
  `engine.test.ts` 1037 linii, `v3.test.ts`); normalizePieceConfig CORECTEAZA (nu respinge) regulile
  geometrice; `loadSnapshot` trece piesele prin normalize + scenele prin `fitSceneToRoom`.
- Tutorial: se poate sari (skipAll/skipStep/closeTour), `tutorialSeen` persistat -> invitatia NU revine la
  fiecare vizita; detectarea misiunilor ignora undo/redo/incarcare draft (`bulkOps`).
- Feedback de salvare draft: toast succes/eroare + mapare pe NAME_TAKEN / LIMIT_REACHED; "Actualizeaza X"
  vs "Salveaza ca nou" clar; `loadWarning` inainte de incarcare.
- Fallback WebGL exista in configurator (cade pe modul "campuri", `configurator3d-step.tsx:61-70,1028`),
  in PieceViewer si in RoomViewer (mesaj `webglMissing`).
- Accesibilitate de baza: toate butoanele-icon au `aria-label`+`title`, dialogurile au `role="dialog"
  aria-modal aria-label`, Esc inchide; undo/redo/rotire/fullscreen au scurtaturi afisate in tooltip.
- Pagina `/dev/piece-3d` NU e accesibila in prod: `if (process.env.NODE_ENV === 'production') notFound()`
  (inlinuit la build) si nu e linkuita nicaieri; nu e blocant.
- Fara `console.log`, `TODO`, `FIXME` sau cod comentat in toata aria. Nicio aparitie "atelier" in textele
  user-facing RO (doar in comentarii de cod, permis). Paritate chei Studio RO/EN 127/127.
- Fara texturi/imagini pentru 3D in `public/` (2.7MB total, nimic >300KB).

## DE MODIFICAT

### P0
- (niciun blocant gasit)

### P1
- `[P1] studio-page.tsx:146 (PieceEditorDialog), :845 (StudioDraftsDialog), :320 (StudioModal), tutorial.tsx:209, room-viewer.tsx:126, piece-viewer.tsx:136` — backdrop-ul are `onClick={onClose}`, iar continutul doar `stopPropagation` pe click. Per spec UI Events, `click` se dispatch-uieste pe STRAMOSUL COMUN al tintelor de mousedown/mouseup: un drag pe slider-ul de dimensiuni sau o orbita in canvasul 3D din editorul de piesa, eliberat peste marginea intunecata, inchide dialogul si PIERDE editarile nesalvate (editorul nu are confirmare). [logic, netestat in browser] → inchide pe backdrop DOAR daca `pointerdown` a inceput pe backdrop (ref/flag pe onPointerDown), sau foloseste Radix Dialog ca restul aplicatiei.
- `[P1] studio-page.tsx:1126-1162 + room-canvas.tsx:828-890` — drag-ul din paleta (biblioteca/goluri) asculta `pointerup`, dar NU `pointercancel`. Pe touch, `<li>`-ul bibliotecii nu are `touch-action:none`, deci un scroll cu degetul pe lista porneste dragul (>6px), browserul preia scroll-ul si emite `pointercancel` → ghost-ul ramane agatat pe ecran, `dropPayload` ramane in store, iar urmatorul tap pe canvas aseaza piesa din senin. Acelasi gol la `FloatingPanel.onGripDown` (`studio-page.tsx:540-572`: listenerele raman pe window pana la urmatorul pointerup) si la dragul din canvas (`room-canvas.tsx:797`). → trateaza `pointercancel` identic cu `pointerup` (+ `touch-action: none` pe randurile cu `onGrab`).
- `[P1] studio-page.tsx:1305-1328 (sendToRequest) + configurator-store.ts:238-263` — "Adauga in cerere" apasat de doua ori (sau dupa o modificare a scenei) ADAUGA DIN NOU cate o camera-piesa pentru fiecare asezare (`addRoomWithAnswers` doar face append), in timp ce scena atasata e inlocuita dupa `scene.id`. Rezultat: cos cu dubluri pe care clientul trebuie sa le stearga manual; nu exista nici un marcaj in cos al pieselor venite din Studio. → tine un map `placementId → localId` (sau marcheaza camerele cu `studioPlacementId`) si inlocuieste/actualizeaza in loc sa adaugi; sau cel putin confirmare "camera X e deja in cerere".
- `[P1] room-canvas.tsx:969 (RoomCanvas)` — SINGURA scena 3D fara verificare WebGL: `/studio` e pagina publica din header; pe un dispozitiv fara WebGL `WebGLRenderer` arunca la creare si pagina cade in error boundary-ul Next (configuratorul si cele doua viewere au `hasWebGl()` + mesaj). → acelasi `hasWebGl()` + `t('roomViewer.webglMissing')`/mesaj dedicat in loc de canvas.
- `[P1] apps/frontend (wizard/cart/review) — lipsa UI pentru scenele atasate` — grep `studioScenes` in `components/configurator/**` si `app/[locale]/requests/new` → ZERO referinte. Scena 3D atasata prin `attachStudioScene` nu se vede si nu se poate detasa nicaieri in wizard/sumar; clientul o descopera abia dupa publicare pe `/requests/[id]`. Daca sterge din cos piesele venite din Studio, scena ramane atasata si firma vede o camera cu corpuri care nu mai exista in cerere (fundatura vizibila doar firmei). → card "Camera 3D atasata (N)" in review-rail/cart cu preview + buton de detasare; la stergerea ultimei camere-piesa din scena, detaseaza scena.
- `[P1] studio-store.ts:899-906 (persist partialize accountDraft) + use-auth.ts:37-43 (useLogout)` — `accountDraft` (id+nume draft din cont) ramane in localStorage dupa logout. Utilizatorul B logat pe acelasi browser vede "Actualizeaza «draftul lui A»"; PUT-ul primeste 404 (ownership) si toastul spune "Nu am putut vorbi cu serverul — mai incearca" (`studio-page.tsx:800`), mesaj gresit. Nimic nu curata `mm_studio_v1` la logout (grep `useStudioStore` in afara componentelor studio → doar configurator-store). → la logout `setAccountDraft(null)` (si, decizie PO, eventual reset continut local); mapeaza 404 pe un mesaj "draftul nu mai exista".

### P2
- `[P2] studio.service.ts:158 vs NestFactory default (main.ts:13)` — `MAX_STUDIO_DRAFT_BYTES = 300_000`, dar body-parser-ul express implicit al Nest are limita 100kb (nu exista `bodyParser`/`json({limit})` nicaieri in backend). Un draft intre 100KB si 300KB primeste 413 inainte de service → FE toast generic. Estimat: un draft maxim (60 piese x ~400B + 12 scene x 120 asezari x ~78B) ≈ 150KB; uzul tipic e sub 20KB. → fie coboara constanta la ~90KB si afiseaza `draftTooLarge`, fie ridica limita body-parser-ului doar pe ruta /studio.
- `[P2] studio-page.tsx:796-800, 826, 836` — `STUDIO_DRAFT_INVALID`, `STUDIO_DRAFT_TOO_LARGE`, 404 si 413 cad toate pe `draftError` = "Nu am putut vorbi cu serverul — mai incearca o data" (retry nu ajuta). → mesaje dedicate; INVALID poate aparea real: nume de scena peste 60 caractere dupa `sceneCopyName` "{name} (copie)" (`NameDialog` limiteaza la 60, schema la 60 → copia unui nume de 55+ caractere nu se mai poate salva).
- `[P2] studio-store.ts (savePiece/placePiece/addOpening)` — limitele din `studio.schemas.ts` (`STUDIO_MAX_PIECES=60`, `STUDIO_MAX_PLACEMENTS_PER_SCENE=120`, `STUDIO_MAX_OPENINGS_PER_SCENE=24`) NU sunt aplicate in store/UI; doar `STUDIO_MAX_SCENES` e respectat. Utilizatorul afla la salvare (toast generic) sau la "Adauga in cerere" (>50 asezari → `MAX_REQUEST_ROOMS` respins la publish; `addRoomWithAnswers` nu verifica plafonul, spre deosebire de `room-cart-step.tsx:29`). → guard in store + buton "Piesa noua"/"+" dezactivat cu tooltip.
- `[P2] review-step.tsx:85 + configurator-store.ts:205,399 (snapshots3d nepersistat)` — snapshotul PNG al piesei se genereaza DOAR cand pasul `configurator-3d` e randat in wizard (`onSnapshot` debounced 800ms). Piesele venite din Studio (`addRoomWithAnswers` cu `config3d` precompletat) si orice piesa dupa un refresh NU au PNG la publish → `RoomSpecCard` al firmei ramane fara poza (are totusi chips + viewer 3D read-only). Nu e fundatura, dar promisiunea "snapshot PNG la publish" e partial onorata. → genereaza snapshotul la publish dintr-un canvas offscreen pentru camerele cu `config3d` fara snapshot, sau la `sendToRequest` in Studio.
- `[P2] configurator3d-step.tsx:349-355 + room-flow-runner.tsx:251` — `config3dContext={{ onSnapshot: ... }}` e un obiect/functie nou la fiecare render al runner-ului → efectul de snapshot (`[config, mode, onSnapshot]`) se re-armeaza la orice re-render al parintelui, nu doar la schimbarea configului (render + `toDataURL` ~100-300KB string in store). → `useCallback`/`useMemo` pe context.
- `[P2] studio-store.ts:388,406,864,893` — `'Camera 1'`, `'Piesa mea'` hardcodate in store (creat in afara React): utilizatorul EN vede "Camera 1" la prima vizita/reset. `studio-page.tsx:1727,1751` — tooltip/aria-label swatch-uri = id-ul brut (`VAR`, `STEJAR`, `TERACOTA`); `studio-page.tsx:930` — `toLocaleString()` fara locale-ul next-intl (formatul depinde de browser, nu de limba aleasa). → nume implicit dat din pagina (`t('sceneDefaultName',{n:1})`) la prima creare; chei `Studio.wallColors.*`/`floorColors.*`; `useFormatter().dateTime`.
- `[P2] studio-page.tsx:868` — "Autentifica-te" din dialogul de drafturi trimite la `/login` FARA `?redirect=/studio`, desi login-ul suporta `redirect` (`(auth)/login/page.tsx:22,32`) → dupa login utilizatorul ajunge in /dashboard, nu inapoi in studio. → `href="/login?redirect=/studio"`.
- `[P2] studio-page.tsx:713-760 (RoomDimControl)` — inputurile `range` si `number` de latime/adancime camera nu au `aria-label` si nu sunt intr-un `<label>` (eticheta e un `<span>`); la `DimensionControl` din configurator e rezolvat cu `aria-label`. `OpeningDimSlider`/`GapField` sunt OK (wrapper `<label>`). → `aria-label={label}`.
- `[P2] studio-page.tsx:1827, tutorial.tsx:357,440` — `bg-[#b08d57]` hardcodat pentru "acul de alama", desi exista tokenul `bg-brass` (`tailwind.config.ts:77`, `--brass`). `ROD_COLOR`/`HIGHLIGHT_COLOR` in `finishes.ts` sunt justificate (materiale three), dar clasele Tailwind nu. → `bg-brass`.
- `[P2] studio-page.tsx (PieceEditorDialog) + tutorial.tsx (TutorialModal) + room-viewer/piece-viewer` — dialogurile sunt implementate manual (portal + backdrop + Esc), fara focus-trap si fara restaurare focus, spre deosebire de restul aplicatiei (Radix). Design: pattern diferit de celelalte dialoguri (butonul X, paddingul, z-index 50/60/70 ad-hoc). → `Dialog` din `components/ui`.
- `[P2] piece-viewer.tsx:72-104 vs configurator3d-step.tsx:1041-1079` — logica `onZoneClick` (usi glisante / sertare / toggle) e COPIATA identic in doua fisiere; `hasWebGl()` e definita de 3 ori (`configurator3d-step.tsx:61`, `piece-viewer.tsx:22`, `room-viewer.tsx:24`); `ControlsLike` de 3 ori; `CameraRig` aproape identic in `room-canvas.tsx:670` si `room-viewer.tsx:33`; `StudioModal` (`studio-page.tsx:299`) == `TutorialModal` (`tutorial.tsx:188`); constantele `BACKDROP/DOOR_LEAF/GLASS/FRAME` dublate in `room-canvas.tsx:40-44` si `previews.tsx:20-23`. → extrage in `piece3d/webgl.ts`, `piece3d/use-open-zones.ts`, `studio/colors.ts`, `studio/studio-modal.tsx`.
- `[P2] studio-page.tsx:1013-1019 (tutorial state local)` — faza turului e `useState`; un refresh la mijlocul misiunilor pierde progresul, iar invitatia nu mai revine (`tutorialSeen=true` la Start) → utilizatorul ramane fara jurnal si trebuie sa gaseasca butonul "?" si sa reia de la misiunea 1. → persista `tutorialStep` in store (nepersistat in snapshot).
- `[P2] configurator3d-step.tsx:527-535 + messages config3d.drawersTooHigh/hangingNeeds (ro.json:1536-1537)` — optiunile indisponibile geometric se ASCUND (decizie PO) fara niciun mesaj; textele explicative exista in ambele limbi dar nu sunt folosite nicaieri (grep). Utilizatorul nu afla de ce "Sertare" a disparut cand a urcat randul peste 160cm. → foloseste-le ca hint sub pilule (sau sterge cheile, vezi DE STERS).
- `[P2] studio-page.tsx:131-136 (PieceEditorDialog Esc)` — Esc/backdrop inchid editorul de piesa fara confirmare si fara "ai modificari nesalvate" (toate celelalte actiuni distructive din studio au `ConfirmDialog`). → confirmare doar daca `editor.config` difera de piesa salvata.
- `[P2] studio-store.ts (persist la fiecare set)` — `zustand/persist` serializeaza intregul continut (piese+scene, pana la ~150KB) la FIECARE `movePlacement`/`moveOpening` din pointermove (zeci/secunda in drag). La scene mari poate produce jank pe dispozitive slabe. → `partialize`+debounce (storage wrapper) sau scrie doar la `pointerup`.
- `[P2] room-spec-card.tsx:151 + piece-viewer `config3d.viewer.title` = "Corpul configurat de client", `Studio.roomViewer.title` = "Camera 3D a clientului"` — aceleasi titluri apar si CLIENTULUI pe `/requests/[id]` (StudioScenesButton e montat si la client, `requests/[id]/page.tsx:126`). → titlu neutru ("Camera 3D", "Corpul configurat") sau variante dupa rol.
- `[P2] packages/shared/src/questionnaire/flows/guided-pieces/v3.ts:161-183` — pasul `doorType` al dulapului v3 e `hidden+optional` (pastrat pentru drafturi pre-T1), dar tine inca toate optiunile cu `info/pros/cons/price/icon` care nu se mai randeaza. → reduce la minimul necesar validarii (`options` fara info) sau, daca PO confirma ca nu exista drafturi pre-2026-07-13 cu `doorType`, scoate pasul (v4 nu e necesar — pasul era deja ascuns).
- `[P2] model.ts:515 (canAddColumn)` — `>= 0.22` hardcodat in loc de `COLUMN_W_MIN` (importat in acelasi fisier pentru `canRemoveColumn`). → foloseste constanta.

## DE STERS

- `packages/shared/src/questionnaire/piece3d/model.ts:481-485 — nextZoneType()` — mort in productie: singurele referinte sunt `piece3d.test.ts:502-507`; UI-ul nu mai cicleaza tipul la click (comentariul din `configurator3d-step.tsx:1042`: "NU mai cicleaza tipul — tipul se alege din bara"). Sterge functia + testul.
- `packages/shared/src/studio.schemas.ts:58 — STUDIO_ROTATIONS` — constanta exportata, referita doar de tipul `StudioRotation` (linia 59); schema foloseste `z.union([z.literal(0)...])` (linia 190), store-ul importa doar tipul. Inlocuieste tipul cu `0|90|180|270` sau foloseste constanta in schema.
- `packages/shared/src/questionnaire/flows/index.ts:166-216` — blocul `export { kitchenFlow, ..., pieceBenchFlowV2 }` (51 exporturi individuale): niciun import in `apps/**` sau `packages/shared/src` in afara folderului `flows` (grep `kitchenFlow|livingFlowV3|pieceWardrobeFlowV3|dressingFlowV3` → 0); `questionnaire/index.ts:5` re-exporta DOAR `CURRENT_FLOW_VERSION, FLOW_REGISTRY`. Testele importa direct din `./v3`/`./flows`. Suprafata publica moarta.
- `apps/frontend/src/messages/ro.json:266 + en.json:266 — Studio.renameScenePrompt` — nefolosit (grep → 0 in tsx); `NameDialog` foloseste `renameScene`.
- `apps/frontend/src/messages/ro.json:1536-1537 + en.json — Configurator.config3d.drawersTooHigh, config3d.hangingNeeds` — nefolosite (grep → 0 in tsx) — vezi P2 de mai sus: ori le folosesti ca hint, ori le stergi.
- `apps/frontend/src/stores/studio-store.ts:57 (STUDIO_SNAP), :79 (clampToRoom), :97 (snapToGrid) + re-exporturile OPENING_SPECS, STUDIO_WALLS (linii 36-44)` — exportate dar folosite doar in interiorul store-ului (consumatorii importa `OPENING_SPECS` direct din shared in `previews.tsx`). Scoate `export`/re-export-urile neconsumate.
- `apps/frontend/src/components/studio/tutorial.tsx:80 — export TUTORIAL_STEPS` — folosit doar in acelasi fisier; scoate `export`.
- `packages/shared/src/questionnaire/piece3d/model.ts:490 — panelsWithinBounds()` — doar teste (`piece3d.test.ts:395,413,445,678`); ramane util ca helper de test, dar nu are ce cauta in bundle-ul FE — muta in `piece3d.test.ts` sau intr-un `test-utils.ts` neexportat din `index.ts`.
- `apps/frontend/src/components/studio/previews.tsx:53,113,129` — `role="img"` + `aria-hidden="true"` pe acelasi SVG (contradictoriu; `aria-hidden` castiga) — pastreaza doar `aria-hidden`.
- Duplicatele listate la P2 (hasWebGl x3, ControlsLike x3, CameraRig x2, StudioModal/TutorialModal, onZoneClick x2, constante culori x2) — cod-copie, nu mort, dar de consolidat.
- NU e mort (verificat, pastrat cu motiv): flow-urile v1/v2 sunt toate in `FLOW_REGISTRY` (politica FROZEN, cererile publicate se valideaza contra versiunii lor); `PIECE3D_ZONE_TYPES` legacy SHELVES/HANGING/TILT_OUT + ramurile din `model.ts`/`pieceConfigTotals` servesc migrarea datelor pre-R5.3; `snapshot3dStep` hidden e scris programatic la publish.

## INTREBARI PENTRU PO

1. Exista in productie cereri publicate (request_rooms.flow_version) pe v1/v2 pentru camere/piese? Daca NU, flow-urile v1/v2 (≈2.900 linii in bundle-ul FE + BE) pot fi retrase din `FLOW_REGISTRY` (cu o migrare de date), altfel raman FROZEN conform docs.
2. La logout pe un dispozitiv partajat, continutul local al Studioului (piese + camere din localStorage, `mm_studio_v1`) trebuie sters sau pastrat? (Azi se pastreaza; doar `accountDraft` e problema — vezi P1.)
3. "Adauga in cerere" apasat a doua oara pe aceeasi camera: inlocuim piesele trimise anterior, le adaugam din nou (azi), sau blocam cu mesaj?
4. Vrem poza PNG in fisa firmei si pentru piesele venite din Studio (azi doar viewer 3D + chips, fara PNG)?
5. Limitele locale (60 piese / 120 asezari pe camera / 24 goluri) sa fie afisate utilizatorului (contor "12/60 piese") sau doar aplicate tacit?
6. Titlurile "Camera 3D a clientului" / "Corpul configurat de client" pot ramane si pe ecranul clientului, sau vrem formulare neutra?
7. Mesajele `drawersTooHigh`/`hangingNeeds` exista deja traduse: le afisam ca explicatie cand o optiune dispare (contrazice partial decizia "se ascund, nu se dezactiveaza") sau le stergem?
8. Pasul ascuns `doorType` (dulap v3): exista drafturi de dinainte de 2026-07-13 care inca il au raspuns? Daca nu, se poate elimina din definitie.
