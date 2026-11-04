# Feedback PO — runda 4 (Sprinturi U1–U4)

Data: 2026-07-13. Sursa: feedback PO verbal (chat). Predecesor: docs/13 (T1), docs/12 (S1–S6).

## Cerintele PO (verbatim, rezumat)

1. Optiunea de insula stilizata LA FEL ca acele cartonase de layout al bucatariei,
   doar cu comportament de bifa.
2. Un mod de asezare al cartonaselor/controalelor incat sa incapa mai bine in
   pagina — exemplul dat: corp individual cu randare 3D, cand apesi pe o
   sectiune sa o modifici nu incap toate elementele pe un ecran (/design +
   /frontend-design).
3. Pagina de portofoliu (caietul de idei): la click pe imagine, lightbox-ul se
   deschide la INCEPUTUL paginii — trebuie derulat inapoi si se pierde randul.
4. Marketplace, cereri: daca un corp a fost configurat in 3D de client, firmele
   sa poata da PREVIEW corpului in 3D — sa intre in configurarea lui, sa apese
   pe elemente sa le deschida si sa citeasca dimensiunile, dar FARA sa poata
   modifica.

Toate sprinturile sunt FRONTEND-only: fara migrari DB, fara endpoint-uri noi,
fara bump de versiune de flow (modificarile de flow sunt pur prezentationale).

## Sprint U1 — insula = playing-card cu bifa (bucatarie)

- `packages/shared/questionnaire/types.ts`: camp NOU pur prezentational
  `cardLabelKey?` pe `BooleanStep` — eticheta cardului cand step-ul boolean se
  randeaza in stilul cardurilor de optiune. `kitchen.v2.ts` il seteaza pe
  `hasIsland` (id-uri/scoring neschimbate).
- `step-renderer.tsx` (branch-ul boolean inline): butonul lat cu switch devine
  `PlayingCard` cu `multi` (indicator patrat de checkbox), aceeasi ilustratie a
  insulei, acelasi flip de Info (pros/cons/pret) ca la cardurile de forma, in
  aceeasi grila `sm:grid-cols-2 lg:grid-cols-3` — cardul insulei sta aliniat cu
  cartonasele formelor si se bifeaza/debifeaza la click.
- i18n: `flows.KITCHEN.hasIsland.cardLabel` = „Insulă" / „Island".

## Sprint U2 — controalele 3D pe un singur ecran (stil Tylko)

- `configurator3d-step.tsx`, modul 3D: layout NOU pe desktop (lg+) —
  `grid-cols-[minmax(0,1fr)_330px]`: scena 3D STICKY in stanga (mai inalta,
  500px), panoul de comenzi in coloana din dreapta. Panoul zonei selectate
  apare LANGA model (primul slot al coloanei), nu sub el — cand apesi pe o
  sectiune, tot ce se poate modifica e vizibil fara scroll.
- Cand nicio zona nu e selectata, slotul arata indrumarea de interactiune
  (card punctat cu icon), in locul textului pierdut sub canvas.
- Compactari ca railul sa incapa: intervalul permis al dimensiunilor sta LANGA
  eticheta (nu sub slider); coloane+finisaj+optiuni impartite intr-un singur
  card; sliderele stau vertical in rail (`lg:grid-cols-1`).
- Mobil/tableta: ramane stivuit ca inainte. Modul „campuri clasice" neatins.
- Hint-ul i18n reformulat („panoul de comenzi" in loc de „bara de mai jos").

## Sprint U3 — lightbox-ul din caietul de idei se deschide peste viewport

- CAUZA: `animate-pageIn` avea `animation-fill-mode: both` → `<main>` pastra
  `transform: translateY(0)` PERMANENT dupa animatie, iar un stramos cu
  transform devine containing block pentru `position: fixed` — lightbox-ul
  (fixed inset-0) se ancora la inceputul documentului, nu la viewport.
- FIX dublu: (a) `tailwind.config.ts` — animatia pageIn fara fill-mode
  (efect vizual identic, transform-ul dispare la final) — repara TOATE
  overlay-urile fixed din pagini cu shell animat; (b) `inspiration-lightbox.tsx`
  — randare prin `createPortal(document.body)` + scroll-lock pe body cat e
  deschis: pozitia din galerie ramane exact unde era la inchidere.

## Sprint U4 — preview 3D read-only pentru firme (marketplace)

- Componenta NOUA `piece3d/piece-viewer.tsx` (+ export dynamic ssr:false in
  `piece3d/dynamic.tsx`): dialog full-screen cu `PieceCanvas` — firma roteste
  modelul, CLICK pe zone deschide/inchide usile si sertarele (aceeasi
  interactiune ca in configurator, inclusiv usile glisante), iar zona selectata
  isi arata dimensiunile REZOLVATE intr-un panou lateral: tip zona, interior
  (polite/bara × numar), inaltime rand, latime coloana, adancime — din
  `resolvePieceLayout`. NICIO editare posibila: configul nu se atinge, starea
  locala e doar selectia + fronturile deschise. Chips-urile rezumative
  (`config3dChips`) raman in dialog.
- `room-spec-card.tsx`: buton „Vezi corpul în 3D" sub blocul config3d — apare
  pe detaliul cererii din marketplace (firma, pre/post-claim) SI pe detaliul
  cererii clientului (aceeasi componenta). Datele erau deja in DTO (answers
  contine config3d) — zero schimbari backend, zero date noi expuse.
- Fallback fara WebGL: mesaj dedicat in dialog (dimensiunile raman in rezumat).
- QA: pagina de dev `/ro/dev/piece-3d` are buton de deschidere a viewerului
  pe configul curent (doar dev, 404 in productie).
- i18n: `config3d.zoneTypeLabel` + blocul `config3d.viewer.*` (RO+EN).

## Verificare

- 111/111 vitest shared; typecheck + lint verzi (FE+BE+shared).
- Preview (DOM, pane-ul embedded): U1 — 4 carduri pe ecranul de layout, cardul
  „Insulă" cu bifa patrata comuta la click, flip info functional; U2 — grila
  `514px+330px`, canvas sticky, railul (669px) incape sub un viewport de 720;
  U3 — dialogul montat pe BODY acopera exact viewportul la scrollY=2500,
  body overflow hidden cat e deschis, scrollY neschimbat dupa inchidere;
  U4 — viewerul se deschide cu titlu/nota read-only/chips/canvas si se inchide
  cu Escape. Limitare de mediu cunoscuta: rAF e pauzat in pane (tab ascuns),
  deci click-ul de raycast pe zone si screenshot-urile nu se pot exercita —
  logica de click e copia celei din configurator (validata T1/R7), geometria
  e acoperita de testele unit.

## Checklist acceptare (PO)

- [ ] Bucatarie, ecranul de forma: insula e un cartonas ca celelalte, cu bifa
      patrata; click bifeaza/debifeaza; „i" intoarce cardul cu detalii.
- [ ] Corp individual (ex. dulap) pe desktop: modelul 3D sta in stanga, toate
      comenzile in dreapta; click pe o sectiune → panoul ei apare LANGA model,
      fara sa impinga pagina; modelul ramane vizibil cand derulezi.
- [ ] Caietul de idei: deruleaza jos, click pe o poza → lightbox-ul apare PESTE
      ecranul curent; la inchidere esti exact pe randul de unde ai plecat.
- [ ] Marketplace, cerere cu corp configurat 3D: butonul „Vezi corpul în 3D"
      deschide modelul; click pe usi/sertare le deschide; zona selectata isi
      arata tipul si dimensiunile; nu exista niciun control de modificare.
