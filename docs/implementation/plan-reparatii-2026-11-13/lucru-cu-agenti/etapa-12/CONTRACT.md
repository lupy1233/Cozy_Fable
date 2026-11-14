# Etapa 12 — contractul dintre agenți (obligatoriu pentru toți agenții etapei)

Șapte agenți lucrează în paralel în aceeași copie de lucru (`E:\Cozy Fable`, ramura `claude/reparatii-etapa-12`), apoi un al optulea (`e12-clean`) după ce textele sunt așezate. Fiecare își citește secțiunile din `docs/implementation/plan-reparatii-2026-11-13/etapa-12.md` (pași, „Unde în cod”, „Cum se verifică”, răspunsurile PO și „Alegeri mărunte” — finale). Numerele de linie din plan sunt vechi: caută după text / nume de cheie. Dacă un punct de aici ți se pare greșit: respectă-l cât poți și scrie la „DECIZIE NECESARĂ”.

## Cine ce face

| Agent | Probleme | Zona lui |
|---|---|---|
| `e12-price` | 54 (`c12`) formatul prețurilor orientative | DOAR cheile `…price` din `ro.json` / `en.json` (prin fragment) + testul nou de tipar |
| `e12-words` | 55 (`i2`) engleza și anglicismele + 62 (`c11`) șablonul de întrebare și glosarul de piese | titlurile, etichetele și numele de piese / camere din `Configurator.*`, textele `Studio.*`; `apps/frontend/src/messages/glossary.test.ts`; `review-step.tsx` (doar numărătoarea „camere · piese”); titlul cererii din `apps/backend/src/modules/requests/requests.service.ts` (doar funcția de titlu + testul ei) |
| `e12-hints` | 63 (`c13`) subtitluri și sfaturi care contrazic întrebarea | DOAR cheile de subtitlu / descriere / sfat / avertisment din `Configurator.flows.*` și `common.*`; afișarea avertismentului „nerecomandat aici”; descrierea piesei „balcon deschis — exterior” |
| `e12-admin` | 56 (`k2`) consola de admin | `apps/frontend/src/app/[locale]/admin/**`, `apps/backend/src/modules/companies/admin-companies.controller.ts`, ridicarea suspendării din `companies.service.ts`, `apps/backend/src/modules/penalties/**` |
| `e12-dates` | 57 (`g2`) date în format american | `accept-offer-dialog.tsx`, `agreement-card.tsx`, `project-case-panel.tsx`, `client-fulfillment.tsx`, `offer-card.tsx` (doar datele), câmpul „Data livrării” din `offer-builder.tsx`, data din `studio-page.tsx`, regula de lint |
| `e12-nav` | 58 (`m1`) Back în formular, numele butoanelor de informații, e-mailul la înregistrare | `configurator-wizard.tsx`, `apps/frontend/src/stores/configurator-store.ts`, `playing-card.tsx`, `step-renderer.tsx`, `details-step.tsx` (doar contactul), pagina de înregistrare |
| `e12-misc` | 60 (`i3`) regulile publice + 61 (`f5`) e-mailul „Parola ta a fost schimbată” | `firm-rules-article.tsx` + textele `FirmRules.*`, dialogul de preluare (doar fraza cu puncte), `apps/backend/src/modules/auth/**`, `(auth)/reset-password/page.tsx` |
| `e12-clean` (valul 2) | 59 (`m2`) chei nefolosite și comentarii vechi | scriptul-test de chei, ștergerea celor confirmate, comentariile din `flows/index.ts` și `guided-pieces/v3.ts` |

## Reguli pentru texte (cele mai multe conflicte posibile sunt aici)
- Toate textele trec prin fragmente (`<id>.ro.json` / `<id>.en.json`), niciodată direct în `ro.json` / `en.json`. Scriptul de îmbinare refuză aceeași cheie scrisă de doi agenți cu valori diferite: dacă ți se întâmplă, NU o forța — scrie în raport cheia și lasă proprietarul din tabel să o aibă.
- Împărțirea pe chei: `e12-price` = doar chei `price`; `e12-hints` = subtitluri (`subtitle`, `description`, `hint`, `info.*` fără `price`), sfaturi, avertismente; `e12-words` = titluri (`title`), etichete (`label`), nume de opțiuni / piese / camere, tot `Studio.*`; restul agenților = doar cheile componentelor lor.
- Cheile NU se redenumesc și NU se șterg în valul 1 (se aplică și cererilor vechi; curățenia e a lui `e12-clean`). Textele noi rămân adevărate și pentru versiunile vechi ale fluxurilor.
- Termenii din `docs/glosar.md`; testul `glossary.test.ts` trebuie să rămână verde. Engleza: britanică (metre, colour). Bani: „lei” în RO; în EN moneda după cum spune glosarul.
- Un preț rescris nu are voie să-și schimbe cifrele: doar forma.

## Reguli pentru cod
- Fluxurile versionate și instantaneele (`packages/shared/src/questionnaire/__snapshots__/*.json`) ale versiunilor VECHI rămân byte-identice. `e12-hints`: fraza „balcon deschis — exterior” intră doar în descrierea generată pe versiunea curentă; dacă instantaneul versiunii curente se schimbă, spune exact ce rânduri.
- `playing-card.tsx` e al lui `e12-nav`; `e12-hints` adaugă avertismentul cu un singur Edit punctual (recitind fișierul înainte). `review-step.tsx`: `e12-words` atinge doar numărătoarea.
- `companies.service.ts`: `e12-admin` atinge doar ridicarea suspendării.
- `e12-dates`: regula de lint se adaugă în configurația eslint a frontendului (fișier comun: Edit punctual).

## Migrări
Doar `e12-admin` ar putea avea nevoie (motivul ridicării e în audit, deci probabil nu): nume rezervat `20261115150000_unsuspend_reason`; scrisă de mână, NEaplicată.

## Foldere
- Fragmente i18n: `C:\Users\Wolf\AppData\Local\Temp\claude\51a4fe9ce30fc601\021e0df7-d6c7-42ac-993b-05ae92e81192\scratchpad\reparatii\etapa-12\i18n`
- Rapoarte: `…\reparatii\etapa-12\rapoarte\<id-agent>.md` (scrie-l devreme, adu-l la zi pe parcurs).
