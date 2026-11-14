# Etapa 4 — contractul dintre server și interfață (obligatoriu pentru toți agenții etapei)

Scris de coordonator înainte de lucru, ca serverul (`e4-be`) și interfața (`e4-card`, `e4-cmp`) să poată fi făcute în paralel. Numele de mai jos sunt cele finale. Dacă un punct ți se pare greșit sau imposibil, respectă-l totuși cât poți, scrie la „DECIZIE NECESARĂ” ce nu merge și anunță coordonatorul în raport; nu inventa alt nume pe cont propriu. `e4-be` e cel care le scrie în `packages/shared/src/quote.schemas.ts` (+ `enums.ts`, `error-codes.ts`); agenții de interfață NU editează `packages/shared` și pot folosi o extensie locală de tip până apar câmpurile (o scot la final dacă tipul din shared există).

Hotărârile PO din spate (finale, 2026-11-13): a4-1 refuz definitiv — locul firmei se închide, creditele se consumă, firma e anunțată; a4-2 motiv opțional din listă scurtă + text liber, firma îl vede; a3-1 rubrică de TVA obligatorie cu trei variante; a3-2 termenul și garanția obligatorii; a3-3 doar bife „inclus în preț: transport / montaj”; g0-11 la cererile cu proiectare cu plată, prețul proiectării și „ce include” sunt obligatorii în ofertă (prețul mobilierului rămâne în aceeași ofertă, ca estimare).

## 1. Câmpurile unei variante de ofertă

Se aplică la toate drumurile care creează o variantă: `POST /quotes` (v1), `POST /quotes/:id/revise`, `POST /quotes/:id/extra`, `POST /quotes/:id/reoffer`.

| Câmp (intrare și ieșire) | Tip | Regulă |
|---|---|---|
| `currency` | `'RON' \| 'EUR'` | Devine a VARIANTEI. La intrare e opțional pe toate drumurile (lipsă = moneda variantei precedente; la v1 = `RON`). La ieșire e mereu prezent pe fiecare variantă (variantele vechi îl iau din oferta părinte, prin backfill). `QuoteDto.currency` rămâne și înseamnă moneda variantei curente. |
| `vatMode` | `'VAT_INCLUDED' \| 'VAT_EXCLUDED' \| 'NOT_VAT_PAYER'` | Obligatoriu la variantele noi. La ieșire `null` pentru variantele vechi. |
| `deliveryTermValue` | întreg ≥ 1 | Obligatoriu la variantele noi, împreună cu unitatea. `null` la cele vechi. |
| `deliveryTermUnit` | `'WEEKS' \| 'WORKING_DAYS'` | Idem. |
| `warrantyMonths` | întreg ≥ 1 | Obligatoriu la variantele noi. `null` la cele vechi. |
| `includesTransport` | boolean | Obligatoriu (explicit) la variantele noi. `null` la cele vechi. |
| `includesAssembly` | boolean | Idem. |
| `designFee` | număr > 0 | Obligatoriu DACĂ cererea are proiectare cu plată (`includesPaidDesign`); interzis altfel (ca azi). |
| `designIncludes` | text 1–1000 | „Ce include proiectarea”. Obligatoriu odată cu `designFee`; interzis fără el. `null` la variantele vechi. |
| `price`, `description`, `deliveryDate`, `roomPrices`, `validityDays`, `attachmentIds` | ca azi | Neschimbate. |
| `deliveryTerm`, `warranty` (text liber) | text | NU se mai trimit de interfața nouă. Serverul le completează singur din câmpurile structurate (de ex. „6 săptămâni”, „24 luni”), ca variantele noi să rămână lizibile pentru cod vechi, PDF și e-mailuri. La variantele vechi rămân textul scris de firmă. Un payload vechi (doar cu text, fără câmpurile structurate) e REFUZAT la variantele noi cu `VALIDATION_ERROR` — excepție doar dacă `e4-be` găsește un motiv de compatibilitate blue/green și îl explică. |

Câmpuri calculate de server, doar la ieșire, pe fiecare variantă (ca tabelul, cardul și PDF-ul să arate aceleași cifre):

| Câmp | Tip | Sens |
|---|---|---|
| `vatRatePercent` | număr | Cota de TVA folosită la calcul (din sursa existentă a aplicației pentru TVA — `e4-be` o găsește; NU o scrie de mână în interfață). |
| `priceWithVat` | număr \| `null` | Prețul cu TVA, în moneda variantei: `price` dacă `VAT_INCLUDED` sau `NOT_VAT_PAYER`; `price × (1 + cotă)` dacă `VAT_EXCLUDED`; `null` dacă `vatMode` lipsește (variantă veche). |
| `deliveryWorkingDays` | întreg \| `null` | Termenul adus la zile lucrătoare (`WEEKS` × 5); `null` la variantele vechi. |

Conversia EUR → lei rămâne unde e azi (mecanismul existent din interfață / server pentru curs); `e4-be` spune în raport de unde vine cursul și data lui, iar `e4-cmp` le afișează.

Permisiunile pe câmpuri ale firmei (matricea `company_offer_field_permissions`): cheile existente rămân; `e4-be` hotărăște și scrie în raport sub ce cheie existentă intră fiecare câmp nou (de ex. TVA și bifele sub `PRICE`, termenul structurat sub `DELIVERY_TERM`, garanția sub `WARRANTY`), fără chei noi dacă se poate.

## 2. Refuzul ofertei de către client

- `POST /client/quotes/:id/decline`, cu antetul `Idempotency-Key` (la fel ca acceptarea), corp `{ reason?: 'PRICE' | 'DELIVERY_TERM' | 'OTHER_COMPANY' | 'GAVE_UP', note?: string (≤ 500) }`. Răspuns: oferta adusă la zi (`ClientQuoteDto`, aceeași formă ca la acceptare).
- Stare nouă a ofertei: `DECLINED` (în `QUOTE_STATUSES`). Pe ofertă, la ieșire, pentru client și pentru firmă: `declinedAt: string | null`, `declineReason: (motivele de mai sus) | null`, `declineNote: string | null`.
- Se poate refuza doar o ofertă `SENT` a cererii clientului; altfel `409 QUOTE_NOT_DECLINABLE` (cod nou).
- Efecte (o singură tranzacție, cu blocarea cererii ca la acceptare): oferta → `DECLINED`; locul firmei se închide; creditele rezervate se CONSUMĂ (ca la „clientul a ales altă firmă”); starea cererii se recalculează (locul eliberat poate fi preluat de altă firmă cât cererea e deschisă); conversația cu firma devine doar-citire, ca la celelalte închideri; eveniment prin outbox către firmă (clopoțel + e-mail), cu motivul dacă există.
- Starea locului după refuz: `e4-be` alege între o valoare existentă din `ClaimSlotStatus` care înseamnă exact asta și una nouă; numele ales îl scrie în raport și în `enums.ts`. Interfața NU depinde de numele stării locului: pentru „ofertă refuzată” se uită doar la `quote.status === 'DECLINED'`.

## 3. Variantele și cererile de modificare

- Fiecare ofertă întoarce TOATE variantele ei (`versions`, în ordine), la client și la firmă, fiecare cu câmpurile din §1. (Azi ajung deja; `e4-be` verifică și completează.)
- Fiecare cerere de modificare (`changeRequests`) rămâne vizibilă după ce a primit răspuns: are `id`, textul clientului, data, starea și `requestedOnVersion` (numărul variantei la care s-a cerut) + `answeredByVersion` (numărul variantei care i-a răspuns, sau `null`). Dacă azi câmpurile au alte nume, `e4-be` le păstrează pe cele existente și adaugă doar ce lipsește — numele exacte le scrie în raport, iar `e4-card` le citește din `packages/shared` înainte de final.
- La o cerere de modificare: mesaj de sistem în conversația cu firma + e-mail către firmă. La o variantă nouă: e-mail către client. (Server.)

## 4. Cine ce face

- `e4-be`: tot ce e în `apps/backend/**` și `packages/shared/**` (schemă, migrare, serviciul de oferte, refuzul, PDF-ul ofertei, notificări / e-mailuri, mesajul de sistem), plus textele erorilor noi (RO / EN, prin fragment).
- `e4-card`: formularul ofertei (`offer-builder.tsx`), cardul ofertei (`offer-card.tsx`: variante, diferențe, cereri de modificare, butonul „Refuz oferta” cu dialog), dialogul de acceptare, `hooks/use-quotes.ts`, afișarea ofertei pe fișa de lucru a firmei și pe pagina ofertelor clientului.
- `e4-cmp`: tabelul de comparare (`offers-comparison.tsx`), exemplul de pe prima pagină, conversia în lei și formatarea sumelor pentru tabel.
