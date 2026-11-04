# Feedback PO runda 5 — 2026-07-13 (sprinturi V1–V4)

Patru iteme din review-ul PO pe pagina de date generale (estimare buget), credite si contact.

## V1 — Costul cererii in credite: 1 credit = 1.000 lei din bugetul minim estimat

**Regula noua (inlocuieste costul pe praguri S/M/L = 1/2/4):**
- 1 credit = 1.000 RON din bugetul MINIM estimat al cererii (exemplul PO: buget minim
  33.000 lei → cererea costa 33 de credite). Minim 1 credit per cerere.
- Bugetul minim estimat = scorul de BAZA al camerelor × `BUDGET_RON_PER_POINT` (1.000) —
  exact valoarea `minRon` afisata clientului pe sliderul de buget (POST `/requests/estimate`).
- Scorul de baza NU include ponderea bucketului de buget si nici design-ul platit
  (ar fi circular / ar face costul mai mare decat minimul afisat). Acestea raman DOAR
  in scorul total care da marimea S/M/L (SLA 3/3/5 zile, filtre marketplace).
- Costul nu depinde de pozitia aleasa de client pe slider (min–3×min): firmele platesc
  pe valoarea minima estimata a proiectului, nu pe cat declara clientul.

**Implementare:** `creditCostFromBaseScore` + `CREDIT_VALUE_RON` in
`packages/shared/src/request.schemas.ts`; `SizingService.compute` calculeaza separat
`baseScore` (camerele) si scorul total; `creditCost` din praguri (`project_size_thresholds`)
nu se mai foloseste — coloana ramane in DB (legacy), inputul „cost" a fost scos din
Admin → Setari → Praguri si inlocuit cu nota formulei.

**Verificarea calculelor din spatele estimarii** (cerinta PO): lantul e
`processRooms(answers) → scoreEntries → Σ ponderi din project_sizing_config` (seed:
bucatarie 8p, dressing 6p… + marime camera 1/3/5p + material 1–4p + max sistem 1–3p +
cantitate 0/2/4p + intrebari specifice, ex. forma U 3p, insula 2p), apoi
`minRon = scor × 1.000`, `maxRon = 3 × minRon`, slider initializat pe minim si clamuit
in interval la editari. Costul = `minRon / 1.000` — aceeasi sursa, deci ce vede clientul
ca minim si ce platesc firmele nu pot diverge.

## V2 — Conturile demo pornesc cu 200 de credite

- `prisma/seed-demo.ts`: toate firmele demo (A/B/C/G/H) au `credits: 200`; costurile
  demo `SIZE.cost` aliniate la noua formula (= scorul: 10/20/35).
- One-off pentru mediul deja seedat (Railway): `pnpm -F backend seed:demo-credits`
  (ruleaza `prisma/update-demo-credits.ts` via `railway run --service Postgres`) —
  seteaza `balance = 200` pe wallet-urile firmelor demo (reserved neatins) si
  recalculeaza `credit_cost = GREATEST(1, size_score)` pe cererile publicate.
  Snapshot-urile claim-urilor existente NU se rescriu (istoric).

## V3 — Emailul contului = cale de comunicare blocata + fix schimbare canal

- **Frontend** (`details-step.tsx`): primul rand din „Preferinte de contact" este
  emailul contului — canal fix „Email" cu lacat, valoare read-only, fara buton de
  stergere, hint explicativ. Se pot adauga pana la 3 contacte in plus (capurile
  existente raman: max 4 total, max 2 per canal → max 1 email extra + max 2 telefoane).
- **Bugfix**: schimbarea canalului (Email ↔ Telefon) pe randurile libere GOLESTE
  valoarea — emailul nu mai ramane in campul de telefon.
- **Backend** (`requests.service.ts` → `withAccountEmail`): la publish si la edit,
  serverul garanteaza emailul contului pe pozitia 0 (dedupe case-insensitive +
  prepend) inainte de validarea formatelor — FE-ul blocheaza, serverul garanteaza.

## V4 — Geocodare robusta („Adresa nu a putut fi localizata")

Cauze gasite: Nominatim esua liber pe (a) adrese RO complete cu „bl./sc./ap./et.",
(b) judete scrise „Judetul X"/„jud. X", (c) tara hardcodata „Romania" desi formularul
permite 23 de tari. Fix in `geo.service.ts`:
- adresa se curata de bloc/scara/apartament/etaj/interfon inainte de cautare;
- judetul pierde prefixul „Judetul"/„jud.";
- cautare in trepte: adresa+oras+judet → oras+judet → oras (pauza 1,1s intre trepte,
  respecta rate-limitul Nominatim de 1 req/s);
- tara vine din cerere (`dto.country`, ISO2, implicit RO) — si `countrycodes`, si cheia
  de cache; schimbarea tarii la edit declanseaza re-geocodare (`addressChanged`).
- `GEOCODING_FAILED` se arunca DOAR daca toate treptele esueaza — practic doar la
  oras inexistent sau Nominatim picat; mesajul din UI ramane.

## Decizii (PO poate ajusta)

1. **Costul = bugetul MINIM estimat / 1.000**, nu valoarea aleasa pe slider — fixat pe
   exemplul PO „minim 33.000 → 33 credite". Alternativa (costul urmeaza sliderul) ar
   lasa clientul sa influenteze direct cat platesc firmele.
2. Capurile de contact raman max 4 total / max 2 per canal (email cont + 1 email extra
   + 2 telefoane). Daca PO vrea mai multe emailuri extra, se ridica capul per canal.
3. Coloana `project_size_thresholds.credit_cost` ramane in DB nefolosita (fara migrare
   distructiva); pragurile raman sursa marimii S/M/L.

## Test plan manual

1. Configurator: bucatarie mare (U + insula, MDF vopsit, 4+ corpuri) → pe „Detalii
   generale" estimarea arata `min – 3×min`; publica; in marketplace cardul cererii
   arata costul = min/1.000 credite (ex. minim 33.000 → 33 credite).
2. Claim pe cererea publicata cu firma demo → walletul scade exact cu costul afisat;
   `INSUFFICIENT_CREDITS` daca soldul liber e sub cost.
3. Admin → Setari → Praguri: fara input „cost", nota formulei vizibila; min/max inca
   editabile si salvabile.
4. Contact: logat, randul 1 = emailul contului cu lacat, fara stergere; adauga contact
   → telefon; schimba canalul pe Email → campul e GOL (nu ramane telefonul); invers la fel.
5. Publish cu adresa „Str. Exemplu nr. 3, bl. C2, sc. 1, ap. 7" + judet „Judetul Ilfov"
   → publica fara „Adresa nu a putut fi localizata"; pin corect pe oras macar.
6. Seed demo curat: firmele au 200 credite; pe mediul existent ruleaza
   `seed:demo-credits` si verifica walletul in dashboardul firmei.

## Checklist acceptare

- [ ] Cerere cu buget minim estimat 33.000 lei costa 33 de credite la claim.
- [ ] Cerere minuscula (scor 1–2) costa minim 1 credit.
- [ ] Firmele demo au 200 de credite.
- [ ] Emailul contului e mereu primul contact, nu poate fi sters/editat; se pot adauga
      emailuri/telefoane suplimentare; schimbarea canalului goleste campul.
- [ ] Adrese cu bl./sc./ap. si judete „Judetul X" se publica fara eroare de localizare.
