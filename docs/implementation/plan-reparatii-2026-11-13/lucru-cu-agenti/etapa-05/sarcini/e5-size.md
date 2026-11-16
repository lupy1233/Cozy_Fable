# Sarcina `e5-size` — problema 21 (`d3`): costul în credite

Citește secțiunea „## 21.” din `E:\Cozy Fable\docs\implementation\plan-reparatii-2026-11-13\etapa-05.md` și §2 din contract. Zonă cu bani: schimbă cât plătesc firmele pe o preluare. Faci DOAR partea de acum: ponderile care lipsesc și lungimea aproximativă cu „Am deja un proiect”. Mărimea la spălătorie / balcon / cămară (nr. 50) și punctele pe configurația canapelei (etapa 10) NU se fac acum.

## Ce ai de făcut
1. **Cele 7 ponderi** (`key = 'ROOM_TYPE'`): `PIECE_SOFA` 3, `PIECE_SIDEBOARD` 2, `PIECE_BATHROOM_VANITY` 2, `PIECE_ENTRYWAY` 2, `PIECE_WALL_CABINET` 1, `PIECE_ARMCHAIR` 1, `PIECE_OTTOMAN` 1 — provizorii, hotărâte de PO (g0-10).
   - în `apps/backend/prisma/seed.ts` (`SIZING_CONFIG`, lângă cele 10 existente);
   - în migrare, cu `INSERT … ON CONFLICT (key, option) DO NOTHING` (pe producție adminul poate doar edita rânduri existente, nu adăuga; o pondere deja editată de admin nu se suprascrie). Verifică în `schema.prisma` cum se generează `id`-ul rândului (uuid) și numele reale ale coloanelor.
2. **„Lungime aproximativă” cu proiect propriu** (hotărârea d3-2): câmp opțional pe cameră, în afara răspunsurilor, `approxLengthM` (metri), după modelul lui `needsDesignHelp` din etapa 2:
   - `packages/shared/src/request.schemas.ts` (`configuratorRoomSchema`; permis doar când cererea are `hasOwnProject`; limite rezonabile, de ex. 0,1–50 m; accept zecimale);
   - `apps/backend/src/modules/requests/dto/request.dto.ts`, `publish-rules.ts` (respinge câmpul fără `hasOwnProject`), `configurator.service.ts`, și locul unde se scriu / citesc camerele cererii (dacă e în `requests.service.ts`: fișier comun, doar Edit punctual);
   - coloana `request_rooms.approx_length_m NUMERIC(5,2) NULL` (schema + aceeași migrare), ca editarea cererii să o păstreze;
   - `packages/shared/src/questionnaire/engine.ts` / `mapping.ts`: treapta `ROOM_SIZE` vine din `approxLengthM` DOAR când lungimea derivată din dimensiuni e 0. Gol = „sub 2 m”, ca azi. Nimic altceva din scor nu se schimbă;
   - interfața: un câmp opțional „Lungime aproximativă (m)” în `room-flow-runner.tsx`, doar când `hasOwnProject` și fluxul camerei are pas de dimensiuni ascuns; cu virgulă zecimală românească (cititorul existent `apps/frontend/src/lib/decimal.ts` / `use-decimal-field.ts`); starea în `stores/configurator-store.ts` (fără să strici ciornele existente — vezi cum a fost adăugat `needsDesignHelp`, inclusiv versiunea / migrarea ciornei dacă e nevoie);
   - firma vede valoarea pe fișa camerei (`room-spec-card.tsx`: „Lungime aproximativă: 6 m”), iar clientul în Sumar. Dacă Sumarul cere o schimbare în `review-step.tsx` (al lui `e5-area`), fă doar un Edit punctual de adăugare sau cere-o la „De făcut de coordonator”.
3. **Minim 1 credit, fără maxim** (d3-3): nu schimbi cod; spune în raport, la „Documente”, textul pentru docs/03 care închide hotărârea lipsă.

## Reguli stricte
- Cererile deja publicate și locurile deja preluate NU se recalculează (costul e înghețat la preluare): nu scrie niciun backfill de scor.
- `packages/shared/src/questionnaire/score-invariance.test.ts` + snapshotul: cererile fără `approxLengthM` dau exact același scor ca azi. Dacă snapshotul se schimbă din cauza celor 7 ponderi, explică exact ce rânduri și de ce; nu-l regenera orbește.
- Fluxurile din `packages/shared/src/questionnaire/flows/**` nu se ating.
- După schimbări de tipuri în shared: `pnpm -F @marketplace/shared build`; după schema Prisma: `pnpm -F backend exec prisma generate` (ambele prin `low.cjs`).

## Teste (din „Cum se verifică”)
- Scor cu tabelul din seed: canapea 3 locuri > pereche de noptiere; fotoliu, taburet, bufet au pondere.
- Bucătărie cu proiect propriu și `approxLengthM = 8` → treapta „peste 4 m”; fără câmp → „sub 2 m” (ca azi); cu dimensiuni completate, `approxLengthM` nu mai contează.
- Publicare: `approxLengthM` fără `hasOwnProject` → respins; cu el → salvat și întors la editare.
- Previzualizarea din Admin → Mărime proiect arată costul nou (verifică doar din cod că rândurile noi apar în listă).

## Fișierele tale
Cele din tabelul contractului (rândul `e5-size`) + migrarea `20261114100000_piece_weights_room_approx_length`. Textele: fragment i18n `e5-size`.
