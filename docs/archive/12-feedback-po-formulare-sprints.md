# Feedback PO 2026-07-13 — formulare camere + configurator 3D (sprinturi S1–S6)

> **STATUS: S1–S6 LIVRATE 2026-07-13** (vezi CHANGELOG, intrarea „Sprinturi
> S1–S6"). Teste 101/101 shared + 32/32 backend, typecheck + lint verzi,
> verificare vizuala in preview pe bucatarie, living v3, upload si 3D.

Cerinta PO (transcris vocal, 2026-07-13): rearanjarea intrebarilor pe paginile
de formular, imagini sugestive pe tabul de dimensiuni, intrebari separate
material vs sistem de deschidere per piesa, limita de fisiere per camera (nu
per formular), plus doua fixuri pe configuratorul 3D.

Module afectate: `packages/shared` (flows, engine test, piece3d),
`apps/frontend` (configurator, ilustratii, i18n), `apps/backend`
(uploads.service). **Fara schimbari de DB** — nicio tabela atinsa.

## Presupuneri declarate (niciuna nu blocheaza — PO a delegat explicit)

1. **Desen 2D front-view** (nu 3D) pentru imaginile sugestive de dimensiuni —
   consecvent cu stilul existent (dressing/bucatarie/hol), ieftin de intretinut,
   usor de urmarit. PO a lasat alegerea deschisa („nu stiu daca 3D sau 2D").
2. **LED per corp (living)** = intrebare multi-choice separata „La care corpuri
   vrei iluminare LED?" cu cate o optiune per piesa eligibila selectata
   (comoda TV / biblioteca / vitrina / rafturi suspendate). PO a cerut o solutie
   „care sa aiba sens" — checkbox per corp e explicit si nu polueaza intrebarea
   de deschidere.
3. **Prag birou 2 casetiere**: latimea minima = 2 laterale + 2×42cm casetiere
   + 40cm spatiu genunchi ≈ 1.32m. Sub prag, a doua casetiera nu se poate
   adauga, iar la ingustare config-ul se auto-corecteaza (precedentul
   DRAWERS→OPEN din R5.4).
4. **Versionare**: dressing si living primesc **v3** (schimbari breaking:
   step eliminat / slot nou obligatoriu). Restul camerelor primesc doar
   schimbari prezentationale (ordine, screenGroup, ilustratii FE) — raman
   in-place pe versiunea curenta, validarea nu se schimba.
5. **Limita fisiere**: `maxFiles: 7` pe schita per camera (flow-urile CURENTE);
   capul global backend devine dinamic `7 × nr. camere + 10` (buffer pentru
   uploadurile de la nivel de cerere), in loc de 10 fix.

## Sprinturi

### S1 — Bucatarie: insula langa forme + ordinea intrebarilor
- `kitchen.v2.ts`: `layout` + `hasIsland` impart `screenGroup: 'layoutScreen'`
  → insula apare ca toggle-card cu iconita pe ACELASI ecran cu cele 3 forme
  (raspunsul ramane boolean, forma ramane obligatorie — exact cerinta).
- Reordonare: material baza → deschidere baza → material suspendat →
  deschidere suspendat → material insula → deschidere insula (id-uri
  neschimbate, doar ordinea ecranelor).
- `engine.test.ts`: asertia veche „hasIsland pe ecran separat" se inverseaza.

### S2 — Intrebari separate material vs deschidere per piesa
- `per-piece.ts`: sistemele de deschidere primesc ecran propriu
  (`piece:<VALUE>:systems`) cu titlu per piesa; materialul ramane pe ecranul
  lui. Se propaga automat in living, dormitor, birou, hol, spalatorie, balcon.
- `pantry.v2.ts`: `systemsCabinets` pe ecran separat de material.
- i18n RO+EN: titluri noi per piesa pentru intrebarea de deschidere.

### S3 — Dressing v3 + Living v3
- `dressing.v3.ts`: iluminarea LED devine optiune in `interiorModules`
  (accesorii interior); intrebarea separata dispare.
- `living.v3.ts`: slot de INALTIME per piesa (PO vrea inaltimile fiecarei
  piese), intrebarea `ledPieces` (multi-choice per corp eligibil, optionala),
  `ledLighting` global eliminat.
- Registru + `CURRENT_FLOW_VERSION` + i18n + teste. v2 raman FROZEN.

### S4 — Limita de fisiere per camera
- `maxFiles: 3 → 7` pe step-urile de schita din flow-urile curente.
- Backend `uploads.service`: cap dinamic per cerere (`7×camere + 10`).
- FE `room-sketch-upload` / cap global sincronizat; test BE actualizat.

### S5 — Imagini sugestive pe tabul de dimensiuni
- `dimension-figures.tsx`: figura compusa front-view cu piesele selectate si
  litere per latime/inaltime pentru LIVING, BEDROOM, OFFICE, BATHROOM
  (patternul HallwayFrontFigure, generalizat).
- Birou: vedere de sus cu bratul B/C pentru L si U (`DeskTopFigure` extins).
- Valorile introduse apar LANGA litera pe desen (plus legenda de jos, ca acum)
  — cerinta optionala PO, o facem.
- `IlluDeskU` din `room-pieces.tsx` e de fapt un T — corectat in U real.

### S6 — Configurator 3D
- Birou: prag de latime pentru 2 casetiere (`canAddColumn`,
  `normalizePieceConfig` auto-drop, `superRefine` la publish, test nou).
- Optiunile indisponibile se ASCUND in loc de greyed-out (bara de haine,
  sertare prea sus) — in ambele moduri (toolbar 3D + fields), 4 locuri.
- Stepper-ul de coloane dispare complet la piesele cu `maxColumns === 1`
  (noptiera).

## Acceptanta generala
- `pnpm -F shared build` → `pnpm typecheck` → `pnpm lint` → teste shared+BE verzi.
- Wizard bucatarie: forma+insula pe un ecran; ordinea material/deschidere per zona.
- Living/dormitor/birou/baie/hol/spalatorie/debara/balcon: material si
  deschidere pe ecrane separate; figura de dimensiuni prezenta.
- Dressing: LED in accesorii, fara intrebare separata.
- Upload: 7 fisiere per camera, capul global nu mai taie la 10.
- 3D birou: nu poti face casetierele sa se suprapuna; noptiera fara stepper de
  coloane; nicio optiune greyed-out.
